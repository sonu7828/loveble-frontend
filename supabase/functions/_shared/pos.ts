// Shared helpers for POS / checkout edge functions.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 400) {
  return json({ error: message }, status);
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function requireStaff(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return { error: errorResponse("Unauthorized", 401) };

  const supa = serviceClient();
  const { data: userData, error: uerr } = await supa.auth.getUser(token);
  if (uerr || !userData?.user) return { error: errorResponse("Unauthorized", 401) };

  const { data: roles } = await supa
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);

  const roleSet = new Set((roles ?? []).map((r: any) => r.role));
  const isStaff = ["admin", "staff", "scheduler", "receptionist"].some((r) => roleSet.has(r));
  if (!isStaff) return { error: errorResponse("Forbidden", 403) };

  return { user: userData.user, supa, roles: roleSet };
}

export type SaleItem = {
  kind: string;
  reference_id?: string | null;
  label: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  taxable?: boolean;
  tippable?: boolean;
  metadata?: Record<string, unknown>;
  display_order?: number;
};

export type SaleTotals = {
  subtotal_cents: number;
  discount_cents: number;
  tip_cents: number;
  processing_fee_cents: number;
  tax_cents: number;
  voucher_applied_cents: number;
  credit_applied_cents: number;
  unit_bank_applied_cents: number;
  total_cents: number;
  amount_due_cents: number;
};

export type RecomputeOptions = {
  items: SaleItem[];
  tipAmountCents?: number;
  tipPct?: number; // 0-100
  discountAmountCents?: number;
  discountPct?: number; // 0-100
  voucherAmountCents?: number;
  creditAppliedCents?: number;     // client account credit drawn against the sale
  unitBankAppliedCents?: number;   // dollar value of banked units redeemed
  processingFeePct: number; // e.g. 3.5
  taxRatePct?: number; // 0 for now
  applyProcessingFee?: boolean;
};

export function recomputeTotals(opts: RecomputeOptions): SaleTotals {
  // Subtotal: sum of all positive items (services, units, products, packages)
  // Discounts come in via opts, not as items, except for promo "package" overrides
  const positiveKinds = new Set(["service", "unit_service", "product", "package", "service_addon", "custom"]);
  const tippableKinds = new Set(["service", "unit_service", "package", "service_addon", "custom"]);

  let subtotal = 0;
  let tippableBase = 0;
  for (const it of opts.items) {
    if (positiveKinds.has(it.kind)) {
      subtotal += it.line_total_cents;
      if (it.tippable !== false && tippableKinds.has(it.kind)) tippableBase += it.line_total_cents;
    }
  }

  // Discount (after subtotal)
  let discount = 0;
  if (opts.discountPct && opts.discountPct > 0) discount += Math.round(subtotal * (opts.discountPct / 100));
  if (opts.discountAmountCents && opts.discountAmountCents > 0) discount += opts.discountAmountCents;
  discount = Math.min(discount, subtotal);

  const afterDiscount = subtotal - discount;

  // Tip (computed off of the tippable base, after discount proportionally)
  let tip = 0;
  if (opts.tipAmountCents && opts.tipAmountCents > 0) tip = opts.tipAmountCents;
  else if (opts.tipPct && opts.tipPct > 0) {
    const tippableAfterDiscount = subtotal > 0 ? Math.round(tippableBase * (afterDiscount / subtotal)) : 0;
    tip = Math.round(tippableAfterDiscount * (opts.tipPct / 100));
  }

  // Tax (currently 0)
  const taxableBase = afterDiscount; // not used now
  const tax = opts.taxRatePct ? Math.round(taxableBase * (opts.taxRatePct / 100)) : 0;

  // Processing fee — applied on (afterDiscount + tip + tax)
  const feeBase = afterDiscount + tip + tax;
  const fee = (opts.applyProcessingFee !== false && opts.processingFeePct > 0)
    ? Math.round(feeBase * (opts.processingFeePct / 100))
    : 0;

  const total = afterDiscount + tip + tax + fee;

  // Apply, in order: voucher, banked units, account credit. Each reduces amount due.
  let remaining = total;
  const voucher = Math.min(opts.voucherAmountCents ?? 0, remaining);
  remaining -= voucher;
  const unitBank = Math.min(opts.unitBankAppliedCents ?? 0, remaining);
  remaining -= unitBank;
  const credit = Math.min(opts.creditAppliedCents ?? 0, remaining);
  remaining -= credit;
  const amount_due = Math.max(0, remaining);

  return {
    subtotal_cents: subtotal,
    discount_cents: discount,
    tip_cents: tip,
    processing_fee_cents: fee,
    tax_cents: tax,
    voucher_applied_cents: voucher,
    credit_applied_cents: credit,
    unit_bank_applied_cents: unitBank,
    total_cents: total,
    amount_due_cents: amount_due,
  };
}

export function currentEnv(): "sandbox" | "live" {
  return Deno.env.get("STRIPE_LIVE_API_KEY") ? "live" : "sandbox";
}

