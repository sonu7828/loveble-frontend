// Cron-driven: N days after a completed appointment, invite opted-in clients to
// upload a follow-up photo to their chart. One-time per appointment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_TEMPLATE =
  "Hi {{clientFirstName}}, it's {{providerFirstName}} at Radiantilyk. We'd love to see how you're healing — tap to upload a quick photo for your chart: {{uploadUrl}}";
const SITE_ORIGIN = Deno.env.get("PUBLIC_SITE_URL") ?? "https://bookrka.com";

const render = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
const firstName = (s?: string | null) => (s ?? "").trim().split(/\s+/)[0] ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: appts, error } = await supa
    .from("appointments")
    .select("id, staff_id, client_first_name, client_phone, updated_at, public_token, sms_opt_in")
    .eq("status", "completed")
    .eq("sms_opt_in", true)
    .is("photo_request_sent_at", null)
    .gte("updated_at", since)
    .limit(200);

  if (error) return json({ error: error.message }, 500);

  let sent = 0, skipped = 0, failed = 0;
  const now = Date.now();

  for (const a of appts ?? []) {
    try {
      if (!a.client_phone || !a.public_token) { skipped++; continue; }
      const { data: staff } = await supa.from("staff_profiles")
        .select("full_name").eq("id", a.staff_id).maybeSingle();
      const { data: tpl_row } = await supa.from("staff_message_templates")
        .select("enabled, template, delay_minutes")
        .eq("staff_id", a.staff_id).eq("message_type", "photo").maybeSingle();
      if (!staff || !tpl_row || (tpl_row as any).enabled !== true) { skipped++; continue; }
      const delayMin = (tpl_row as any).delay_minutes ?? 14 * 24 * 60;
      if (now - new Date(a.updated_at).getTime() < delayMin * 60 * 1000) { skipped++; continue; }

      const tpl = ((tpl_row as any).template as string | null) || DEFAULT_TEMPLATE;
      const body = render(tpl, {
        clientFirstName: a.client_first_name ?? "",
        providerFirstName: firstName((staff as any).full_name),
        uploadUrl: `${SITE_ORIGIN}/photos/${a.public_token}`,
      });

      const res = await supa.functions.invoke("send-sms-via-ghl", {
        body: { appointmentId: a.id, template: "post-visit-photo", body },
      });
      if ((res as any)?.error) { failed++; continue; }

      await supa.from("appointments")
        .update({ photo_request_sent_at: new Date().toISOString() })
        .eq("id", a.id);
      sent++;
    } catch (e) {
      console.error("photo request failed", a.id, e);
      failed++;
    }
  }

  return json({ ok: true, sent, skipped, failed, total: appts?.length ?? 0 });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
