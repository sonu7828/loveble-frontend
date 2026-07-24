// Staff-only wrapper that triggers a client-activation email.
// Direct calls to send-transactional-email require the service_role JWT,
// so this function authenticates the caller as staff/admin and then
// invokes send-transactional-email server-to-server with service-role auth.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: ok } = await supa.rpc("is_staff_or_admin", { _user_id: user.id });
    const { data: ok2 } = ok ? { data: true } : await supa.rpc("is_scheduler_or_admin", { _user_id: user.id });
    if (!ok && !ok2) return json({ error: "Forbidden" }, 403);

    const b = await req.json();
    const recipientEmail = String(b?.recipientEmail || "").trim().toLowerCase();
    const clientName = String(b?.clientName || "").trim();
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return json({ error: "Invalid email" }, 400);
    }
    const origin = req.headers.get("origin") || "https://bookrka.com";
    const activationUrl = `${origin}/client/auth?email=${encodeURIComponent(recipientEmail)}`;

    const { error } = await supa.functions.invoke("send-transactional-email", {
      body: {
        templateName: "client-activation",
        recipientEmail,
        idempotencyKey: `client-activation-${recipientEmail}-${Date.now().toString(36)}`,
        templateData: { clientName, activationUrl },
      },
    });
    if (error) return json({ error: error.message ?? "Email failed" }, 500);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
