// Admin-only: send client-activation invites to all clients who have NOT
// claimed a portal account yet. Each send is an individual 1:1 transactional
// email (queued + retried by the email queue) — not a marketing blast.
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
    const { data: isAdmin } = await supa.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) return json({ error: "Admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const dryRun = !!body?.dryRun;
    const limit = Math.min(Number(body?.limit ?? 1000), 5000);

    // Collect candidate emails from appointments + imported_clients
    const candidates = new Map<string, string>(); // email -> first_name

    const { data: appts } = await supa.from("appointments")
      .select("client_email, client_first_name")
      .not("client_email", "is", null)
      .limit(10000);
    for (const a of appts ?? []) {
      const e = (a.client_email || "").trim().toLowerCase();
      if (!e) continue;
      if (!candidates.has(e)) candidates.set(e, (a.client_first_name || "").trim());
    }

    const { data: imp } = await supa.from("imported_clients")
      .select("email, first_name")
      .limit(10000);
    for (const i of imp ?? []) {
      const e = (i.email || "").trim().toLowerCase();
      if (!e) continue;
      if (!candidates.has(e)) candidates.set(e, (i.first_name || "").trim());
    }

    // Existing auth users — page through admin list
    const claimed = new Set<string>();
    let page = 1;
    for (;;) {
      const { data, error } = await supa.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return json({ error: error.message }, 500);
      for (const u of data.users) {
        const e = (u.email || "").trim().toLowerCase();
        if (e) claimed.add(e);
      }
      if (!data.users.length || data.users.length < 1000) break;
      page++;
      if (page > 50) break;
    }

    // Suppressed emails — never send to those
    const { data: supp } = await supa.from("suppressed_emails").select("email");
    const suppressed = new Set((supp ?? []).map((r: any) => (r.email || "").trim().toLowerCase()));

    const targets: { email: string; first_name: string }[] = [];
    for (const [email, first_name] of candidates) {
      if (claimed.has(email)) continue;
      if (suppressed.has(email)) continue;
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) continue;
      targets.push({ email, first_name });
      if (targets.length >= limit) break;
    }

    if (dryRun) {
      return json({
        ok: true,
        dryRun: true,
        candidates: candidates.size,
        claimed: claimed.size,
        suppressed: suppressed.size,
        toInvite: targets.length,
      });
    }

    // Send individually with small throttle. Idempotency key is stable per
    // email so accidental re-runs in the same week are deduped by the queue.
    const week = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
    let sent = 0, failed = 0;
    const origin = req.headers.get("origin") || "https://bookrka.com";
    for (const t of targets) {
      const activationUrl = `${origin}/client/auth?email=${encodeURIComponent(t.email)}`;
      const { error } = await supa.functions.invoke("send-transactional-email", {
        body: {
          templateName: "client-activation",
          recipientEmail: t.email,
          idempotencyKey: `client-activation-bulk-${week}-${t.email}`,
          templateData: { clientName: t.first_name, activationUrl },
        },
      });
      if (error) failed++; else sent++;
      // tiny throttle so we don't slam the API
      await new Promise((r) => setTimeout(r, 60));
    }

    return json({ ok: true, attempted: targets.length, sent, failed, candidates: candidates.size, claimed: claimed.size });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
