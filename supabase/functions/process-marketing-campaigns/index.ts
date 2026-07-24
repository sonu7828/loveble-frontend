// Cron entrypoint: triggers all active campaigns whose recurrence schedule is due.
// Picks them up from marketing_campaigns and invokes run-marketing-campaign for each.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireServiceRole } from "../_shared/require-service-role.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const denied = requireServiceRole(req, corsHeaders);
  if (denied) return denied;
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = Date.now();

    const { data: campaigns } = await supa.from("marketing_campaigns")
      .select("id, recurrence, scheduled_at, last_run_at, status")
      .eq("status", "active");

    const due: string[] = [];
    for (const c of campaigns ?? []) {
      const last = c.last_run_at ? new Date(c.last_run_at).getTime() : 0;
      const sched = c.scheduled_at ? new Date(c.scheduled_at).getTime() : null;

      if (c.recurrence === "once") {
        if (!c.last_run_at && (sched === null || sched <= now)) due.push(c.id);
      } else if (c.recurrence === "daily") {
        if (now - last >= 24 * 3600 * 1000 - 60_000) due.push(c.id);
      } else if (c.recurrence === "weekly") {
        if (now - last >= 7 * 24 * 3600 * 1000 - 60_000) due.push(c.id);
      } else if (c.recurrence === "monthly") {
        if (now - last >= 28 * 24 * 3600 * 1000 - 60_000) due.push(c.id);
      } else if (c.recurrence === "every_3_weeks") {
        // First run gated by scheduled_at; subsequent runs every 21 days.
        if (!c.last_run_at) {
          if (sched === null || sched <= now) due.push(c.id);
        } else if (now - last >= 21 * 24 * 3600 * 1000 - 60_000) {
          due.push(c.id);
        }
      }
    }

    const results: Record<string, any> = {};
    for (const id of due) {
      const { data, error } = await supa.functions.invoke("run-marketing-campaign", {
        body: { campaignId: id },
      });
      results[id] = error ? { error: error.message } : data;
    }
    return json({ ok: true, due: due.length, results });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
