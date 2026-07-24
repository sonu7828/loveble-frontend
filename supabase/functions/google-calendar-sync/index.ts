// Creates / updates / deletes a Google Calendar event for an appointment using the
// Lovable connector gateway, on a SHARED business calendar (configured in app_settings).
// Body:
//   { appointmentId: string }                — sync (create or update)
//   { appointmentId: string, action: "delete" } — remove from calendar
//   { backfill: true }                       — sync all approved-but-unsynced appts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { invokeServiceFunction } from "../_shared/function-invoke.ts";
import { getValidStaffAccessToken } from "../_shared/google-oauth-token.ts";
import { hasTelevisit, televisitLocationName, TELEVISIT_LABEL } from "../_shared/televisit.ts";

// Staff who should ALWAYS receive a copy of every approved appointment on
// their personal Google Calendar (in addition to the assigned provider).
const ALWAYS_SYNC_STAFF_IDS = [
  "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", // Kiem Vukadinovic (Owner / Injector)
  "fe55c0d9-8ee4-4683-a8ab-9efc0de8ba56", // Jonni Carter (Front Desk)
];
const GOOGLE_API = "https://www.googleapis.com/calendar/v3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

function parseJwtRole(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const payload = authHeader.slice(7).split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).role ?? null;
  } catch { return null; }
}

