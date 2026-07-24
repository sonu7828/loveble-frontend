import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { invokeServiceFunction } from '../_shared/function-invoke.ts'
import { getLocationArrival } from '../_shared/location-arrival.ts'
import { hasTelevisit, televisitLocationName, TELEVISIT_ARRIVAL_INSTRUCTIONS, TELEVISIT_ADDRESS_LINE } from '../_shared/televisit.ts'

type EmailKind = 'staff-notification' | 'client-confirmation' | 'both'

function isAuthorizedServiceRole(authHeader: string, serviceRoleKey: string): boolean {
  if (!authHeader.startsWith('Bearer ')) return false
  const token = authHeader.slice(7).trim()
  if (token === serviceRoleKey) return true
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json).role === 'service_role'
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = req.headers.get('authorization') ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } })
    const serviceClient = createClient(supabaseUrl, serviceRoleKey)

    const isServiceRole = isAuthorizedServiceRole(auth, serviceRoleKey)
    const { data: { user } } = isServiceRole ? { data: { user: null } } : await userClient.auth.getUser()
    if (!isServiceRole && !user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const appointmentId = String(body?.appointmentId ?? body?.appointment_id ?? '')
    const kind = (body?.kind ?? 'both') as EmailKind
    const force = Boolean(body?.force)
    if (!appointmentId || !['staff-notification', 'client-confirmation', 'both'].includes(kind)) {
      return json({ error: 'Invalid request' }, 400)
    }

    if (!isServiceRole) {
      const { data: allowed } = await userClient.rpc('can_manage_appointment_emails', { _appointment_id: appointmentId })
      if (!allowed) return json({ error: 'Forbidden' }, 403)
    }

    const { data: appt, error: apptError } = await serviceClient
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .maybeSingle()
    if (apptError) return json({ error: apptError.message }, 500)
    if (!appt) return json({ error: 'Appointment not found' }, 404)

    const [{ data: staff }, { data: loc }, { data: apsvList }, { data: primarySvc }] = await Promise.all([
      serviceClient.from('staff_profiles').select('full_name, email').eq('id', appt.staff_id).maybeSingle(),
      serviceClient.from('locations').select('name, address, city, state').eq('id', appt.location_id).maybeSingle(),
      serviceClient.from('appointment_services').select('display_order, services(id, name)').eq('appointment_id', appointmentId).order('display_order', { ascending: true }),
      serviceClient.from('services').select('id, name').eq('id', appt.service_id).maybeSingle(),
    ])

    const serviceRows = ((apsvList ?? []) as any[]).map((r) => r.services).filter(Boolean)
    const serviceIds = serviceRows.map((s) => s.id).filter(Boolean)
    if (!serviceIds.length && primarySvc?.id) serviceIds.push(primarySvc.id)
    const baseServiceName = serviceRows.length ? serviceRows.map((s) => s.name).join(' + ') : (primarySvc?.name ?? 'appointment')
    const isTelevisit = hasTelevisit(serviceIds)
    const serviceName = isTelevisit ? `TELEVISIT — ${baseServiceName}` : baseServiceName
    const appointmentTime = new Date(appt.start_at).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles',
    })
    const origin = req.headers.get('origin') || 'https://bookrka.com'
    const clientName = `${appt.client_first_name ?? ''} ${appt.client_last_name ?? ''}`.trim()
    const sent: string[] = []

    if (kind === 'staff-notification' || kind === 'both') {
      const { data: adminRows } = await serviceClient.from('user_roles').select('user_id').eq('role', 'admin')
      const recipients = new Map<string, string>()
      if (staff?.email) recipients.set(String(staff.email).toLowerCase(), staff.full_name ?? 'Team')
      const adminIds = (adminRows ?? []).map((r: any) => r.user_id).filter(Boolean)
      if (adminIds.length) {
        const { data: adminStaff } = await serviceClient.from('staff_profiles').select('email, full_name').in('user_id', adminIds)
        for (const s of adminStaff ?? []) {
          if (s.email && !recipients.has(String(s.email).toLowerCase())) recipients.set(String(s.email).toLowerCase(), s.full_name ?? 'Team')
        }
      }
      await Promise.all([...recipients.entries()].map(([to, name]) =>
        invokeServiceFunction('send-transactional-email', {
          templateName: 'staff-booking-notification',
          recipientEmail: to,
          idempotencyKey: `${force ? 'repair-' : ''}staff-notify-${appointmentId}-${to}`,
          templateData: {
            staffName: name,
            clientName,
            clientEmail: appt.client_email,
            clientPhone: appt.client_phone,
            serviceName,
            appointmentTime,
            locationName: isTelevisit ? televisitLocationName(loc?.name) : (loc?.name ?? ''),
            reviewUrl: `${origin}/staff/appointments/${appointmentId}`,
          },
        }).then(() => sent.push(`staff:${to}`))
      ))
    }

    if (kind === 'client-confirmation' || kind === 'both') {
      const arrival = isTelevisit
        ? { address: TELEVISIT_ADDRESS_LINE, instructions: TELEVISIT_ARRIVAL_INSTRUCTIONS }
        : getLocationArrival({ city: loc?.city, name: loc?.name, address: loc?.address, state: loc?.state })
      await invokeServiceFunction('send-transactional-email', {
        templateName: 'booking-approved',
        recipientEmail: appt.client_email,
        idempotencyKey: `${force ? 'repair-' : ''}client-confirm-${appointmentId}`,
        templateData: {
          clientName: appt.client_first_name,
          serviceName,
          providerName: staff?.full_name ?? '',
          appointmentTime,
          locationAddress: arrival.address || (loc ? `${loc.address}, ${loc.city}, ${loc.state}` : ''),
          arrivalInstructions: arrival.instructions,
          manageUrl: `https://bookrka.com/booking/${appt.public_token}`,
        },
      })
      sent.push(`client:${appt.client_email}`)
    }

    return json({ ok: true, sent })
  } catch (error) {
    console.error('[resend-appointment-emails]', error)
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}