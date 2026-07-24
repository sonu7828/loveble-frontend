// Confirms a sale's payment immediately by re-checking the PaymentIntent on Stripe,
// marking the sale as paid (if succeeded), completing the appointment, and sending
// the receipt — without waiting for the async webhook. Idempotent and safe to call
// multiple times; the webhook will still fire and no-op.
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders, errorResponse, json, requireStaff, currentEnv } from "../_shared/pos.ts";
import { createStripeClient } from "../_shared/stripe.ts";
import { completeAppointmentAndNotify } from "../_shared/complete-appointment.ts";
import { sendSaleReceiptIfNeeded } from "../_shared/send-sale-receipt.ts";

const Body = z.object({ saleId: z.string().uuid() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;
  const { supa, user } = auth;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Invalid input");

  const { data: sale } = await supa.from("sales").select("*").eq("id", parsed.data.saleId).maybeSingle();
  if (!sale) return errorResponse("Sale not found", 404);

  // Already paid → just (re)send receipt if needed.
  if (sale.status === "paid") {
    await sendSaleReceiptIfNeeded(supa, sale.id);
    return json({ saleId: sale.id, status: "paid", receiptSent: true });
  }

  if (!sale.stripe_payment_intent_id) return errorResponse("No payment intent on sale");

  const stripe = createStripeClient(currentEnv());
  let pi = await stripe.paymentIntents.retrieve(sale.stripe_payment_intent_id);

  // Terminal payments can briefly sit in requires_capture/processing after the
  // S710 says approved. Confirm should finish the charge if it was authorized,
  // then mark the sale paid immediately instead of waiting on a delayed webhook.
  if (pi.status === "requires_capture") {
    pi = await stripe.paymentIntents.capture(pi.id);
  }

  if (pi.status !== "succeeded" && sale.stripe_terminal_reader_id) {
    try {
      const reader = await stripe.terminal.readers.retrieve(sale.stripe_terminal_reader_id);
      const action = (reader as any).action;
      const actionPiId = action?.process_payment_intent?.payment_intent ?? action?.payment_intent;
      // CRITICAL: only trust the reader action when its PI matches this sale's PI.
      // Otherwise we may pick up a succeeded action from the previous sale charged
      // on the same reader and falsely mark this sale paid with another sale's charge.
      if (action?.status === "succeeded" && actionPiId && actionPiId === sale.stripe_payment_intent_id) {
        pi = await stripe.paymentIntents.retrieve(actionPiId);
        if (pi.status === "requires_capture") {
          pi = await stripe.paymentIntents.capture(pi.id);
        }
      }
    } catch (e) {
      console.error("terminal reader confirmation check failed", e);
    }
  }

  if (pi.status !== "succeeded") {
    return json({ saleId: sale.id, status: pi.status, receiptSent: false });
  }

  await supa.from("sales").update({
    status: "paid",
    paid_at: new Date().toISOString(),
    stripe_charge_id: (pi as any).latest_charge ?? null,
    reader_action_status: "succeeded",
  }).eq("id", sale.id);

  // Auto-save card on file from this payment (best-effort)
  try {
    const customerId = (pi as any).customer as string | null;
    const paymentMethodId = (pi as any).payment_method as string | null;
    if (customerId && paymentMethodId && sale.client_email) {
      const { saveCardOnFile } = await import("../_shared/save-card-on-file.ts");
      await saveCardOnFile(supa, currentEnv(), {
        clientEmail: sale.client_email,
        stripeCustomerId: customerId,
        stripePaymentMethodId: paymentMethodId,
        addedBy: user.id,
      });
    }
  } catch (e) { console.error("auto-save card from PI failed", e); }

  if (sale.appointment_id) {

    await completeAppointmentAndNotify(supa, sale.appointment_id, {
      actorUserId: user.id,
      reason: "auto_completed_after_payment",
    });
  }

  await sendSaleReceiptIfNeeded(supa, sale.id);

  return json({ saleId: sale.id, status: "paid", receiptSent: true });
});