function isServiceRoleRequest(req: Request): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? "";
  if (serviceKey && auth === `Bearer ${serviceKey}`) return true;
  if (serviceKey && apikey === serviceKey) return true;
  if (parseJwtRole(auth) === "service_role") return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("authorization");
    const isService = isServiceRoleRequest(req);
    if (!isService) {
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader ?? "" } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      const { data: priv } = await supa.rpc("is_scheduler_or_admin", { _user_id: user.id });
      const { data: staffRole } = await supa.rpc("is_staff_or_admin", { _user_id: user.id });
      if (!priv && !staffRole) return json({ error: "Forbidden" }, 403);
    }
    const body = await req.json().catch(() => ({}));

    if (body.backfill) {
      const { data: appts } = await supa.from("appointments")
        .select("id").eq("status", "approved").is("google_event_owner_id", null).limit(100);
      const results: any[] = [];
      for (const a of appts ?? []) {
        results.push({ id: a.id, ...(await syncOne(supa, a.id)) });
      }
      return json({ ok: true, synced: results });
    }

    if (!body.appointmentId) return json({ error: "Missing appointmentId" }, 400);
    if (body.action === "delete") return json(await deleteOne(supa, body.appointmentId));
    return json(await syncOne(supa, body.appointmentId));
  } catch (e) {
    console.error("[google-calendar-sync]", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function gcalHeaders() {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GCAL_KEY = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
  if (!LOVABLE_API_KEY || !GCAL_KEY) return null;
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GCAL_KEY,
    "Content-Type": "application/json",
  };
}

async function getCalendarId(supa: any) {
  const { data: settings } = await supa.from("app_settings").select("shared_google_calendar_id").eq("id", 1).single();
  return settings?.shared_google_calendar_id || "primary";
}

async function syncOne(supa: any, appointmentId: string) {
  const headers = gcalHeaders();
  if (!headers) return { skipped: true, reason: "calendar_not_connected" };

  const { data: appt } = await supa.from("appointments").select("*").eq("id", appointmentId).single();
  if (!appt) return { error: "Not found" };

  // Don't keep finalized statuses on the calendar — clean up if synced previously.
  if (["cancelled", "denied", "no_show"].includes(appt.status)) {
    if (appt.google_event_owner_id) return await deleteOne(supa, appointmentId);
    return { skipped: true, reason: `status_${appt.status}` };
  }

  const calendarId = await getCalendarId(supa);

  const [{ data: svc }, { data: staff }, { data: loc }, { data: apsv }, { data: settings }] = await Promise.all([
    supa.from("services").select("name").eq("id", appt.service_id).single(),
    supa.from("staff_profiles").select("full_name, email, calendar_email").eq("id", appt.staff_id).single(),
    supa.from("locations").select("name, address, city, state").eq("id", appt.location_id).single(),
    supa.from("appointment_services")
      .select("display_order, service_id, services(name)")
      .eq("appointment_id", appointmentId)
      .order("display_order", { ascending: true }),
    supa.from("app_settings").select("owner_email, receptionist_email").eq("id", 1).maybeSingle(),
  ]);

  const serviceNames = ((apsv ?? []) as any[])
    .map((r) => r.services?.name)
    .filter((n: any): n is string => !!n);
  const bookedServiceIds = ((apsv ?? []) as any[]).map((r) => r.service_id);
  if (bookedServiceIds.length === 0 && appt.service_id) bookedServiceIds.push(appt.service_id);
  const isTelevisit = hasTelevisit(bookedServiceIds);

  const baseLabel = serviceNames.length > 0
    ? serviceNames.join(" + ")
    : (svc?.name ?? "Appointment");
  const combinedServiceLabel = isTelevisit ? `${TELEVISIT_LABEL}: ${baseLabel}` : baseLabel;

  const event = {
    summary: `${isTelevisit ? "[TELEVISIT] " : ""}${baseLabel} — ${appt.client_first_name} ${appt.client_last_name}`,
    description: [
      isTelevisit ? "** TELEVISIT — Virtual visit conducted by phone/video **" : null,
      `Provider: ${staff?.full_name ?? "—"}`,
      `Client: ${appt.client_first_name} ${appt.client_last_name}`,
      `Email: ${appt.client_email}`,
      `Phone: ${appt.client_phone}`,
      serviceNames.length > 1 ? `Services: ${serviceNames.join(", ")}` : null,
      appt.client_notes ? `Notes: ${appt.client_notes}` : null,
    ].filter(Boolean).join("\n"),
    location: isTelevisit
      ? televisitLocationName(loc?.name)
      : (loc ? `${loc.name}, ${loc.address}, ${loc.city}, ${loc.state}` : undefined),
    start: { dateTime: appt.start_at },
    end: { dateTime: appt.end_at },
    reminders: { useDefault: true },
  };


  const existingId = appt.google_event_owner_id as string | null;

  // PATCH first if we have an event id; on 404/410, fall back to CREATE so
  // a deleted-from-Google event doesn't leave the booking permanently unsynced.
  let res: Response | null = null;
  let action: "create" | "update" = existingId ? "update" : "create";
  if (existingId) {
    const url = `${GATEWAY}/calendars/${encodeURIComponent(calendarId)}/events/${existingId}`;
    res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(event) });
    if (res.status === 404 || res.status === 410) {
      console.warn("[gcal] existing event missing, recreating", existingId);
      res = null;
      action = "create";
    }
  }
  if (!res) {
    const url = `${GATEWAY}/calendars/${encodeURIComponent(calendarId)}/events`;
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(event) });
  }

  if (!res.ok) {
    const text = await res.text();
    console.error("gcal error", res.status, text);
    return { error: "Calendar API error", status: res.status, detail: text.slice(0, 300) };
  }
  const created = await res.json();

  // Bump calendar sequence so any ICS recipients see this as an update.
  const updates: any = { calendar_sequence: (appt.calendar_sequence ?? 0) + 1 };
  if (action === "create" || appt.google_event_owner_id !== created.id) {
    updates.google_event_owner_id = created.id;
  }
  await supa.from("appointments").update(updates).eq("id", appointmentId);

  // Notify provider (personal calendar email or login email), owner, and
  // receptionist so the appointment lands on every internal calendar.
  const providerEmail = staff?.calendar_email || staff?.email;
  const recipients = [
    providerEmail ? { email: providerEmail, name: staff?.full_name ?? "Provider" } : null,
    settings?.owner_email ? { email: settings.owner_email, name: "Owner" } : null,
    settings?.receptionist_email ? { email: settings.receptionist_email, name: "Reception" } : null,
  ].filter(Boolean) as { email: string; name: string }[];
  const seen = new Set<string>();
  for (const r of recipients) {
    const key = r.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      await sendStaffIcs(supa, {
        appointmentId,
        sequence: updates.calendar_sequence,
        method: "REQUEST",
        toEmail: r.email,
        staffName: r.name,
        clientName: `${appt.client_first_name} ${appt.client_last_name}`,
        clientPhone: appt.client_phone,
        clientEmail: appt.client_email,
        serviceName: combinedServiceLabel,
        startAt: appt.start_at,
        endAt: appt.end_at,
        locationName: isTelevisit ? televisitLocationName(loc?.name) : (loc?.name ?? ""),
        locationAddress: isTelevisit ? "Televisit — phone/video" : (loc ? `${loc.address}, ${loc.city}, ${loc.state}` : ""),
      });
    } catch (e) { console.error("ics send failed for", r.email, e); }
  }

  // Push the event into each individual staff member's personal Google
  // Calendar (provider + always-sync staff like Kiem and Jonni) using their
  // own OAuth token, so the appointment lands on every internal calendar.
  try {
    await syncPersonalCalendars(supa, appointmentId, appt.staff_id, event);
  } catch (e) {
    console.error("[gcal] personal calendar sync failed", (e as Error).message);
  }

  return { ok: true, eventId: created.id, action, sequence: updates.calendar_sequence };
}

