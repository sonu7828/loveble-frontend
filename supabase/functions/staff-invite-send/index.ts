// Sends activation invitations to staff. Admin-only.
// Body: { staffId?: string; all?: boolean }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_STAFF_IDS = new Set([
  "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", // Kiem - owner/admin
]);
const SCHEDULER_STAFF_IDS = new Set([
  "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", // Patient Koala
]);

function roleFor(staffId: string): "admin" | "scheduler" | "receptionist" | "staff" {
  if (ADMIN_STAFF_IDS.has(staffId)) return "admin";
  if (SCHEDULER_STAFF_IDS.has(staffId)) return "scheduler";
  return "staff";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") ?? "";
    const supaUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await supaUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: callerRoles } = await supa.from("user_roles").select("role").eq("user_id", user.id);
    if (!(callerRoles ?? []).some((r) => r.role === "admin")) return json({ error: "Admins only" }, 403);

    const body = await req.json().catch(() => ({}));
    const { staffId, all, role: roleOverride } = body as { staffId?: string; all?: boolean; role?: "admin" | "scheduler" | "receptionist" | "staff" };
    const validRole = roleOverride && ["admin", "scheduler", "receptionist", "staff"].includes(roleOverride) ? roleOverride : null;

    let targets: any[] = [];
    if (all) {
      const { data } = await supa.from("staff_profiles").select("id, full_name, email, user_id").eq("is_active", true).is("user_id", null);
      targets = (data ?? []).filter((s: any) => s.email);
    } else if (staffId) {
      const { data } = await supa.from("staff_profiles").select("id, full_name, email, user_id").eq("id", staffId).maybeSingle();
      if (!data) return json({ error: "Staff not found" }, 404);
      if (!data.email) return json({ error: "Staff has no email" }, 400);
      targets = [data];
    } else {
      return json({ error: "staffId or all required" }, 400);
    }

    const origin = req.headers.get("origin") ?? req.headers.get("referer")?.split("/").slice(0, 3).join("/") ?? "";

    let sent = 0;
    for (const t of targets) {
      // Create or refresh invitation
      const { data: inv, error: invErr } = await supa.from("staff_invitations").insert({
        staff_id: t.id,
        email: t.email,
        role: validRole ?? roleFor(t.id),
      }).select("token").single();
      if (invErr || !inv) continue;

      const url = `${origin}/staff/activate/${inv.token}`;
      const idempotencyKey = `staff-invite-${inv.token}`;

      try {
        await supa.functions.invoke("send-transactional-email", {
          body: {
            templateName: "staff-activation",
            recipientEmail: t.email,
            idempotencyKey,
            templateData: { staffName: t.full_name, activationUrl: url },
          },
        });
        sent++;
      } catch (e) {
        console.error("invite send failed", t.email, e);
      }
    }

    return json({ sent, total: targets.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
