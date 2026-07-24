// Scheduled (every 5 min) — tags GHL contacts with reminder-24h / reminder-2h
// for upcoming approved appointments, and review-request 24h after the appointment.
// Uses ghl_reminder_log to dedupe.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Window = { type: "reminder-48h" | "reminder-24h" | "reminder-2h"; minMin: number; maxMin: number };
const WINDOWS: Window[] = [
  { type: "reminder-48h", minMin: 47 * 60, maxMin: 48 * 60 + 30 },
  { type: "reminder-24h", minMin: 23 * 60, maxMin: 24 * 60 + 30 },
  { type: "reminder-2h",  minMin: 90,      maxMin: 150 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = Date.now();
    const horizon = new Date(now + 49 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date(now).toISOString();

    // Upcoming reminders (24h / 2h)
    const { data: appts, error } = await supa
      .from("appointments")
      .select("id, start_at, client_email, client_first_name, client_last_name, client_phone, service_id, staff_id, location_id, status, services(name), staff_profiles(full_name), locations(name, google_review_url)")
      .eq("status", "approved")
      .gte("start_at", nowIso)
      .lte("start_at", horizon);

    if (error) return json({ error: error.message }, 500);

    let queued = 0;
    for (const a of appts ?? []) {
      const minsUntil = (new Date(a.start_at).getTime() - now) / 60000;
      const win = WINDOWS.find(w => minsUntil >= w.minMin && minsUntil <= w.maxMin);
      if (!win) continue;

      const { data: existing } = await supa.from("ghl_reminder_log")
        .select("id").eq("appointment_id", a.id).eq("reminder_type", win.type).maybeSingle();
      if (existing) continue;

      const apptTime = new Date(a.start_at).toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
      });

      try {
        await supa.functions.invoke("ghl-sync-contact", {
          body: {
            email: a.client_email,
            firstName: a.client_first_name,
            lastName: a.client_last_name,
            phone: a.client_phone,
            tags: ["rkabook", win.type],
            customFields: {
              next_appointment_time: apptTime,
              next_appointment_service: (a as any).services?.name ?? "",
              next_appointment_staff: (a as any).staff_profiles?.full_name ?? "",
              next_appointment_location: (a as any).locations?.name ?? "",
            },
          },
        });
        await supa.from("ghl_reminder_log").insert({
          appointment_id: a.id, reminder_type: win.type,
        });
        queued++;
      } catch (e) {
        console.error("reminder sync failed", a.id, win.type, e);
      }
    }

    // Review request: 24-30h AFTER appointment end, only for completed/approved (not cancelled / no-show / denied)
    const reviewStart = new Date(now - 30 * 60 * 60 * 1000).toISOString();
    const reviewEnd = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const { data: pastAppts } = await supa
      .from("appointments")
      .select("id, end_at, client_email, client_first_name, client_last_name, client_phone, location_id, status, locations(name, google_review_url, city)")
      .in("status", ["approved", "completed"])
      .gte("end_at", reviewStart)
      .lte("end_at", reviewEnd);

    let reviewsQueued = 0;
    for (const a of pastAppts ?? []) {
      const reviewUrl = (a as any).locations?.google_review_url;
      if (!reviewUrl) continue;
      const { data: existing } = await supa.from("ghl_reminder_log")
        .select("id").eq("appointment_id", a.id).eq("reminder_type", "review-request").maybeSingle();
      if (existing) continue;
      try {
        await supa.functions.invoke("ghl-sync-contact", {
          body: {
            email: a.client_email,
            firstName: a.client_first_name,
            lastName: a.client_last_name,
            phone: a.client_phone,
            tags: ["rkabook", "review-request"],
            customFields: {
              review_url: reviewUrl,
              review_location: (a as any).locations?.name ?? "",
            },
          },
        });
        await supa.from("ghl_reminder_log").insert({
          appointment_id: a.id, reminder_type: "review-request",
        });
        reviewsQueued++;
      } catch (e) {
        console.error("review request sync failed", a.id, e);
      }
    }

    // Rebook follow-up: per-service rebook_followup_days after end_at
    // Tag: `rebook-reminder` with custom field `rebook_service`.
    let rebookQueued = 0;
    const { data: services } = await supa
      .from("services")
      .select("id, name, rebook_followup_days")
      .not("rebook_followup_days", "is", null)
      .gt("rebook_followup_days", 0);

    for (const svc of services ?? []) {
      const days = (svc as any).rebook_followup_days as number;
      const winStart = new Date(now - (days * 24 + 12) * 60 * 60 * 1000).toISOString();
      const winEnd   = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
      const { data: due } = await supa
        .from("appointments")
        .select("id, end_at, client_email, client_first_name, client_last_name, client_phone, locations(name, google_review_url)")
        .eq("service_id", svc.id)
        .in("status", ["approved", "completed"])
        .gte("end_at", winStart)
        .lte("end_at", winEnd);
      for (const a of due ?? []) {
        const { data: existing } = await supa.from("ghl_reminder_log")
          .select("id").eq("appointment_id", a.id).eq("reminder_type", "rebook-reminder").maybeSingle();
        if (existing) continue;
        try {
          await supa.functions.invoke("ghl-sync-contact", {
            body: {
              email: a.client_email,
              firstName: a.client_first_name,
              lastName: a.client_last_name,
              phone: a.client_phone,
              tags: ["rkabook", "rebook-reminder"],
              customFields: {
                rebook_service: svc.name ?? "",
                next_appointment_location: (a as any).locations?.name ?? "",
              },
            },
          });
          await supa.from("ghl_reminder_log").insert({
            appointment_id: a.id, reminder_type: "rebook-reminder",
          });
          rebookQueued++;
        } catch (e) {
          console.error("rebook reminder failed", a.id, e);
        }
      }
    }

    return json({ ok: true, processed: appts?.length ?? 0, queued, reviewsQueued, rebookQueued });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