async function syncPersonalCalendars(
  supa: any,
  appointmentId: string,
  providerStaffId: string | null,
  event: Record<string, unknown>,
) {
  const staffIds = Array.from(new Set([
    ...(providerStaffId ? [providerStaffId] : []),
    ...ALWAYS_SYNC_STAFF_IDS,
  ]));
  const { data: existingRows } = await supa
    .from("appointment_staff_calendar_events")
    .select("staff_id, google_event_id, calendar_id")
    .eq("appointment_id", appointmentId);
  const existingByStaff = new Map<string, { id: string; calendarId: string }>();
  for (const r of (existingRows ?? []) as any[]) {
    existingByStaff.set(r.staff_id, { id: r.google_event_id, calendarId: r.calendar_id });
  }

  for (const staffId of staffIds) {
    try {
      const tok = await getValidStaffAccessToken(supa, staffId);
      if (!tok) {
        console.log(`[gcal] staff ${staffId} not connected — skipping personal sync`);
        continue;
      }
      const auth = { Authorization: `Bearer ${tok.token}`, "Content-Type": "application/json" };
      const existing = existingByStaff.get(staffId);
      let res: Response | null = null;
      let eventId = existing?.id;
      if (existing) {
        const url = `${GOOGLE_API}/calendars/${encodeURIComponent(existing.calendarId)}/events/${existing.id}`;
        res = await fetch(url, { method: "PATCH", headers: auth, body: JSON.stringify(event) });
        if (res.status === 404 || res.status === 410) res = null; // recreate
      }
      if (!res) {
        const url = `${GOOGLE_API}/calendars/${encodeURIComponent(tok.calendarId)}/events`;
        res = await fetch(url, { method: "POST", headers: auth, body: JSON.stringify(event) });
      }
      if (!res.ok) {
        console.warn(`[gcal] personal sync failed for ${staffId}`, res.status, (await res.text()).slice(0, 200));
        continue;
      }
      const created = await res.json();
      eventId = created.id;
      await supa.from("appointment_staff_calendar_events").upsert({
        appointment_id: appointmentId,
        staff_id: staffId,
        google_event_id: eventId,
        calendar_id: tok.calendarId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "appointment_id,staff_id" });
    } catch (e) {
      console.warn(`[gcal] personal sync error for ${staffId}`, (e as Error).message);
    }
  }
}

