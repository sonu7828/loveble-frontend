// Persists a saved-on-file card to client_payment_methods after a SetupIntent succeeds.
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

    // Identify caller (staff)
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { data: rolesRow } = await supabase.rpc("get_my_staff_access").maybeSingle?.() ?? { data: null };
    // Fallback role check via user_roles
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isStaff = ["admin", "staff", "scheduler", "receptionist"].some(r => roleSet.has(r));
    if (!isStaff) return json({ error: "Not authorized" }, 403);

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const customerId = String(body?.customerId ?? "").trim();
    const paymentMethodId = String(body?.paymentMethodId ?? "").trim();
    const cardholderName = String(body?.cardholderName ?? "").trim() || null;

    if (!email || !customerId || !paymentMethodId) {
      return json({ error: "email, customerId and paymentMethodId required" }, 400);
    }

    const stripe = createStripeClient(currentEnv());
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    const card = pm.card;

    const { data: existingDefault } = await supabase
      .from("client_payment_methods")
      .select("id")
      .ilike("client_email", email)
      .eq("is_default", true)
      .maybeSingle();

    const { data, error } = await supabase
      .from("client_payment_methods")
      .upsert({
        client_email: email,
        stripe_customer_id: customerId,
        stripe_payment_method_id: paymentMethodId,
        brand: card?.brand ?? null,
        last4: card?.last4 ?? null,
        exp_month: card?.exp_month ?? null,
        exp_year: card?.exp_year ?? null,
        cardholder_name: cardholderName,
        is_default: !existingDefault,
        added_by: user.id,
      }, { onConflict: "stripe_payment_method_id" })
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);

    // Notify owner (best-effort, do not fail the save)
    try {
      const { data: cp } = await supabase
        .from("client_profiles")
        .select("first_name, last_name")
        .ilike("email", email)
        .maybeSingle();
      const clientName = cp ? `${cp.first_name ?? ""} ${cp.last_name ?? ""}`.trim() : "";
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "staff-card-change-notification",
          recipientEmail: "kv@rkaglow.com",
          idempotencyKey: `card-added-${data.id}`,
          templateData: {
            action: "added",
            clientEmail: email,
            clientName,
            cardBrand: card?.brand ?? null,
            cardLast4: card?.last4 ?? null,
            cardholderName,
            cardExpMonth: card?.exp_month ?? null,
            cardExpYear: card?.exp_year ?? null,
            staffEmail: user.email ?? null,
            occurredAt: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      console.warn("[save-client-card] notify failed", (e as Error).message);
    }

    return json({ card: data });
  } catch (e) {
    console.error("[payments-save-client-card]", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
