// Refund a sale (full or partial) and reverse voucher redemptions if full.
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders, errorResponse, json, requireStaff, currentEnv } from "../_shared/pos.ts";
import { createStripeClient } from "../_shared/stripe.ts";

const Body = z.object({
  saleId: z.string().uuid(),
  amountCents: z.number().int().min(0).optional(), // missing = full
  reason: z.string().max(500).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;
  if (!auth.roles.has("admin") && !auth.roles.has("scheduler")) return errorResponse("Not allowed", 403);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Invalid input");
  const { saleId, amountCents, reason } = parsed.data;

  const { data: sale } = await auth.supa.from("sales").select("*").eq("id", saleId).maybeSingle();
  if (!sale) return errorResponse("Sale not found", 404);
  if (sale.status !== "paid") return errorResponse(`Sale is ${sale.status}, cannot refund`);

  const refundable = sale.total_cents - (sale.refunded_amount_cents ?? 0) - (sale.voucher_applied_cents ?? 0);
  const refundAmt = amountCents ?? refundable;
  if (refundAmt > refundable) return errorResponse(`Max refundable is $${(refundable / 100).toFixed(2)}`);

  // Stripe refund (only for charges that touched Stripe)
  if (sale.stripe_payment_intent_id && refundAmt > 0) {
    const stripe = createStripeClient(currentEnv());
    try {
      await stripe.refunds.create({
        payment_intent: sale.stripe_payment_intent_id,
        amount: refundAmt,
        reason: "requested_by_customer",
        metadata: { sale_id: saleId, staff_reason: reason ?? "" },
      });
    } catch (e: any) {
      return errorResponse(`Stripe: ${e.message}`);
    }
  }

  const newRefunded = (sale.refunded_amount_cents ?? 0) + refundAmt;
  const fullRefund = newRefunded >= sale.total_cents - (sale.voucher_applied_cents ?? 0);

  await auth.supa.from("sales").update({
    refunded_amount_cents: newRefunded,
    status: fullRefund ? "refunded" : "paid",
    notes: reason ? `[refund $${(refundAmt / 100).toFixed(2)}] ${reason}` : sale.notes,
  }).eq("id", saleId);

  // Restore voucher balance only on full refund. The reverse_voucher_redemption
  // RPC checks auth.uid(), which is null under the service-role client used here,
  // so we use the direct-write helper instead (same fix as pos-cancel-payment).
  if (fullRefund && sale.voucher_applied_cents > 0) {
    const { data: reds } = await auth.supa
      .from("voucher_redemptions")
      .select("id, voucher_id, amount_cents")
      .eq("sale_id", saleId)
      .is("reversed_at", null);
    const { reverseVoucherDirect } = await import("../_shared/pos.ts");
    for (const r of reds ?? []) {
      await reverseVoucherDirect(auth.supa, r.voucher_id, r.id, r.amount_cents ?? 0);
    }
  }

  return json({ ok: true, refunded: refundAmt, fullRefund });
});
