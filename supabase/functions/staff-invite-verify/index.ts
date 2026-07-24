// Verifies a staff invitation token and returns the staff name & email if valid. Public.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") return json({ valid: false }, 400);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: inv } = await supa.from("staff_invitations").select("*").eq("token", token).maybeSingle();
    if (!inv) return json({ valid: false });
    if (inv.accepted_at) return json({ valid: false, reason: "already_used" });
    if (new Date(inv.expires_at) < new Date()) return json({ valid: false, reason: "expired" });

    const { data: staff } = await supa.from("staff_profiles").select("full_name, email").eq("id", inv.staff_id).single();
    return json({ valid: true, staffName: staff?.full_name ?? "", email: inv.email });
  } catch (e) {
    return json({ valid: false, error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
