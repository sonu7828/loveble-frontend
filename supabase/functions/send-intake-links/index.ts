// Sends pre-visit intake / follow-up client assessment links.
//
// Modes:
//   - body { appointmentId } -> force send for that appointment (used immediately
//     after a booking is created or approved, so the client gets the assessment
//     right away).
//   - body { mode: "resend" } -> manual resend for all approved appts with an
//     incomplete intake (used from the staff intake dashboard).
//   - default (cron, runs every 30 min) -> send the 48h and 24h pre-appointment
//     reminders. Each tier only fires once per appointment, and only if the
//     intake is still incomplete.
//
// Every send goes out as email AND SMS when contact info is on file.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PUBLIC_SITE_URL = "https://bookrka.com";

type Tier = "immediate" | "48h" | "24h" | "manual";

type Appt = {
  id: string;
  public_token: string | null;
  client_first_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  start_at: string | null;
  intake_completed_at: string | null;
  intake_sent_at: string | null;
  intake_send_count: number | null;
  intake_reminder_48h_sent_at?: string | null;
  intake_reminder_24h_sent_at?: string | null;
  services?: { name?: string } | null;
};

const SELECT_COLS =
  "id, public_token, client_first_name, client_email, client_phone, start_at," +
  " intake_completed_at, intake_sent_at, intake_send_count," +
  " intake_reminder_48h_sent_at, intake_reminder_24h_sent_at, services(name)";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let only: string | null = null;
  let mode: "default" | "resend" | "force" = "default";
  try {
    const body = await req.json();
    if (body?.appointmentId && typeof body.appointmentId === "string") {
      only = body.appointmentId;
      mode = "force";
    } else if (body?.mode === "resend") {
      mode = "resend";
    }
  } catch { /* cron payload */ }

  const now = Date.now();

  const buckets: { tier: Tier; column: keyof Appt; start: string; end: string }[] = [];
  if (mode === "default") {
    // 30-min cron cadence; use ±15 min window so each appt hits exactly once.
    const winMs = 15 * 60_000;
    buckets.push({
      tier: "24h",
      column: "intake_reminder_24h_sent_at",
      start: new Date(now + 24 * 3600_000 - winMs).toISOString(),
      end: new Date(now + 24 * 3600_000 + winMs).toISOString(),
    });
  }

  // Collect the appointments to process along with the tier that triggered them.
  const jobs: { appt: Appt; tier: Tier; column?: keyof Appt }[] = [];

  if (only) {
    const { data } = await supa
      .from("appointments")
      .select(SELECT_COLS)
      .eq("id", only)
      .limit(1);
    for (const a of (data ?? []) as any as Appt[]) {
      jobs.push({ appt: a, tier: mode === "force" ? "immediate" : "manual" });
    }
  } else if (mode === "resend") {
    // Manual re-send of everyone with an incomplete intake and a future appointment.
    const { data } = await supa
      .from("appointments")
      .select(SELECT_COLS)
      .in("status", ["approved"])
      .is("intake_completed_at", null)
      .gte("start_at", new Date(now).toISOString())
      .limit(500);
    for (const a of (data ?? []) as any as Appt[]) {
      jobs.push({ appt: a, tier: "manual" });
    }
  } else {
    for (const b of buckets) {
      const query = supa
        .from("appointments")
        .select(SELECT_COLS)
        .in("status", ["approved"])
        .is("intake_completed_at", null)
        .is(b.column as string, null)
        .gte("start_at", b.start)
        .lt("start_at", b.end)
        .limit(200);
      const { data } = await query;
      for (const a of (data ?? []) as any as Appt[]) {
        jobs.push({ appt: a, tier: b.tier, column: b.column });
      }
    }
  }

  // Dedupe by appointment id per tier
  const seen = new Set<string>();
  const dedupedJobs = jobs.filter(({ appt, tier }) => {
    const k = `${appt.id}:${tier}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  let sent = 0, skipped = 0, failed = 0;
  const results: any[] = [];

  for (const { appt: a, tier, column } of dedupedJobs) {
    try {
      if (!a.public_token) { skipped++; continue; }
      if (!a.client_email && !a.client_phone) { skipped++; continue; }

      const apptTime = a.start_at
        ? new Date(a.start_at).toLocaleString("en-US", {
            weekday: "short", month: "short", day: "numeric",
            hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
          })
        : "your upcoming visit";
      const intakeUrl = `${PUBLIC_SITE_URL}/intake/${a.public_token}`;
      const serviceName = (a.services as any)?.name ?? "your treatment";
      const first = a.client_first_name ?? "";
      const idemBase = `intake-${a.id}-${tier}`;
      const nextCount = (a.intake_send_count ?? 0) + 1;

      let emailOk = true;
      let smsOk = true;

      // Email
      if (a.client_email) {
        const res = await supa.functions.invoke("send-transactional-email", {
          body: {
            templateName: "pre-visit-intake",
            recipientEmail: a.client_email,
            idempotencyKey: `${idemBase}-email-${nextCount}`,
            templateData: {
              clientFirstName: first,
              serviceName,
              appointmentTime: apptTime,
              intakeUrl,
              reminderTier: tier,
            },
          },
        });
        if ((res as any)?.error) emailOk = false;
      }

      // SMS
      if (a.client_phone) {
        const smsBody =
          tier === "immediate" || tier === "manual"
            ? `Hi ${first || "there"}, this is Radiantilyk — please complete your pre-visit assessment before your ${serviceName} appointment on ${apptTime}: ${intakeUrl}`
            : `Hi ${first || "there"}, reminder from Radiantilyk: your ${serviceName} appointment is tomorrow (${apptTime}). Please complete your pre-visit assessment here: ${intakeUrl}`;
        try {
          const res = await supa.functions.invoke("send-sms-via-ghl", {
            body: {
              appointmentId: a.id,
              template: `intake-${tier}`,
              body: smsBody,
              skipOptInCheck: true,
            },
          });
          if ((res as any)?.error) smsOk = false;
        } catch (e) {
          console.error("intake sms failed", a.id, tier, e);
          smsOk = false;
        }
      }

      if (!emailOk && !smsOk) { failed++; continue; }

      const update: Record<string, any> = {
        intake_sent_at: a.intake_sent_at ?? new Date().toISOString(),
        intake_last_sent_at: new Date().toISOString(),
        intake_send_count: nextCount,
      };
      if (column) update[column as string] = new Date().toISOString();

      await supa.from("appointments").update(update).eq("id", a.id);
      sent++;
      results.push({ appointmentId: a.id, tier, emailOk, smsOk });
    } catch (e) {
      console.error("intake send failed", a.id, tier, e);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, mode, sent, skipped, failed, total: dedupedJobs.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
