// Detaches a saved card from the Stripe customer and removes the row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createStripeClient, currentEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isStaff = ["admin", "staff", "scheduler", "receptionist"].some(r => roleSet.has(r));
    if (!isStaff) return json({ error: "Not authorized" }, 403);

    const body = await req.json().catch(() => ({}));
    const cardId = String(body?.id ?? "").trim();
    if (!cardId) return json({ error: "id required" }, 400);

    const { data: row, error: getErr } = await supabase
      .from("client_payment_methods")
      .select("*")
      .eq("id", cardId)
      .single();
    if (getErr || !row) return json({ error: "Card not found" }, 404);

    const stripe = createStripeClient(currentEnv());
    try { await stripe.paymentMethods.detach(row.stripe_payment_method_id); } catch (e) {
      console.warn("[detach] stripe error", (e as Error).message);
    }

    const { error: delErr } = await supabase.from("client_payment_methods").delete().eq("id", cardId);
    if (delErr) return json({ error: delErr.message }, 500);

    // Notify owner (best-effort)
    try {
      const { data: cp } = await supabase
        .from("client_profiles")
        .select("first_name, last_name")
        .ilike("email", row.client_email)
        .maybeSingle();
      const clientName = cp ? `${cp.first_name ?? ""} ${cp.last_name ?? ""}`.trim() : "";
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "staff-card-change-notification",
          recipientEmail: "kv@rkaglow.com",
          idempotencyKey: `card-removed-${cardId}`,
          templateData: {
            action: "removed",
            clientEmail: row.client_email,
            clientName,
            cardBrand: row.brand,
            cardLast4: row.last4,
            cardholderName: row.cardholder_name,
            cardExpMonth: row.exp_month,
            cardExpYear: row.exp_year,
            staffEmail: user.email ?? null,
            occurredAt: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      console.warn("[detach-client-card] notify failed", (e as Error).message);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("[payments-detach-client-card]", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
