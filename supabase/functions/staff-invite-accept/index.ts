// Accepts a staff invitation. Creates the auth user, links the staff profile, assigns the role.
// Body: { token: string; password: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { token, password } = await req.json();
    if (!token || !password || typeof password !== "string" || password.length < 8) {
      return json({ error: "Invalid input" }, 400);
    }
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: inv } = await supa.from("staff_invitations").select("*").eq("token", token).maybeSingle();
    if (!inv) return json({ error: "Invalid invitation" }, 400);
    if (inv.accepted_at) return json({ error: "Already used" }, 400);
    if (new Date(inv.expires_at) < new Date()) return json({ error: "Expired" }, 400);

    // Create or fetch user
    let userId: string | null = null;
    const { data: created, error: cErr } = await supa.auth.admin.createUser({
      email: inv.email,
      password,
      email_confirm: true,
    });
    if (cErr) {
      // If user already exists, look them up
      const { data: list } = await supa.auth.admin.listUsers();
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === inv.email.toLowerCase());
      if (!existing) return json({ error: cErr.message }, 400);
      userId = existing.id;
      // Update their password so they can sign in
      await supa.auth.admin.updateUserById(existing.id, { password });
    } else {
      userId = created.user!.id;
    }

    // Link staff profile
    await supa.from("staff_profiles").update({ user_id: userId }).eq("id", inv.staff_id);

    // Assign role (and 'staff' too for specialized staff roles so every invited team
    // member can pass the base staff-portal gate after activation).
    const rolesToInsert: { user_id: string; role: string }[] = [{ user_id: userId!, role: inv.role }];
    if (["admin", "scheduler", "receptionist", "nurse_practitioner"].includes(inv.role)) {
      rolesToInsert.push({ user_id: userId!, role: "staff" });
    }
    for (const r of rolesToInsert) {
      await supa.from("user_roles").upsert(r, { onConflict: "user_id,role", ignoreDuplicates: true });
    }

    // Mark invitation accepted
    await supa.from("staff_invitations").update({ accepted_at: new Date().toISOString() }).eq("token", token);

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
