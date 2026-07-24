// Daily cron: issues birthday + 1-year anniversary vouchers and emails clients.
// Runs once per day; idempotent via perk_grants unique (email, kind, year).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let s = "GC-";
  for (let i = 0; i < 8; i++) s += chars[bytes[i] % chars.length];
  return s;
}

function fmtMoney(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: settings } = await supa.from("app_settings").select("*").limit(1).maybeSingle();
  if (!settings) {
    return new Response(JSON.stringify({ ok: true, skipped: "no settings" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const today = new Date();
  const year = today.getUTCFullYear();
  const mm = today.getUTCMonth() + 1;
  const dd = today.getUTCDate();

  const granted: Array<{ email: string; kind: string; voucher: string }> = [];
  const errors: Array<{ email: string; kind: string; error: string }> = [];

  async function issuePerk(opts: {
    email: string;
    firstName: string | null;
    kind: "birthday" | "anniversary";
    amountCents: number;
    validityDays: number;
  }) {
    const email = opts.email.toLowerCase();
    // Idempotency: check perk_grants
    const { data: existing } = await supa
      .from("perk_grants")
      .select("id")
      .eq("client_email", email)
      .eq("perk_kind", opts.kind)
      .eq("perk_year", year)
      .maybeSingle();
    if (existing) return;

    const code = genCode();
    const expiresAt = new Date(Date.now() + opts.validityDays * 86400000);
    const { data: voucher, error: vErr } = await supa.from("vouchers").insert({
      code,
      original_amount_cents: opts.amountCents,
      balance_cents: opts.amountCents,
      issued_to_email: email,
      issued_to_name: opts.firstName ?? null,
      source: "comp",
      expires_at: expiresAt.toISOString(),
      notes: opts.kind === "birthday" ? "Birthday gift" : "1-year anniversary gift",
      entitlements: [],
    }).select("id").single();
    if (vErr) { errors.push({ email, kind: opts.kind, error: vErr.message }); return; }

    const { error: gErr } = await supa.from("perk_grants").insert({
      client_email: email,
      perk_kind: opts.kind,
      perk_year: year,
      voucher_id: voucher.id,
      amount_cents: opts.amountCents,
    });
    if (gErr) { errors.push({ email, kind: opts.kind, error: gErr.message }); return; }

    // Email (best-effort)
    try {
      const expiresOnFormatted = expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const message = opts.kind === "birthday"
        ? "Happy birthday from your RKA team!"
        : "Thank you for a beautiful year with us.";
      await supa.functions.invoke("send-transactional-email", {
        body: {
          templateName: "voucher-gift-card",
          recipientEmail: email,
          idempotencyKey: `perk-${opts.kind}-${year}-${email}`,
          templateData: {
            recipientName: opts.firstName ?? "",
            code,
            amountFormatted: fmtMoney(opts.amountCents),
            entitlements: [],
            expiresOnFormatted,
            fromName: "Radiantilyk Aesthetic",
            message,
          },
        },
      });
      await supa.from("perk_grants").update({ email_sent_at: new Date().toISOString() })
        .eq("client_email", email).eq("perk_kind", opts.kind).eq("perk_year", year);
    } catch (e) {
      console.error("perk email failed", e);
    }
    granted.push({ email, kind: opts.kind, voucher: code });
  }

  // BIRTHDAYS
  if (settings.perks_birthday_enabled) {
    const { data: profiles } = await supa
      .from("client_profiles")
      .select("email, first_name, dob")
      .not("dob", "is", null);
    for (const p of profiles ?? []) {
      if (!p.dob) continue;
      const d = new Date(p.dob);
      if (d.getUTCMonth() + 1 === mm && d.getUTCDate() === dd) {
        await issuePerk({
          email: p.email,
          firstName: p.first_name,
          kind: "birthday",
          amountCents: settings.perks_birthday_amount_cents,
          validityDays: settings.perks_birthday_validity_days,
        });
      }
    }
  }

  // ANNIVERSARIES — first approved appointment a year (or more) ago today
  if (settings.perks_anniversary_enabled) {
    const startOfDay = new Date(Date.UTC(year - 1, mm - 1, dd, 0, 0, 0)).toISOString();
    const endOfDay = new Date(Date.UTC(year - 1, mm - 1, dd, 23, 59, 59)).toISOString();
    const { data: appts } = await supa
      .from("appointments")
      .select("client_email, client_first_name, start_at, status")
      .gte("start_at", startOfDay)
      .lte("start_at", endOfDay)
      .in("status", ["approved", "no_show"]);
    const seen = new Set<string>();
    for (const a of appts ?? []) {
      const em = (a.client_email ?? "").toLowerCase();
      if (!em || seen.has(em)) continue;
      seen.add(em);
      // Confirm this was their first-ever appointment
      const { data: earlier } = await supa
        .from("appointments")
        .select("id")
        .eq("client_email", em)
        .in("status", ["approved", "no_show"])
        .lt("start_at", startOfDay)
        .limit(1);
      if ((earlier ?? []).length > 0) continue;
      await issuePerk({
        email: em,
        firstName: a.client_first_name,
        kind: "anniversary",
        amountCents: settings.perks_anniversary_amount_cents,
        validityDays: settings.perks_anniversary_validity_days,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, granted, errors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