async function deletePersonalCalendars(supa: any, appointmentId: string) {
  const { data: rows } = await supa
    .from("appointment_staff_calendar_events")
    .select("staff_id, google_event_id, calendar_id")
    .eq("appointment_id", appointmentId);
  for (const r of (rows ?? []) as any[]) {
    try {
      const tok = await getValidStaffAccessToken(supa, r.staff_id);
      if (!tok) continue;
      const url = `${GOOGLE_API}/calendars/${encodeURIComponent(r.calendar_id)}/events/${r.google_event_id}`;
      const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${tok.token}` } });
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        console.warn(`[gcal] personal delete failed for ${r.staff_id}`, res.status);
      }
    } catch (e) {
      console.warn(`[gcal] personal delete error for ${r.staff_id}`, (e as Error).message);
    }
  }
  await supa.from("appointment_staff_calendar_events").delete().eq("appointment_id", appointmentId);
}

async function deleteOne(supa: any, appointmentId: string) {
  const headers = gcalHeaders();
  const { data: appt } = await supa.from("appointments").select("*").eq("id", appointmentId).single();
  if (!appt) return { error: "Not found" };
  if (!appt.google_event_owner_id) return { skipped: true, reason: "no_event" };
  if (!headers) return { skipped: true, reason: "calendar_not_connected" };
  const calendarId = await getCalendarId(supa);
  const url = `${GATEWAY}/calendars/${encodeURIComponent(calendarId)}/events/${appt.google_event_owner_id}`;
  const res = await fetch(url, { method: "DELETE", headers });
  // 404/410 = already gone — treat as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text();
    console.error("gcal delete error", res.status, text);
    return { error: "Calendar API delete error", status: res.status, detail: text.slice(0, 300) };
  }
  const newSeq = (appt.calendar_sequence ?? 0) + 1;
  await supa.from("appointments")
    .update({ google_event_owner_id: null, calendar_sequence: newSeq })
    .eq("id", appointmentId);

  // Send CANCEL ICS to provider, owner, and receptionist.
  const { data: staff } = await supa.from("staff_profiles").select("full_name, email, calendar_email").eq("id", appt.staff_id).single();
  const { data: svc } = await supa.from("services").select("name").eq("id", appt.service_id).single();
  const { data: loc } = await supa.from("locations").select("name, address, city, state").eq("id", appt.location_id).single();
  const { data: settings } = await supa.from("app_settings").select("owner_email, receptionist_email").eq("id", 1).maybeSingle();
  const providerEmail = staff?.calendar_email || staff?.email;
  const recipients = [
    providerEmail ? { email: providerEmail, name: staff?.full_name ?? "Provider" } : null,
    settings?.owner_email ? { email: settings.owner_email, name: "Owner" } : null,
    settings?.receptionist_email ? { email: settings.receptionist_email, name: "Reception" } : null,
  ].filter(Boolean) as { email: string; name: string }[];
  const seen = new Set<string>();
  for (const r of recipients) {
    const key = r.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      await sendStaffIcs(supa, {
        appointmentId,
        sequence: newSeq,
        method: "CANCEL",
        toEmail: r.email,
        staffName: r.name,
        clientName: `${appt.client_first_name} ${appt.client_last_name}`,
        clientPhone: appt.client_phone,
        clientEmail: appt.client_email,
        serviceName: svc?.name ?? "Appointment",
        startAt: appt.start_at,
        endAt: appt.end_at,
        locationName: loc?.name ?? "",
        locationAddress: loc ? `${loc.address}, ${loc.city}, ${loc.state}` : "",
      });
    } catch (e) { console.error("ics cancel failed for", r.email, e); }
  }
  try { await deletePersonalCalendars(supa, appointmentId); } catch (e) { console.error("personal delete failed", (e as Error).message); }
  return { ok: true, deleted: true };
}

interface IcsArgs {
  appointmentId: string; sequence: number; method: "REQUEST" | "CANCEL";
  toEmail: string; staffName: string; clientName: string; clientPhone: string; clientEmail: string;
  serviceName: string; startAt: string; endAt: string; locationName: string; locationAddress: string;
}

async function sendStaffIcs(supa: any, a: IcsArgs) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(a.startAt);
  const end = new Date(a.endAt);
  const status = a.method === "CANCEL" ? "CANCELLED" : "CONFIRMED";
  const summary = `${a.method === "CANCEL" ? "[CANCELLED] " : ""}${a.serviceName} — ${a.clientName}`;
  const where = [a.locationName, a.locationAddress].filter(Boolean).join(", ");
  const desc = [
    `Client: ${a.clientName}`,
    `Phone: ${a.clientPhone}`,
    `Email: ${a.clientEmail}`,
  ].join("\\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Radiantilyk Aesthetic//Staff Invite//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${a.method}`,
    "BEGIN:VEVENT",
    `UID:${a.appointmentId}@bookrka.com`,
    `SEQUENCE:${a.sequence}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${where}`,
    `STATUS:${status}`,
    `ORGANIZER;CN=Radiantilyk Aesthetic:mailto:noreply@bookrka.com`,
    `ATTENDEE;CN=${a.staffName};RSVP=FALSE:mailto:${a.toEmail}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  // Upload ICS to private bucket and create a signed URL for the email link
  const path = `staff/${a.appointmentId}-${a.sequence}-${a.method.toLowerCase()}.ics`;
  await supa.storage.from("calendar-invites").upload(path, new Blob([ics], { type: "text/calendar" }),
    { upsert: true, contentType: "text/calendar" });
  const { data: signed } = await supa.storage.from("calendar-invites").createSignedUrl(path, 60 * 60 * 24 * 365);
  const icsUrl = signed?.signedUrl ?? "";

  await invokeServiceFunction("send-transactional-email", {
    templateName: "staff-calendar-update",
    recipientEmail: a.toEmail,
    idempotencyKey: `staff-cal-${a.appointmentId}-${a.sequence}-${a.method}`,
    templateData: {
      staffName: a.staffName,
      method: a.method,
      clientName: a.clientName,
      clientPhone: a.clientPhone,
      clientEmail: a.clientEmail,
      serviceName: a.serviceName,
      appointmentTime: start.toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
      }),
      locationName: a.locationName,
      icsUrl,
    },
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
