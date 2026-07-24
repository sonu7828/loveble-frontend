// Runs a marketing campaign: resolves the audience, dedupes against marketing_sends
// using the campaign's cooldown, and enqueues marketing-campaign emails for each
// eligible recipient.
//
// Body:
//   { campaignId: string, dryRun?: boolean, limit?: number }
//
// Returns: { ok, audienceSize, eligible, sent, skipped, errors, sample? }
//
// Auth: requires staff (admin or scheduler) JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { campaignId, dryRun = false, limit = 5000, testEmail = null, testFirstName = null } = await req.json();
    if (!campaignId || typeof campaignId !== "string") return json({ error: "campaignId required" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supa = createClient(url, serviceKey);

    // Authorize: caller must be admin or scheduler (unless invoked with the service role
    // by the cron processor, which uses serviceKey directly for both auth and queries).
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    let isServiceCall = token === serviceKey;
    if (!isServiceCall && token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1] || ""));
        if (payload?.role === "service_role") isServiceCall = true;
      } catch { /* not a JWT */ }
    }
    if (!isServiceCall && !testEmail) {
      const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", user.id);
      const ok = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "scheduler");
      if (!ok) return json({ error: "Forbidden" }, 403);
    }

    const { data: campaign, error: cErr } = await supa
      .from("marketing_campaigns").select("*").eq("id", campaignId).maybeSingle();
    if (cErr || !campaign) return json({ error: "Campaign not found" }, 404);
    if (campaign.status === "archived") return json({ error: "Campaign archived" }, 400);

    // Resolve audience -> array of { email, first_name }
    let eligible: Array<{ email: string; first_name: string | null }>;
    let audienceLen = 0;
    if (testEmail && typeof testEmail === "string") {
      eligible = [{ email: testEmail, first_name: testFirstName || "there" }];
      audienceLen = 1;
    } else {
      const audience = await resolveAudience(supa, campaign.audience_type, campaign.audience_params || {});
      audienceLen = audience.length;
      const cooldownMs = (campaign.cooldown_days ?? 30) * 86400 * 1000;
      const cutoff = new Date(Date.now() - cooldownMs).toISOString();
      const { data: recent } = await supa.from("marketing_sends")
        .select("client_email, sent_at")
        .eq("campaign_id", campaignId)
        .gte("sent_at", cutoff);
      const recentSet = new Set((recent ?? []).map((r: any) => r.client_email.toLowerCase()));
      eligible = audience.filter(a => !recentSet.has(a.email.toLowerCase())).slice(0, limit);
    }

    if (dryRun) {
      return json({
        ok: true, audienceSize: audienceLen, eligible: eligible.length,
        sent: 0, skipped: audienceLen - eligible.length,
        sample: eligible.slice(0, 5),
      });
    }

    // Send loop via Brevo connector gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);
    if (!BREVO_API_KEY) return json({ error: "BREVO_API_KEY not configured — connect Brevo in Connectors" }, 500);

    const fromEmail = Deno.env.get("MARKETING_FROM_EMAIL") || "kv@rkaglow.com";
    const fromName = Deno.env.get("MARKETING_FROM_NAME") || "Radiantilyk Aesthetic";

    let sent = 0, errors = 0;
    for (const recipient of eligible) {
      try {
        const html = renderCampaignHtml({
          firstName: recipient.first_name || "there",
          subject: campaign.subject,
          bodyMarkdown: campaign.body_markdown || "",
          ctaLabel: campaign.cta_label,
          ctaUrl: campaign.cta_url,
          previewText: campaign.preview_text,
          recipientEmail: recipient.email,
          heroImageUrl: campaign.hero_image_url,
        });

        const res = await fetch("https://connector-gateway.lovable.dev/brevo/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": BREVO_API_KEY,
          },
          body: JSON.stringify({
            sender: { name: fromName, email: fromEmail },
            to: [{ email: recipient.email, name: recipient.first_name || undefined }],
            subject: campaign.subject,
            htmlContent: html,
            tags: [`campaign:${campaignId}`],
            headers: { "List-Unsubscribe": `<mailto:kv@rkaglow.com?subject=unsubscribe%20${encodeURIComponent(recipient.email)}>` },
          }),
        });
        const ok = res.ok;
        if (!ok) {
          const detail = await res.text();
          console.error("Brevo send failed", res.status, detail);
        }
        if (!testEmail) {
          await supa.from("marketing_sends").insert({
            campaign_id: campaignId,
            client_email: recipient.email,
            status: ok ? "sent" : "failed",
          });
        }
        if (ok) sent++; else errors++;
      } catch (e) {
        console.error("send error", e);
        errors++;
        if (!testEmail) {
          await supa.from("marketing_sends").insert({
            campaign_id: campaignId, client_email: recipient.email, status: "failed",
          });
        }
      }
    }

    if (!testEmail) {
      await supa.from("marketing_campaigns").update({ last_run_at: new Date().toISOString() }).eq("id", campaignId);
    }

    return json({
      ok: true, audienceSize: audienceLen, eligible: eligible.length,
      sent, skipped: audienceLen - eligible.length, errors, test: !!testEmail,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

type Recipient = { email: string; first_name: string | null };

async function resolveAudience(
  supa: ReturnType<typeof createClient>,
  type: string,
  params: Record<string, any>,
): Promise<Recipient[]> {
  // Pull all completed/approved appointments once and aggregate per client.
  const { data: appts } = await supa.from("appointments")
    .select("client_email, client_first_name, start_at, status")
    .in("status", ["approved", "completed", "pending"])
    .order("start_at", { ascending: false })
    .limit(20000);

  const map = new Map<string, { first_name: string | null; lastVisit: number | null; nextVisit: number | null; completedCount: number }>();
  const now = Date.now();
  for (const a of appts ?? []) {
    const email = a.client_email?.toLowerCase();
    if (!email) continue;
    const t = new Date(a.start_at).getTime();
    const isPast = t < now;
    let row = map.get(email);
    if (!row) {
      row = { first_name: a.client_first_name || null, lastVisit: null, nextVisit: null, completedCount: 0 };
      map.set(email, row);
    }
    if (a.status === "completed" || (isPast && a.status === "approved")) {
      row.completedCount++;
      if (!row.lastVisit || t > row.lastVisit) row.lastVisit = t;
    }
    if (!isPast && (a.status === "pending" || a.status === "approved")) {
      if (!row.nextVisit || t < row.nextVisit) row.nextVisit = t;
    }
  }

  const all = Array.from(map.entries()).map(([email, v]) => ({ email, ...v }));

  switch (type) {
    case "all_clients":
      return all.filter(c => c.completedCount > 0).map(c => ({ email: c.email, first_name: c.first_name }));

    case "everyone": {
      // Union of: anyone with an appointment (any status), imported clients, and registered client profiles
      const merged = new Map<string, string | null>();
      for (const [email, v] of map.entries()) merged.set(email, v.first_name);
      const { data: imported } = await supa.from("imported_clients").select("email, first_name").limit(20000);
      for (const r of imported ?? []) {
        const e = r.email?.toLowerCase();
        if (!e) continue;
        if (!merged.has(e)) merged.set(e, r.first_name || null);
      }
      const { data: profiles } = await supa.from("client_profiles").select("email, first_name").limit(20000);
      for (const r of profiles ?? []) {
        const e = r.email?.toLowerCase();
        if (!e) continue;
        if (!merged.has(e)) merged.set(e, r.first_name || null);
      }
      return Array.from(merged.entries()).map(([email, first_name]) => ({ email, first_name }));
    }

    case "lapsed": {
      const days = Number(params.days_inactive ?? 180);
      const cutoff = now - days * 86400 * 1000;
      return all
        .filter(c => c.lastVisit && c.lastVisit < cutoff && !c.nextVisit)
        .map(c => ({ email: c.email, first_name: c.first_name }));
    }

    case "win_back": {
      const from = Number(params.days_from ?? 60);
      const to = Number(params.days_to ?? 120);
      const fromMs = now - to * 86400 * 1000;   // older bound
      const toMs = now - from * 86400 * 1000;   // newer bound
      return all
        .filter(c => c.lastVisit && c.lastVisit >= fromMs && c.lastVisit <= toMs && !c.nextVisit)
        .map(c => ({ email: c.email, first_name: c.first_name }));
    }

    case "vip": {
      const min = Number(params.min_visits ?? 5);
      return all
        .filter(c => c.completedCount >= min)
        .map(c => ({ email: c.email, first_name: c.first_name }));
    }

    default:
      return [];
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]!));
}
function mdToHtml(md: string) {
  // very small markdown: paragraphs, **bold**, *italic*, [text](url), bullet lists
  const blocks = md.replace(/\r\n/g, "\n").split(/\n{2,}/).filter(Boolean);
  const inline = (s: string) => escapeHtml(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" style="color:#b76e79;">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return blocks.map(b => {
    const lines = b.split("\n");
    if (lines.every(l => /^\s*[-*]\s+/.test(l))) {
      return `<ul style="padding-left:20px;margin:0 0 12px;">${lines.map(l => `<li style="margin-bottom:6px;">${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`;
    }
    return `<p style="margin:0 0 12px;line-height:1.6;color:#333;">${inline(b).replace(/\n/g, "<br/>")}</p>`;
  }).join("");
}

function renderCampaignHtml(opts: {
  firstName: string; subject: string; bodyMarkdown: string;
  ctaLabel?: string | null; ctaUrl?: string | null; previewText?: string | null;
  recipientEmail: string; heroImageUrl?: string | null;
}) {
  const greeted = opts.bodyMarkdown.replace(/\{\{\s*first_name\s*\}\}/gi, opts.firstName);
  const cta = opts.ctaUrl
    ? `<div style="text-align:center;margin:24px 0;"><a href="${opts.ctaUrl}" style="display:inline-block;background:#b76e79;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">${escapeHtml(opts.ctaLabel || "Book now")}</a></div>`
    : "";
  const unsubUrl = `https://bookrka.com/unsubscribe?email=${encodeURIComponent(opts.recipientEmail)}`;
  const preview = opts.previewText
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(opts.previewText)}</div>`
    : "";
  const hero = opts.heroImageUrl
    ? `<div style="margin:-32px -32px 24px;"><img src="${opts.heroImageUrl}" alt="" style="display:block;width:100%;max-width:560px;height:auto;border-top-left-radius:12px;border-top-right-radius:12px;"/></div>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#faf7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
${preview}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f5;padding:32px 16px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:32px;max-width:560px;">
<tr><td>
  ${hero}
  <div style="text-align:center;margin-bottom:20px;"><img src="https://bookrka.com/rka-logo.webp" alt="Radiantilyk Aesthetic" width="84" height="84" style="border-radius:50%;display:inline-block;"/></div>
  <div style="text-align:center;font-family:Georgia,serif;font-size:18px;color:#b76e79;letter-spacing:2px;margin-bottom:24px;">RADIANTILYK AESTHETIC</div>
  <h1 style="font-family:Georgia,serif;color:#222;font-size:26px;margin:0 0 16px;">${escapeHtml(opts.subject)}</h1>

  ${mdToHtml(greeted)}
  ${cta}
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
  <p style="color:#888;font-size:12px;text-align:center;margin:0;">
    Radiantilyk Aesthetic · San Jose & San Mateo<br/>
    <a href="${unsubUrl}" style="color:#888;">Unsubscribe</a>
  </p>
</td></tr></table></td></tr></table></body></html>`;
}
