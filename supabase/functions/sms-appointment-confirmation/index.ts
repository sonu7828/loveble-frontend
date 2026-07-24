// Sends the confirmation SMS when an appointment is approved.
// Invoked from staff-update-appointment after the email confirmation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { appointmentId } = await req.json();
    if (!appointmentId) return json({ error: "appointmentId required" }, 400);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: a } = await supa.from("appointments")
      .select("id, start_at, client_first_name, client_email, client_phone, sms_opt_in, confirmation_sms_sent_at, locations(name, city)")
      .eq("id", appointmentId).maybeSingle();
    if (!a) return json({ error: "not found" }, 404);
    if (!a.sms_opt_in) return json({ skipped: true, reason: "not_opted_in" });
    if (a.confirmation_sms_sent_at) return json({ skipped: true, reason: "already_sent" });

    const when = new Date(a.start_at).toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
    });
    const loc: any = (a as any).locations;
    const locLabel = loc?.city ? `(${loc.city})` : "";
    const first = (a as any).client_first_name || "there";
    // HIPAA: do not include service/treatment names in SMS bodies (PHI minimization).
    const body = `Hi ${first}, your Radiantilyk Aesthetic appointment ${locLabel} is confirmed for ${when}. Details in your portal. 48h notice required to cancel; $200 no-show fee.`;

    const res = await supa.functions.invoke("send-sms-via-ghl", {
      body: {
        appointmentId,
        template: "appointment-confirmation",
        body,
      },
    });
    if ((res as any)?.error) return json({ error: (res as any).error.message ?? "send failed" }, 502);

    await supa.from("appointments")
      .update({ confirmation_sms_sent_at: new Date().toISOString() })
      .eq("id", appointmentId);

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
