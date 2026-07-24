// Scheduled (every 15 min) — sends 24h and 2h SMS reminders for opted-in
// appointments via send-sms-via-ghl. Dedupes via appointments.reminder_24h_sent_at
// and appointments.reminder_2h_sent_at.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tier = { hours: number; column: "reminder_24h_sent_at" | "reminder_2h_sent_at"; template: string; minMin: number; maxMin: number };
const TIERS: Tier[] = [
  { hours: 24, column: "reminder_24h_sent_at", template: "reminder-24h", minMin: 23 * 60 + 45, maxMin: 24 * 60 + 15 },
  { hours: 2,  column: "reminder_2h_sent_at",  template: "reminder-2h",  minMin: 105,           maxMin: 135 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = Date.now();
    const results: any[] = [];
    let sent = 0;

    for (const tier of TIERS) {
      const start = new Date(now + tier.minMin * 60_000).toISOString();
      const end   = new Date(now + tier.maxMin * 60_000).toISOString();

      const { data: appts, error } = await supa
        .from("appointments")
        .select(`id, start_at, client_first_name, client_phone, sms_opt_in, ${tier.column}, locations(name, city)`)
        .eq("status", "approved")
        .eq("sms_opt_in", true)
        .is(tier.column, null)
        .gte("start_at", start)
        .lte("start_at", end);
      if (error) { results.push({ tier: tier.hours, error: error.message }); continue; }

      for (const a of appts ?? []) {
        if (!a.client_phone) continue;
        const when = new Date(a.start_at).toLocaleString("en-US", {
          weekday: "short", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
        });
        const loc: any = (a as any).locations;
        const locLabel = loc?.city ? `(${loc.city})` : "";
        const body = tier.hours === 24
          ? `Reminder: your Radiantilyk Aesthetic appointment is tomorrow at ${when} ${locLabel}.`
          : `See you soon — your Radiantilyk Aesthetic appointment is in 2 hours ${locLabel}.`;

        try {
          const res = await supa.functions.invoke("send-sms-via-ghl", {
            body: { appointmentId: a.id, template: tier.template, body },
          });
          if (!(res as any)?.error) {
            await supa.from("appointments")
              .update({ [tier.column]: new Date().toISOString() })
              .eq("id", a.id);
            sent++;
          }
        } catch (e) { console.error("reminder send failed", a.id, tier.hours, e); }
      }
    }

    return json({ ok: true, sent, results });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
