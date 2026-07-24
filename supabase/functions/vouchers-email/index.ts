// Admin-only: email a voucher / gift card to a recipient.
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
    if (!isAdmin) return json({ error: "Only admins can email vouchers" }, 403);

    const b = await req.json().catch(() => ({}));
    const voucherId = String(b?.voucherId || "").trim();
    const recipientEmailRaw = String(b?.recipientEmail || "").trim().toLowerCase();
    const recipientNameRaw = String(b?.recipientName || "").trim();
    const fromName = String(b?.fromName || "").trim() || undefined;
    const message = String(b?.message || "").trim() || undefined;

    if (!voucherId) return json({ error: "voucherId required" }, 400);

    const { data: v, error: ve } = await supa.from("vouchers").select("*").eq("id", voucherId).maybeSingle();
    if (ve || !v) return json({ error: "Voucher not found" }, 404);

    const recipientEmail = recipientEmailRaw || (v.issued_to_email ?? "");
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return json({ error: "Valid recipient email required" }, 400);
    }

    const recipientName = recipientNameRaw || (v.issued_to_name ?? "").trim() || "there";
    const entitlements = Array.isArray(v.entitlements)
      ? v.entitlements.map((e: any) =>
          `${e.quantity ?? ""} ${e.unit_label ?? ""} ${e.service_name ?? ""}`.replace(/\s+/g, " ").trim()
        ).filter(Boolean)
      : [];
    // Service-only vouchers are stored with a placeholder $0.01 balance — don't expose that.
    const isServiceOnly = entitlements.length > 0 && v.balance_cents <= 1;
    const amountFormatted = isServiceOnly ? "" : `$${(v.balance_cents / 100).toFixed(2)}`;
    const expiresOnFormatted = v.expires_at
      ? new Date(v.expires_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "";

    const { error } = await supa.functions.invoke("send-transactional-email", {
      body: {
        templateName: "voucher-gift-card",
        recipientEmail,
        idempotencyKey: `voucher-${v.id}-${recipientEmail}-${Date.now().toString(36)}`,
        templateData: {
          recipientName,
          code: v.code,
          amountFormatted,
          entitlements,
          expiresOnFormatted,
          fromName,
          message,
        },
      },
    });
    if (error) return json({ error: error.message ?? "Email failed" }, 500);

    // Track recipient on the voucher if we didn't have one yet
    if (!v.issued_to_email) {
      await supa.from("vouchers").update({ issued_to_email: recipientEmail }).eq("id", v.id);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
