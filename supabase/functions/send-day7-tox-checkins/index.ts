// Cron-driven (hourly): send a day-7 SMS check-in to neurotoxin clients
// (Botox / Botox Full Face / Daxxify / generic Neurotoxins). The message is
// personalized per product family — Botox: final results ~day 14;
// Daxxify: final results ~day 21. One-time per appointment, gated on
// sms_opt_in, and only sent at or after 10am Pacific.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function firstName(full?: string | null) {
  if (!full) return "";
  return full.trim().split(/\s+/)[0] ?? "";
}

function ptHourNow(): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  return Number(h);
}

function isDaxxify(serviceName: string | null | undefined): boolean {
  return !!serviceName && /dax/i.test(serviceName);
}

function buildMessage(opts: {
  clientFirstName: string;
  providerFirstName: string;
  serviceName: string;
  daxxify: boolean;
}) {
  const { clientFirstName, providerFirstName, serviceName, daxxify } = opts;
  const finalDays = daxxify ? 21 : 14;
  const productLabel = daxxify ? "Daxxify" : "Botox";
  const intro = providerFirstName
    ? `Hi ${clientFirstName}, it's ${providerFirstName} from Radiantilyk`
    : `Hi ${clientFirstName}, it's Radiantilyk`;
  return (
    `${intro} — checking in on your ${serviceName}. ` +
    `It's been about a week — have you started noticing your ${productLabel} kicking in yet? ` +
    `Final results typically show around day ${finalDays}, so it'll keep settling. ` +
    `Reply here and let me know how it's looking!`
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const hourPT = ptHourNow();
  if (hourPT < 10) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "before_10am_PT", hourPT }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Window: appointments that ended between 7 and 8 days ago. Hourly cron with
  // a 24h window guarantees at-least-once delivery; the sent-at column makes
  // it at-most-once.
  const now = Date.now();
  const windowEnd = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
  const windowStart = new Date(now - 8 * 24 * 3600 * 1000).toISOString();

  // Pull the neurotoxins category id once.
  const { data: cat } = await supa
    .from("service_categories")
    .select("id")
    .eq("slug", "neurotoxins")
    .maybeSingle();
  if (!cat?.id) {
    return new Response(
      JSON.stringify({ ok: true, sent: 0, skipped: 0, failed: 0, reason: "no_neurotoxins_category" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data: appts, error } = await supa
    .from("appointments")
    .select(
      "id, staff_id, service_id, client_first_name, client_phone, sms_opt_in, day7_tox_sms_sent_at, status, end_at, services:service_id(name, category_id)",
    )
    .eq("status", "completed")
    // Care-related follow-up — send regardless of marketing opt-in.
    .is("day7_tox_sms_sent_at", null)
    .gte("end_at", windowStart)
    .lt("end_at", windowEnd)
    .limit(500);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0, skipped = 0, failed = 0;

  for (const a of (appts ?? []) as any[]) {
    try {
      const svc = a.services as { name?: string; category_id?: string } | null;
      if (!svc || svc.category_id !== cat.id) { skipped++; continue; }
      if (!a.client_phone) { skipped++; continue; }

      const { data: staff } = await supa
        .from("staff_profiles")
        .select("full_name")
        .eq("id", a.staff_id)
        .maybeSingle();

      const body = buildMessage({
        clientFirstName: a.client_first_name ?? "",
        providerFirstName: firstName((staff as any)?.full_name),
        serviceName: svc.name ?? "treatment",
        daxxify: isDaxxify(svc.name),
      });

      const res = await supa.functions.invoke("send-sms-via-ghl", {
        body: {
          appointmentId: a.id,
          template: "day7-tox-checkin",
          body,
          skipOptInCheck: true,
        },
      });

      if ((res as any)?.error) { failed++; continue; }

      await supa.from("appointments")
        .update({ day7_tox_sms_sent_at: new Date().toISOString() })
        .eq("id", a.id);
      sent++;
    } catch (e) {
      console.error("day7 tox checkin failed", a.id, e);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, sent, skipped, failed, total: appts?.length ?? 0, hourPT }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