// ---------- Vouchers ----------
// Vouchers come in two flavors:
//  • Dollar gift cards — balance_cents holds real value.
//  • Service vouchers — `entitlements` lists covered services; balance_cents is a 1¢ placeholder.
export type VoucherResolution = {
  voucher: any;
  appliedCents: number;
  isEntitlement: boolean;
  label: string;
};

export async function resolveVoucherForSale(
  supa: SupabaseClient,
  code: string,
  requestedAmountCents: number | undefined,
  items: SaleItem[],
): Promise<VoucherResolution | { error: string }> {
  const { data: v } = await supa.from("vouchers").select("*").ilike("code", code.trim()).maybeSingle();
  if (!v) return { error: "Voucher not found" };
  if (!v.is_active) return { error: "Voucher already redeemed or inactive" };
  if (v.expires_at && new Date(v.expires_at) < new Date()) return { error: "Voucher expired" };

  const entitlements = Array.isArray(v.entitlements) ? v.entitlements : [];
  if (entitlements.length > 0) {
    // Service voucher: cover the matching line items, up to the entitled quantity.
    let applied = 0;
    const covered: string[] = [];
    for (const ent of entitlements) {
      const sid = (ent as any)?.service_id;
      const entQty = Number((ent as any)?.quantity ?? 1);
      if (!sid || !(entQty > 0)) continue;
      const line = items.find((it) =>
        ["service", "unit_service", "package"].includes(it.kind) && it.reference_id === sid && it.line_total_cents > 0,
      );
      if (!line) continue;
      const coveredQty = Math.min(Number(line.quantity), entQty);
      const cents = Math.min(line.line_total_cents, Math.round(line.unit_price_cents * coveredQty));
      if (cents > 0) {
        applied += cents;
        const name = (ent as any)?.service_name ?? line.label;
        const unit = (ent as any)?.unit_label ?? "session";
        covered.push(`${name} (${coveredQty} ${unit})`);
      }
    }
    if (applied <= 0) {
      const wanted = entitlements.map((e: any) => e?.service_name).filter(Boolean).join(", ");
      return {
        error: wanted
          ? `This voucher covers ${wanted} — add that service to the sale first`
          : "This voucher doesn't match any items on the sale",
      };
    }
    return { voucher: v, appliedCents: applied, isEntitlement: true, label: covered.join(", ") };
  }

  // Dollar gift card — default to the full remaining balance when no amount given.
  const amount = requestedAmountCents && requestedAmountCents > 0 ? requestedAmountCents : v.balance_cents;
  if (!amount || amount <= 0) return { error: "Voucher has no remaining balance" };
  if (v.balance_cents < amount) return { error: `Voucher balance is only $${(v.balance_cents / 100).toFixed(2)}` };
  return { voucher: v, appliedCents: amount, isEntitlement: false, label: `Gift card ${v.code}` };
}

// Redeem with the service client. Edge functions are already staff-authenticated via
// requireStaff; the redeem_voucher RPC's auth.uid() check always fails for the
// service-role client (auth.uid() is null), so we redeem directly here.
export async function redeemVoucherDirect(
  supa: SupabaseClient,
  res: VoucherResolution,
  saleId: string,
  redeemedBy: string,
): Promise<{ redemptionId: string | null; deductedCents: number } | { error: string }> {
  // Service vouchers are single-use: consume the whole placeholder balance.
  const deduct = res.isEntitlement ? res.voucher.balance_cents : res.appliedCents;
  const newBalance = Math.max(0, res.voucher.balance_cents - deduct);
  const { data: updated, error: upErr } = await supa
    .from("vouchers")
    .update({ balance_cents: newBalance, is_active: newBalance > 0 })
    .eq("id", res.voucher.id)
    .eq("is_active", true)
    .gte("balance_cents", deduct)
    .select("id")
    .maybeSingle();
  if (upErr || !updated) return { error: "Voucher already redeemed or balance changed" };
  const { data: red } = await supa
    .from("voucher_redemptions")
    .insert({ voucher_id: res.voucher.id, sale_id: saleId, amount_cents: res.appliedCents, redeemed_by: redeemedBy })
    .select("id")
    .maybeSingle();
  return { redemptionId: red?.id ?? null, deductedCents: deduct };
}

export async function reverseVoucherDirect(
  supa: SupabaseClient,
  voucherId: string,
  redemptionId: string | null,
  deductedCents: number,
) {
  try {
    const { data: v } = await supa.from("vouchers").select("balance_cents").eq("id", voucherId).maybeSingle();
    if (v) {
      await supa.from("vouchers")
        .update({ balance_cents: (v.balance_cents ?? 0) + deductedCents, is_active: true })
        .eq("id", voucherId);
    }
    if (redemptionId) await supa.from("voucher_redemptions").delete().eq("id", redemptionId);
  } catch (_) { /* best effort */ }
}
