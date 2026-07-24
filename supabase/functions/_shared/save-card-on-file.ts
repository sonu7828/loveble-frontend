// Shared helper: upsert a card into client_payment_methods.
// Best-effort — callers should wrap in try/catch and never let this fail the parent flow.
import { createStripeClient, type StripeEnv } from "./stripe.ts";

type SupabaseLike = {
  from: (t: string) => any;
};

export async function saveCardOnFile(
  supa: SupabaseLike,
  env: StripeEnv,
  args: {
    clientEmail: string;
    stripeCustomerId: string;
    stripePaymentMethodId: string;
    addedBy?: string | null;
    cardholderName?: string | null;
  },
): Promise<{ saved: boolean; error?: string }> {
  const email = (args.clientEmail || "").trim().toLowerCase();
  if (!email || !args.stripeCustomerId || !args.stripePaymentMethodId) {
    return { saved: false, error: "missing fields" };
  }

  try {
    // Skip if this exact PM is already saved
    const { data: existingPm } = await supa
      .from("client_payment_methods")
      .select("id")
      .eq("stripe_payment_method_id", args.stripePaymentMethodId)
      .maybeSingle();
    if (existingPm?.id) return { saved: false };

    const stripe = createStripeClient(env);
    const pm = await stripe.paymentMethods.retrieve(args.stripePaymentMethodId);
    const card = (pm as any).card;
    if (!card) return { saved: false, error: "not a card" };

    // Make sure the PM is attached to the customer; ignore errors (already attached / etc.)
    try {
      if (!pm.customer || pm.customer !== args.stripeCustomerId) {
        await stripe.paymentMethods.attach(args.stripePaymentMethodId, { customer: args.stripeCustomerId });
      }
    } catch (_e) { /* ignore */ }

    const { data: existingDefault } = await supa
      .from("client_payment_methods")
      .select("id")
      .ilike("client_email", email)
      .eq("is_default", true)
      .maybeSingle();

    const cardholderName =
      args.cardholderName?.trim() ||
      (pm as any).billing_details?.name ||
      null;

    const { error } = await supa
      .from("client_payment_methods")
      .upsert({
        client_email: email,
        stripe_customer_id: args.stripeCustomerId,
        stripe_payment_method_id: args.stripePaymentMethodId,
        brand: card.brand ?? null,
        last4: card.last4 ?? null,
        exp_month: card.exp_month ?? null,
        exp_year: card.exp_year ?? null,
        cardholder_name: cardholderName,
        is_default: !existingDefault,
        added_by: args.addedBy ?? null,
      }, { onConflict: "stripe_payment_method_id" });

    if (error) return { saved: false, error: error.message };
    return { saved: true };
  } catch (e) {
    return { saved: false, error: (e as Error).message };
  }
}
