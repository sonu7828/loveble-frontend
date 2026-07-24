// Cancel an appointment from the public booking page using public_token (no auth).
// Body: { token: string; reason?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { token, reason } = await req.json();
    if (!token || typeof token !== "string" || token.length < 16) return json({ error: "Invalid token" }, 400);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: appt } = await supa.from("appointments").select("*").eq("public_token", token).maybeSingle();
    if (!appt) return json({ error: "Not found" }, 404);
    if (!["pending", "approved"].includes(appt.status)) {
      return json({ error: "This appointment cannot be cancelled." }, 400);
    }

    const hoursUntil = (new Date(appt.start_at).getTime() - Date.now()) / 3600000;
    const lateCancel = hoursUntil < 48;

    await supa.from("appointments").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", appt.id);
    await supa.from("appointment_audit_log").insert({
      appointment_id: appt.id,
      action: "cancelled",
      from_status: appt.status,
      to_status: "cancelled",
      notes: `Client self-cancel via public link${reason ? ` — ${reason}` : ""}${lateCancel ? " (within 48h)" : ""}`,
    });

    // Remove from staff/business calendar
    try { await supa.functions.invoke("google-calendar-sync", { body: { appointmentId: appt.id, action: "delete" } }); } catch {}

    // Notify matching waitlist entries
    try { await supa.functions.invoke("process-waitlist-fill", { body: { appointmentId: appt.id } }); } catch {}

    // Send cancellation emails (client confirmation + staff/admin notifications)
    try {
      const [{ data: svc }, { data: stf }, { data: loc }, { data: adminRows }] = await Promise.all([
        supa.from("services").select("name").eq("id", appt.service_id).maybeSingle(),
        supa.from("staff_profiles").select("full_name, email").eq("id", appt.staff_id).maybeSingle(),
        supa.from("locations").select("name").eq("id", appt.location_id).maybeSingle(),
        supa.from("user_roles").select("user_id").eq("role", "admin"),
      ]);
      const apptTimeStr = new Date(appt.start_at).toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
      });
      const origin = req.headers.get("origin") || "https://bookrka.com";

      // Client confirmation
      await supa.functions.invoke("send-transactional-email", {
        body: {
          templateName: "booking-cancelled",
          recipientEmail: appt.client_email,
          idempotencyKey: `cancel-client-${appt.id}`,
          templateData: {
            clientName: appt.client_first_name,
            serviceName: svc?.name ?? "your appointment",
            appointmentTime: apptTimeStr,
            providerName: stf?.full_name ?? "",
            locationName: loc?.name ?? "",
            lateCancel,
            reason: reason ?? "",
            rebookUrl: `${origin}/book`,
          },
        },
      }).catch((e) => console.error("client cancel email failed", e));

      // Staff + admins
      const recipients = new Map<string, string>();
      if (stf?.email) recipients.set(stf.email.toLowerCase(), stf.full_name ?? "Team");
      const adminIds = (adminRows ?? []).map((r: any) => r.user_id);
      if (adminIds.length) {
        const { data: adminStaff } = await supa.from("staff_profiles")
          .select("email, full_name").in("user_id", adminIds);
        for (const s of adminStaff ?? []) {
          if (s.email && !recipients.has(s.email.toLowerCase())) {
            recipients.set(s.email.toLowerCase(), s.full_name ?? "Team");
          }
        }
      }
      const reviewUrl = `${origin}/staff/appointments/${appt.id}`;
      await Promise.all([...recipients.entries()].map(([to, name]) =>
        supa.functions.invoke("send-transactional-email", {
          body: {
            templateName: "staff-cancellation-notification",
            recipientEmail: to,
            idempotencyKey: `cancel-staff-${appt.id}-${to}`,
            templateData: {
              staffName: name,
              clientName: `${appt.client_first_name} ${appt.client_last_name}`.trim(),
              clientEmail: appt.client_email,
              clientPhone: appt.client_phone,
              serviceName: svc?.name ?? "",
              appointmentTime: apptTimeStr,
              locationName: loc?.name ?? "",
              cancelledBy: "the client",
              reason: reason ?? "",
              lateCancel,
              reviewUrl,
            },
          },
        }).catch((e) => console.error("staff cancel email failed", to, e))
      ));
    } catch (e) { console.error("cancel email outer failed", e); }

    // Tag in GHL for SMS
    try {
      await supa.functions.invoke("ghl-sync-contact", {
        body: {
          email: appt.client_email,
          firstName: appt.client_first_name,
          lastName: appt.client_last_name,
          phone: appt.client_phone,
          tags: ["rkabook", "appointment-cancelled", ...(lateCancel ? ["late-cancel"] : [])],
        },
      });
    } catch {}

    return json({ ok: true, lateCancel });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
