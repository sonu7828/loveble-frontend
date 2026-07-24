// Cron-driven (every 15min): send a personable "checking in" SMS from the provider
// to clients the morning AFTER their checkout (sale paid). Gate: only send when
// the local time in America/Los_Angeles is >= 11:00 AM, and at least one calendar
// day after the checkout / completion. One-time per appointment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_TEMPLATE =
  "Hi {{clientFirstName}}, it's {{providerFirstName}} — how are you? Hope you're healing and resting well and just checking in on you! Let me know if you have any questions or concerns! Can't wait to see you!";

function render(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

function firstName(full?: string | null) {
  if (!full) return "";
  return full.trim().split(/\s+/)[0] ?? "";
}

// Returns the current hour (0-23) in America/Los_Angeles.
function ptHourNow(): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  return Number(h);
}

// Returns the YYYY-MM-DD date string in America/Los_Angeles for the given Date.
function ptDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Only send check-ins from 11am PT onward. Outside that window, no-op.
  const hourPT = ptHourNow();
  if (hourPT < 11) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "before_11am_PT", hourPT }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Look back only 48 hours so we never back-fill old appointments
  // (prevents mass-sends after a deploy or schema change).
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const MIN_HOURS_AFTER_EVENT = 24;
  const nowMs = Date.now();

  // Collect candidate appointment IDs from two sources:
  //  (a) sales paid in the last 48h (checkout-based)
  //  (b) appointments marked completed in the last 48h (manual completion)
  const apptIds = new Set<string>();
  const eventTsByAppt = new Map<string, number>(); // ms timestamp of paid_at / updated_at

  const { data: paidSales } = await supa
    .from("sales")
    .select("appointment_id, paid_at")
    .eq("status", "paid")
    .not("appointment_id", "is", null)
    .gte("paid_at", since)
    .limit(500);

  for (const s of (paidSales ?? []) as any[]) {
    if (!s.appointment_id || !s.paid_at) continue;
    apptIds.add(s.appointment_id);
    const t = new Date(s.paid_at).getTime();
    const prev = eventTsByAppt.get(s.appointment_id);
    if (prev == null || t < prev) eventTsByAppt.set(s.appointment_id, t);
  }

  const { data: completed } = await supa
    .from("appointments")
    .select("id, updated_at")
    .eq("status", "completed")
    .gte("updated_at", since)
    .limit(500);

  for (const a of (completed ?? []) as any[]) {
    apptIds.add(a.id);
    const t = new Date(a.updated_at).getTime();
    const prev = eventTsByAppt.get(a.id);
    if (prev == null || t < prev) eventTsByAppt.set(a.id, t);
  }


  if (apptIds.size === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, skipped: 0, failed: 0, total: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: appts, error } = await supa
    .from("appointments")
    // Post-visit check-in is service-related care follow-up — send to every
    // client who just had a visit, regardless of marketing sms_opt_in.
    .select("id, staff_id, client_first_name, client_phone, sms_opt_in, checkin_sms_sent_at")
    .in("id", Array.from(apptIds))
    .is("checkin_sms_sent_at", null)
    .limit(500);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0, skipped = 0, failed = 0;

  for (const a of appts ?? []) {
    try {
      if (!a.client_phone) { skipped++; continue; }

      // Strict: at least 24 full hours since the checkout/completion event.
      const eventTs = eventTsByAppt.get(a.id);
      if (!eventTs || (nowMs - eventTs) < MIN_HOURS_AFTER_EVENT * 60 * 60 * 1000) { skipped++; continue; }


      const { data: staff } = await supa
        .from("staff_profiles")
        .select("full_name")
        .eq("id", a.staff_id)
        .maybeSingle();
      const { data: tpl_row } = await supa
        .from("staff_message_templates")
        .select("enabled, template")
        .eq("staff_id", a.staff_id)
        .eq("message_type", "checkin")
        .maybeSingle();

      // Default: opt-in (enabled) when no row exists yet.
      if (tpl_row && (tpl_row as any).enabled === false) { skipped++; continue; }
      if (!staff) { skipped++; continue; }

      const tpl = ((tpl_row as any)?.template as string | null) || DEFAULT_TEMPLATE;
      const body = render(tpl, {
        clientFirstName: a.client_first_name ?? "",
        providerFirstName: firstName((staff as any).full_name),
      });

      const res = await supa.functions.invoke("send-sms-via-ghl", {
        body: {
          appointmentId: a.id,
          template: "post-visit-checkin",
          body,
          skipOptInCheck: true,
        },
      });

      if ((res as any)?.error) {
        failed++;
        continue;
      }

      await supa.from("appointments")
        .update({ checkin_sms_sent_at: new Date().toISOString() })
        .eq("id", a.id);
      sent++;
    } catch (e) {
      console.error("checkin send failed", a.id, e);
      failed++;
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, skipped, failed, total: appts?.length ?? 0, hourPT }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
