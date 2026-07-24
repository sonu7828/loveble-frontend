// Finalize a sale: charge via Stripe Terminal (S710), card-on-file, manual card, or cash.
// Always recomputes totals from sale_items before charging.
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders, errorResponse, json, requireStaff, recomputeTotals, currentEnv, resolveVoucherForSale, redeemVoucherDirect, reverseVoucherDirect, type VoucherResolution } from "../_shared/pos.ts";
import { createStripeClient } from "../_shared/stripe.ts";
import { completeAppointmentAndNotify } from "../_shared/complete-appointment.ts";
import { sendSaleReceiptIfNeeded } from "../_shared/send-sale-receipt.ts";

const Body = z.object({
  saleId: z.string().uuid(),
  paymentMethod: z.enum(["terminal", "card_on_file", "manual_card_intent", "cash", "credit_only", "affirm"]),
  readerId: z.string().uuid().optional(),
  voucherCode: z.string().optional(),
  voucherAmountCents: z.number().int().min(0).optional(),
  creditAppliedCents: z.number().int().min(0).optional(),
  unitBankAppliedCents: z.number().int().min(0).optional(),
  tipAmountCents: z.number().int().min(0).optional(),
  tipPct: z.number().min(0).max(100).optional(),
  discountAmountCents: z.number().int().min(0).optional(),
  discountPct: z.number().min(0).max(100).optional(),
  promoCode: z.string().optional(),
  applyProcessingFee: z.boolean().optional(),
  acknowledgeDuplicate: z.boolean().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;
  const { supa, user } = auth;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Invalid input: " + JSON.stringify(parsed.error.flatten()));
  const p = parsed.data;

  const { data: sale } = await supa.from("sales").select("*").eq("id", p.saleId).maybeSingle();
  if (!sale) return errorResponse("Sale not found", 404);
  if (sale.status === "paid") return errorResponse("Sale already paid");
  if (!["draft", "pending_payment"].includes(sale.status)) return errorResponse(`Sale is ${sale.status}`);

  const { data: items } = await supa.from("sale_items").select("*").eq("sale_id", p.saleId);
  if (!items || items.length === 0) return errorResponse("Sale has no items");

  // Duplicate-charge guard: block if the same client was already charged for the
  // same set of service references in the last 24h (unless explicitly acknowledged).
  if (!p.acknowledgeDuplicate && sale.client_email) {
    const sig = (its: any[]) => its
      .filter((it) => ["service", "unit_service", "package", "service_addon"].includes(it.kind) && it.reference_id)
      .map((it) => `${it.kind}:${it.reference_id}:${Number(it.quantity)}`)
      .sort()
      .join("|");
    const thisSig = sig(items as any[]);
    if (thisSig) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supa
        .from("sales")
        .select("id, paid_at, total_cents, sale_items(kind, reference_id, quantity)")
        .eq("client_email", sale.client_email)
        .eq("status", "paid")
        .gte("paid_at", since)
        .neq("id", sale.id)
        .order("paid_at", { ascending: false })
        .limit(10);
      const dup = (recent ?? []).find((r: any) => sig(r.sale_items ?? []) === thisSig);
      if (dup) {
        const when = new Date(dup.paid_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        return errorResponse(
          `Possible duplicate: this client was already charged $${(dup.total_cents / 100).toFixed(2)} for the same service(s) on ${when} (sale ${dup.id.slice(0, 8).toUpperCase()}). Confirm in the dialog to charge again.`,
          409,
        );
      }
    }
  }

  const { data: loc } = await supa.from("locations").select("processing_fee_pct, tip_enabled").eq("id", sale.location_id).maybeSingle();
  const processingFeePct = Number(loc?.processing_fee_pct ?? 3.5);

  // Resolve voucher first (dollar gift card or service-entitlement voucher)
  let voucherRes: VoucherResolution | null = null;
  if (p.voucherCode && p.voucherCode.trim()) {
    const res = await resolveVoucherForSale(supa, p.voucherCode, p.voucherAmountCents, items as any);
    if ("error" in res) return errorResponse(`Voucher: ${res.error}`);
    voucherRes = res;
  }

  // Recompute final totals
  const totals = recomputeTotals({
    items: items as any,
    tipAmountCents: p.tipAmountCents,
    tipPct: p.tipPct,
    discountAmountCents: p.discountAmountCents,
    discountPct: p.discountPct,
    voucherAmountCents: voucherRes?.appliedCents ?? 0,
    creditAppliedCents: p.creditAppliedCents,
    unitBankAppliedCents: p.unitBankAppliedCents,
    processingFeePct,
    applyProcessingFee: p.paymentMethod !== "cash" && p.paymentMethod !== "credit_only" && p.applyProcessingFee !== false,
  });

  // Cash / credit-only never charge processing fee
  if (p.paymentMethod === "cash" || p.paymentMethod === "credit_only") {
    totals.processing_fee_cents = 0;
    totals.total_cents = totals.subtotal_cents - totals.discount_cents + totals.tip_cents + totals.tax_cents;
    totals.amount_due_cents = Math.max(
      0,
      totals.total_cents
        - totals.voucher_applied_cents
        - totals.unit_bank_applied_cents
        - totals.credit_applied_cents,
    );
  }

  // Mark pending
  const pendingMethod = p.paymentMethod === "manual_card_intent"
    ? "manual_card"
    : (p.paymentMethod === "credit_only" ? "account_credit" : p.paymentMethod);
  await supa.from("sales").update({
    ...totals,
    status: "pending_payment",
    payment_method: pendingMethod,
  }).eq("id", p.saleId);

  // Apply voucher first (atomic). The old redeem_voucher RPC fails for the
  // service-role client (auth.uid() is null), so redeem directly.
  let redemptionId: string | null = null;
  let voucherDeductedCents = 0;
  if (voucherRes) {
    // Never redeem more than what the totals actually consumed
    if (!voucherRes.isEntitlement) voucherRes.appliedCents = totals.voucher_applied_cents;
    const redeemed = await redeemVoucherDirect(supa, voucherRes, p.saleId, user.id);
    if ("error" in redeemed) return errorResponse(`Voucher: ${redeemed.error}`);
    redemptionId = redeemed.redemptionId;
    voucherDeductedCents = redeemed.deductedCents;
  }
  const reverseVoucherIfAny = async () => {
    if (voucherRes) await reverseVoucherDirect(supa, voucherRes.voucher.id, redemptionId, voucherDeductedCents);
  };

  const amountDue = totals.amount_due_cents;

  // Helper — increment promo_codes.used_count when a sale with a promo is paid
  async function incrementPromoUsage() {
    if (!sale.promo_code) return;
    try {
      const { data: pc } = await supa.from("promo_codes").select("id, used_count").ilike("code", sale.promo_code).maybeSingle();
      if (pc) await supa.from("promo_codes").update({ used_count: (pc.used_count ?? 0) + 1 }).eq("id", pc.id);
    } catch (e) { console.error("promo usage increment failed", e); }
  }

  // Cash or credit-only: just mark paid (no Stripe call)
  if (p.paymentMethod === "cash" || p.paymentMethod === "credit_only") {
    await supa.from("sales").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_method: p.paymentMethod === "credit_only"
        ? "account_credit"
        : (totals.amount_due_cents === 0 && (totals.voucher_applied_cents ?? 0) > 0 ? "voucher_only" : "cash"),
    }).eq("id", p.saleId);
    await incrementPromoUsage();
    if (sale.appointment_id) {
      await completeAppointmentAndNotify(supa, sale.appointment_id, { actorUserId: user.id, reason: "auto_completed_after_payment" });
    }
    await sendSaleReceiptIfNeeded(supa, p.saleId);
    return json({ saleId: p.saleId, status: "paid", totals, amountDue });
  }

  // Voucher / credit / unit bank fully covers it — record a non-card payment label
  if (amountDue === 0) {
    let zeroLabel = "voucher_only";
    if ((totals.credit_applied_cents ?? 0) > 0 && (totals.voucher_applied_cents ?? 0) === 0
        && (totals.unit_bank_applied_cents ?? 0) === 0) {
      zeroLabel = "account_credit";
    } else if ((totals.unit_bank_applied_cents ?? 0) > 0 && (totals.voucher_applied_cents ?? 0) === 0
        && (totals.credit_applied_cents ?? 0) === 0) {
      zeroLabel = "unit_bank";
    } else if ((totals.credit_applied_cents ?? 0) > 0 || (totals.unit_bank_applied_cents ?? 0) > 0) {
      zeroLabel = "mixed_non_card";
    }
    await supa.from("sales").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_method: zeroLabel,
    }).eq("id", p.saleId);
    await incrementPromoUsage();
    if (sale.appointment_id) {
      await completeAppointmentAndNotify(supa, sale.appointment_id, { actorUserId: user.id, reason: "auto_completed_after_payment" });
    }
    await sendSaleReceiptIfNeeded(supa, p.saleId);
    return json({ saleId: p.saleId, status: "paid", totals, amountDue: 0 });
  }

  // (duplicate zero-amount branch removed — handled above)

  // Stripe charge paths
  const env = currentEnv();
  const stripe = createStripeClient(env);

  // Get/create Stripe customer
  let customerId: string | null = null;
  let cardOnFilePmId: string | null = null;
  if (sale.appointment_id) {
    const { data: appt } = await supa.from("appointments").select("stripe_customer_id, stripe_payment_method_id").eq("id", sale.appointment_id).maybeSingle();
    customerId = appt?.stripe_customer_id ?? null;
    cardOnFilePmId = appt?.stripe_payment_method_id ?? null;
  }

  // Walk-in (or appointment without saved card): try the client's default saved card
  if (p.paymentMethod === "card_on_file" && (!customerId || !cardOnFilePmId) && sale.client_email) {
    const { data: pm } = await supa
      .from("client_payment_methods")
      .select("stripe_customer_id, stripe_payment_method_id")
      .ilike("client_email", sale.client_email)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pm?.stripe_customer_id && pm?.stripe_payment_method_id) {
      customerId = pm.stripe_customer_id;
      cardOnFilePmId = pm.stripe_payment_method_id;
    }
  }

  if (p.paymentMethod === "card_on_file") {
    if (!customerId || !cardOnFilePmId) {
      return errorResponse("No card on file for this client");
    }
    try {
      const pi = await stripe.paymentIntents.create({
        amount: amountDue,
        currency: "usd",
        customer: customerId,
        payment_method: cardOnFilePmId,
        off_session: true,
        confirm: true,
        description: `Sale ${p.saleId}`,
        metadata: { sale_id: p.saleId, appointment_id: sale.appointment_id ?? "" },
      });
      await supa.from("sales").update({
        stripe_payment_intent_id: pi.id,
        stripe_charge_id: (pi as any).latest_charge ?? null,
        status: pi.status === "succeeded" ? "paid" : "pending_payment",
        paid_at: pi.status === "succeeded" ? new Date().toISOString() : null,
      }).eq("id", p.saleId);
      if (pi.status === "succeeded") {
        // Promo usage is incremented by the `payment_intent.succeeded` webhook
        // for any Stripe-backed sale — don't double-count here.
        if (sale.appointment_id) {
          await completeAppointmentAndNotify(supa, sale.appointment_id, { actorUserId: user.id, reason: "auto_completed_after_payment" });
        }
        await sendSaleReceiptIfNeeded(supa, p.saleId);
      }
      return json({
        saleId: p.saleId,
        status: pi.status === "succeeded" ? "paid" : "pending_payment",
        paymentIntentStatus: pi.status,
        paymentIntentId: pi.id,
        totals,
        amountDue,
      });
    } catch (e: any) {
      await reverseVoucherIfAny();
      await supa.from("sales").update({ status: "draft", payment_method: null }).eq("id", p.saleId);
      return errorResponse(`Card on file declined: ${e.message}`);
    }
  }

  // Terminal — server-driven push to S710
  if (p.paymentMethod === "terminal") {
    if (!p.readerId) return errorResponse("readerId required for terminal payment");
    const { data: reader } = await supa.from("terminal_readers").select("stripe_reader_id").eq("id", p.readerId).maybeSingle();
    if (!reader?.stripe_reader_id) return errorResponse("Reader not registered");

    try {
      const pi = await stripe.paymentIntents.create({
        amount: amountDue,
        currency: "usd",
        payment_method_types: ["card_present"],
        capture_method: "automatic",
        ...(customerId ? { customer: customerId } : {}),
        description: `Sale ${p.saleId}`,
        metadata: { sale_id: p.saleId, appointment_id: sale.appointment_id ?? "" },
      });

      // Push to reader
      await stripe.terminal.readers.processPaymentIntent(reader.stripe_reader_id, {
        payment_intent: pi.id,
      } as any);

      await supa.from("sales").update({
        stripe_payment_intent_id: pi.id,
        stripe_terminal_reader_id: reader.stripe_reader_id,
        reader_action_status: "in_progress",
      }).eq("id", p.saleId);

      return json({ saleId: p.saleId, status: "reader_in_progress", paymentIntentId: pi.id, totals, amountDue });
    } catch (e: any) {
      await reverseVoucherIfAny();
      await supa.from("sales").update({ status: "draft", payment_method: null }).eq("id", p.saleId);
      return errorResponse(`Terminal error: ${e.message}`);
    }
  }

  // Manual card → return a PaymentIntent client_secret for an embedded form
  if (p.paymentMethod === "manual_card_intent") {
    try {
      const pi = await stripe.paymentIntents.create({
        amount: amountDue,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        ...(customerId ? { customer: customerId } : {}),
        description: `Sale ${p.saleId}`,
        metadata: { sale_id: p.saleId, appointment_id: sale.appointment_id ?? "" },
      });
      await supa.from("sales").update({
        stripe_payment_intent_id: pi.id,
      }).eq("id", p.saleId);
      return json({ saleId: p.saleId, status: "awaiting_card", clientSecret: pi.client_secret, totals, amountDue });
    } catch (e: any) {
      await reverseVoucherIfAny();
      await supa.from("sales").update({ status: "draft", payment_method: null }).eq("id", p.saleId);
      return errorResponse(`Stripe error: ${e.message}`);
    }
  }

  // Affirm — create a hosted Stripe Checkout Session and return URL to display as QR / send via email
  if (p.paymentMethod === "affirm") {
    if (amountDue < 5000) {
      await reverseVoucherIfAny();
      await supa.from("sales").update({ status: "draft", payment_method: null }).eq("id", p.saleId);
      return errorResponse("Affirm requires a minimum amount of $50.00");
    }
    if (amountDue > 3000000) {
      await reverseVoucherIfAny();
      await supa.from("sales").update({ status: "draft", payment_method: null }).eq("id", p.saleId);
      return errorResponse("Affirm maximum is $30,000.00");
    }
    try {
      // Build a single consolidated line item — Affirm just needs the total.
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["affirm"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: `Radiantilyk Aesthetic — Sale ${p.saleId.slice(0, 8)}` },
            unit_amount: amountDue,
          },
          quantity: 1,
        }],
        ...(customerId
          ? { customer: customerId }
          : (sale.client_email ? { customer_email: sale.client_email } : {})),
        payment_intent_data: {
          metadata: { sale_id: p.saleId, appointment_id: sale.appointment_id ?? "" },
          description: `Affirm — Sale ${p.saleId}`,
        },
        metadata: { sale_id: p.saleId, appointment_id: sale.appointment_id ?? "" },
        success_url: `https://bookrka.com/checkout/return?sale_paid=${p.saleId}`,
        cancel_url: `https://bookrka.com/checkout/return?sale_cancelled=${p.saleId}`,
      });
      // Affirm: `session.payment_intent` is null at session creation — the PI is
      // only created when the customer completes the Affirm flow. Track the
      // Checkout Session id so `pos-confirm-payment` can look up the PI later.
      await supa.from("sales").update({
        payment_method: "affirm",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      }).eq("id", p.saleId);
      return json({
        saleId: p.saleId,
        status: "affirm_link",
        url: session.url,
        sessionId: session.id,
        totals,
        amountDue,
      });
    } catch (e: any) {
      await reverseVoucherIfAny();
      await supa.from("sales").update({ status: "draft", payment_method: null }).eq("id", p.saleId);
      return errorResponse(`Affirm error: ${e.message}`);
    }
  }

  return errorResponse("Unsupported payment method");
});
