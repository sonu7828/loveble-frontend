// Cron-driven: ~48 hours after a completed appointment, send a one-time SMS asking
// for a Google review. First-time reviewers get a unique 20% off promo code minted
// just for them and included in the message.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_TEMPLATE =
  "Hey {{clientFirstName}}, it's the team at Radiantilyk Aesthetic! It was lovely seeing you. If you don't mind sharing a quick rating on your experience, we'd really appreciate it: {{reviewUrl}}{{firstReviewPerk}}";

const FIRST_REVIEW_PERK_TEMPLATE =
  " And since this is your first review with us, here's 20% off your next appointment — use code {{promoCode}} at checkout. Thank you!";

const SITE_ORIGIN = Deno.env.get("PUBLIC_SITE_URL") ?? "https://bookrka.com";

function render(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}
function firstName(full?: string | null) {
  return (full ?? "").trim().split(/\s+/)[0] ?? "";
}

// Generate a short, readable promo code suffix (no ambiguous chars).
function randomSuffix(len = 5): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

// Mint a unique promo code for this client. Returns the code string, or null on failure.
async function mintFirstReviewPromo(
  supa: ReturnType<typeof createClient>,
  clientEmail: string,
  appointmentId: string,
): Promise<string | null> {
  // 90 day window to redeem
  const expiresAt = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `REVIEW20-${randomSuffix(5)}`;
    const { data: promo, error: pErr } = await supa.from("promo_codes").insert({
      code,
      label: "First review thank-you (20% off)",
      kind: "percent",
      value_pct: 20,
      applies_to: "all",
      max_uses: 1,
      expires_at: expiresAt,
      is_active: true,
      conditions: { source: "first_review_perk", client_email: clientEmail.toLowerCase() },
    }).select("id").maybeSingle();
    if (pErr) {
      // unique violation -> try a new suffix
      if ((pErr as any).code === "23505") continue;
      console.error("promo_codes insert failed", pErr);
      return null;
    }
    const { error: tErr } = await supa.from("client_review_promos").insert({
      client_email: clientEmail.toLowerCase(),
      promo_code_id: (promo as any)?.id ?? null,
      code,
      appointment_id: appointmentId,
    });
    if (tErr) {
      // Already issued to this client in a race — fetch existing code instead.
      const { data: existing } = await supa
        .from("client_review_promos")
        .select("code")
        .eq("client_email", clientEmail.toLowerCase())
        .maybeSingle();
      return (existing as any)?.code ?? null;
    }
    return code;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: appts, error } = await supa
    .from("appointments")
    .select("id, staff_id, location_id, client_first_name, client_email, client_phone, updated_at, sms_opt_in, public_token")
    .eq("status", "completed")
    .eq("sms_opt_in", true)
    .is("review_sms_sent_at", null)
    .gte("updated_at", since)
    .limit(200);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0, skipped = 0, failed = 0;
  const now = Date.now();

  for (const a of appts ?? []) {
    try {
      if (!a.client_phone) { skipped++; continue; }

      const { data: staff } = await supa
        .from("staff_profiles")
        .select("full_name")
        .eq("id", a.staff_id).maybeSingle();
      const { data: tpl_row } = await supa
        .from("staff_message_templates")
        .select("enabled, template, delay_minutes")
        .eq("staff_id", a.staff_id).eq("message_type", "review").maybeSingle();
      // Default opt-in: send when no row exists.
      if (!staff || (tpl_row && (tpl_row as any).enabled === false)) { skipped++; continue; }

      const delayMin = (tpl_row as any)?.delay_minutes ?? 48 * 60;
      const ageMs = now - new Date(a.updated_at).getTime();
      if (ageMs < delayMin * 60 * 1000) { skipped++; continue; }

      let reviewUrl = "";
      if (a.location_id) {
        const { data: loc } = await supa
          .from("locations").select("google_review_url").eq("id", a.location_id).maybeSingle();
        reviewUrl = (loc as any)?.google_review_url ?? "";
      }
      const feedbackUrl = a.public_token ? `${SITE_ORIGIN}/feedback/${a.public_token}` : "";
      if (!feedbackUrl && !reviewUrl) { skipped++; continue; }

      // First-time reviewer perk: mint a 20% off promo if this client has never
      // received one. Only when we actually have an email to anchor uniqueness.
      let firstReviewPerk = "";
      const email = (a.client_email ?? "").toLowerCase();
      if (email) {
        const { data: existing } = await supa
          .from("client_review_promos")
          .select("code")
          .eq("client_email", email)
          .maybeSingle();
        let perkCode: string | null = (existing as any)?.code ?? null;
        if (!perkCode) {
          perkCode = await mintFirstReviewPromo(supa, email, a.id);
        }
        if (perkCode) {
          firstReviewPerk = render(FIRST_REVIEW_PERK_TEMPLATE, { promoCode: perkCode });
        }
      }

      const tpl = ((tpl_row as any)?.template as string | null) || DEFAULT_TEMPLATE;
      // Always send the feedback funnel link so 5-star reviewers auto-redirect to
      // Google (where they can publish) and lower ratings stay private with our team.
      const linkUrl = feedbackUrl || reviewUrl;
      const body = render(tpl, {
        clientFirstName: a.client_first_name ?? "",
        providerFirstName: firstName((staff as any).full_name),
        reviewUrl: linkUrl,
        feedbackUrl: linkUrl,
        firstReviewPerk,
        promoCode: firstReviewPerk ? firstReviewPerk.match(/code\s+(\S+)/)?.[1] ?? "" : "",
      });

      const res = await supa.functions.invoke("send-sms-via-ghl", {
        body: { appointmentId: a.id, template: "post-visit-review", body },
      });
      if ((res as any)?.error) { failed++; continue; }

      await supa.from("appointments")
        .update({ review_sms_sent_at: new Date().toISOString() })
        .eq("id", a.id);
      sent++;
    } catch (e) {
      console.error("review send failed", a.id, e);
      failed++;
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, skipped, failed, total: appts?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
