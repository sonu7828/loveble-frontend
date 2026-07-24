// Cancel a pending payment so the cashier can pick a different method.
// - Cancels the Stripe PaymentIntent (and terminal reader action) if any
// - Reverses any voucher redemption attached to this sale
// - Resets the sale row back to draft so the cashier can choose Cash/Card again
//
// Safe to call even if there is no PaymentIntent yet (e.g. someone hit the
// wrong button mid-flow). Refuses to cancel a sale that is already paid.
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders, errorResponse, json, requireStaff, currentEnv, reverseVoucherDirect } from "../_shared/pos.ts";
import { createStripeClient } from "../_shared/stripe.ts";

const Body = z.object({ saleId: z.string().uuid() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;
  const { supa } = auth;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Invalid input");

  const { data: sale } = await supa.from("sales").select("*").eq("id", parsed.data.saleId).maybeSingle();
  if (!sale) return errorResponse("Sale not found", 404);
  if (sale.status === "paid") return errorResponse("Sale already paid — cannot cancel");

  const stripe = createStripeClient(currentEnv());

  // Best-effort: cancel reader action first so the device stops asking for a card.
  if (sale.stripe_terminal_reader_id) {
    try {
      await stripe.terminal.readers.cancelAction(sale.stripe_terminal_reader_id);
    } catch (e: any) {
      // Most common: "Reader is not currently processing an action" — fine.
      console.warn("reader cancelAction skipped:", e?.message ?? e);
    }
  }

  // Best-effort: cancel the PaymentIntent if it is still cancellable.
  if (sale.stripe_payment_intent_id) {
    try {
      const pi = await stripe.paymentIntents.retrieve(sale.stripe_payment_intent_id);
      const cancellable = [
        "requires_payment_method",
        "requires_capture",
        "requires_confirmation",
        "requires_action",
        "processing",
      ];
      if (cancellable.includes(pi.status)) {
        await stripe.paymentIntents.cancel(pi.id);
      } else if (pi.status === "succeeded") {
        // Race: PI succeeded between user clicking Cancel and us getting here.
        // Don't reverse the voucher — surface to the cashier instead.
        await supa.from("sales").update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_charge_id: (pi as any).latest_charge ?? null,
          reader_action_status: "succeeded",
        }).eq("id", sale.id);
        return json({ saleId: sale.id, status: "paid", note: "Payment had already succeeded — sale marked paid." });
      }
    } catch (e: any) {
      console.warn("paymentIntent cancel skipped:", e?.message ?? e);
    }
  }

  // Reverse voucher redemption attached to this sale (if any). Use the same
  // direct-write helper that `pos-finalize-sale` uses to redeem — the
  // reverse_voucher_redemption RPC relies on auth.uid() which is null under
  // the service-role client, so it silently fails and leaves the voucher consumed.
  try {
    const { data: red } = await supa
      .from("voucher_redemptions")
      .select("id, voucher_id, amount_cents")
      .eq("sale_id", sale.id)
      .is("reversed_at", null)
      .maybeSingle();
    if (red?.voucher_id) {
      await reverseVoucherDirect(supa, red.voucher_id, red.id, red.amount_cents ?? 0);
    }
  } catch (e) { console.warn("voucher reverse skipped:", e); }

  await supa.from("sales").update({
    status: "draft",
    payment_method: null,
    stripe_payment_intent_id: null,
    stripe_terminal_reader_id: null,
    reader_action_status: null,
    paid_at: null,
  }).eq("id", sale.id);

  return json({ saleId: sale.id, status: "draft" });
});
