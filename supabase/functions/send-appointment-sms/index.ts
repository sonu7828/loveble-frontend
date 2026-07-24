// Ad-hoc SMS: staff sends a custom message to a client tied to an appointment.
// Requires staff JWT. Normally gated on appointment.sms_opt_in; staff may
// override with explicit verbal-consent confirmation (overrideOptIn=true).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await userClient.auth.getUser();
    const user = ures?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
    const ok = (roles ?? []).some((r: any) => ["admin", "staff", "scheduler", "receptionist"].includes(r.role));
    if (!ok) return json({ error: "forbidden" }, 403);

    const { appointmentId, message, overrideOptIn } = await req.json();
    if (!appointmentId || !message || typeof message !== "string") return json({ error: "appointmentId and message required" }, 400);
    if (message.length > 320) return json({ error: "message too long (max 320 chars)" }, 400);

    const supa = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const res = await supa.functions.invoke("send-sms-via-ghl", {
      body: {
        appointmentId,
        template: overrideOptIn ? "ad-hoc-override" : "ad-hoc",
        body: message.trim(),
        createdBy: user.id,
        skipOptInCheck: !!overrideOptIn,
      },
    });
    if ((res as any)?.error) return json({ error: (res as any).error.message ?? "send failed" }, 502);
    const payload = (res as any)?.data ?? {};
    return json(payload);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
