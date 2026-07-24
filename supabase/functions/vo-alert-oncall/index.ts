// VO alert blast — notify on-call NPs by email (Brevo) when a VO protocol starts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const BREVO_KEY = Deno.env.get("BREVO_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { run_id, client_email, client_name, region, product } = body ?? {};
    if (!run_id) return json({ error: "run_id required" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find NPs to notify (all NPs as fallback)
    const { data: roles } = await sb.from("user_roles").select("user_id").eq("role", "nurse_practitioner");
    const npIds = (roles ?? []).map((r: any) => r.user_id);
    const { data: profiles } = await sb
      .from("staff_profiles")
      .select("full_name, work_email, phone, user_id")
      .in("user_id", npIds.length ? npIds : ["00000000-0000-0000-0000-000000000000"]);

    const recipients = (profiles ?? [])
      .map((p: any) => ({ email: p.work_email, name: p.full_name }))
      .filter((r: any) => !!r.email);

    if (recipients.length === 0) {
      return json({ ok: true, notified: 0, note: "No NPs with email on file" });
    }

    const subject = `🚨 VO suspected — ${client_name || client_email}`;
    const html = `
      <h2>Vascular occlusion protocol started</h2>
      <p><b>Client:</b> ${escapeHtml(client_name || client_email)}</p>
      ${region ? `<p><b>Region:</b> ${escapeHtml(region)}</p>` : ""}
      ${product ? `<p><b>Product:</b> ${escapeHtml(product)}</p>` : ""}
      <p><b>Started:</b> ${new Date().toLocaleString()}</p>
      <p>Open the live protocol checklist in the staff app immediately.</p>
    `;

    if (LOVABLE_API_KEY && BREVO_KEY) {
      await fetch(`${GATEWAY_URL}/smtp/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": BREVO_KEY,
        },
        body: JSON.stringify({
          sender: { name: "Radiantilyk Safety", email: "no-reply@bookrka.com" },
          to: recipients,
          subject,
          htmlContent: html,
        }),
      });
    }

    // Mark notified
    await sb.from("vo_protocol_runs").update({
      lead_np_user_id: profiles?.[0]?.user_id ?? null,
    }).eq("id", run_id);

    return json({ ok: true, notified: recipients.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
