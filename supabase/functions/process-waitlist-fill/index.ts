// Triggered when an appointment is cancelled OR rescheduled (the OLD slot opens).
// Finds matching open waitlist requests and notifies them via GHL (SMS) + tags.
// Body: { appointmentId: string, slotOverride?: { serviceId, locationId, staffId, startAt } }
// If slotOverride is provided, those values are used instead of reading the
// appointment row — needed for reschedule callers so we match the freed OLD slot.
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
    const { appointmentId, slotOverride } = await req.json();
    if (!appointmentId) return json({ error: "appointmentId required" }, 400);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let serviceId: string | null = slotOverride?.serviceId ?? null;
    let locationId: string | null = slotOverride?.locationId ?? null;
    let staffId: string | null = slotOverride?.staffId ?? null;
    let startAt: string | null = slotOverride?.startAt ?? null;

    if (!serviceId || !locationId || !staffId || !startAt) {
      const { data: appt } = await supa
        .from("appointments")
        .select("id, service_id, location_id, staff_id, start_at")
        .eq("id", appointmentId)
        .maybeSingle();
      if (!appt) return json({ error: "appt not found" }, 404);
      serviceId = serviceId ?? appt.service_id;
      locationId = locationId ?? appt.location_id;
      staffId = staffId ?? appt.staff_id;
      startAt = startAt ?? appt.start_at;
    }

    const slotDate = new Date(startAt!);
    const slotDateStr = slotDate.toISOString().slice(0, 10);

    // Find matching waitlist entries (open, same service, location/staff match or wildcard, date in range)
    const { data: matches } = await supa
      .from("waitlist_requests")
      .select("*")
      .eq("status", "open")
      .eq("service_id", serviceId)
      .lte("desired_date_from", slotDateStr)
      .gte("desired_date_to", slotDateStr)
      .order("created_at", { ascending: true });

    const filtered = (matches ?? []).filter((w) => {
      if (w.location_id && w.location_id !== locationId) return false;
      if (w.staff_id && w.staff_id !== staffId) return false;
      return true;
    });

    if (filtered.length === 0) return json({ ok: true, notified: 0 });

    // Lookup service + location names for SMS context
    const [{ data: svc }, { data: loc }] = await Promise.all([
      supa.from("services").select("name").eq("id", serviceId).maybeSingle(),
      supa.from("locations").select("name, city").eq("id", locationId).maybeSingle(),
    ]);

    const friendlyTime = slotDate.toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
    });

    let notified = 0;
    for (const w of filtered) {
      try {
        await supa.functions.invoke("ghl-sync-contact", {
          body: {
            email: w.client_email,
            firstName: w.client_first_name,
            lastName: w.client_last_name,
            phone: w.client_phone,
            tags: ["rkabook", "waitlist-slot-open"],
            customFields: {
              next_appointment_time: friendlyTime,
              next_appointment_service: svc?.name ?? "",
              next_appointment_location: loc ? `${loc.name} (${loc.city})` : "",
            },
          },
        });
        await supa
          .from("waitlist_requests")
          .update({ status: "notified", notified_at: new Date().toISOString() })
          .eq("id", w.id);
        notified++;
      } catch (e) {
        console.error("waitlist notify failed", w.id, e);
      }
    }

    return json({ ok: true, notified, matched: filtered.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
