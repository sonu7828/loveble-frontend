// Replace the full set of line items + tip/discount/voucher choices on a draft sale.
// Server recomputes all totals. Client never sets totals directly.
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders, errorResponse, json, requireStaff, recomputeTotals, resolveVoucherForSale } from "../_shared/pos.ts";

const ItemSchema = z.object({
  kind: z.enum(["service", "unit_service", "product", "package", "service_addon", "custom"]),
  reference_id: z.string().uuid().nullable().optional(),
  label: z.string().min(1).max(200),
  quantity: z.number().min(0).max(10000),
  // For `custom` items the client provides the price; for all other kinds it's resolved server-side
  unit_price_cents: z.number().int().min(0).max(10_000_000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const Body = z.object({
  saleId: z.string().uuid(),
  items: z.array(ItemSchema).max(50),
  tipAmountCents: z.number().int().min(0).optional(),
  tipPct: z.number().min(0).max(100).optional(),
  discountAmountCents: z.number().int().min(0).optional(),
  discountPct: z.number().min(0).max(100).optional(),
  discountReason: z.string().max(200).optional(),
  promoCode: z.string().max(50).optional(),
  voucherCode: z.string().max(50).optional(),
  voucherAmountCents: z.number().int().min(0).optional(),
  creditAppliedCents: z.number().int().min(0).optional(),
  unitBankAppliedCents: z.number().int().min(0).optional(),
  pointsRedeemed: z.number().int().min(0).max(1_000_000).optional(),
  applyProcessingFee: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Invalid input: " + JSON.stringify(parsed.error.flatten()));

  const { supa } = auth;
  const { saleId, items, tipAmountCents, tipPct, discountAmountCents, discountPct, discountReason,
    promoCode, voucherCode, voucherAmountCents, creditAppliedCents, unitBankAppliedCents, pointsRedeemed, applyProcessingFee, notes } = parsed.data;

  const { data: sale } = await supa.from("sales").select("*").eq("id", saleId).maybeSingle();
  if (!sale) return errorResponse("Sale not found", 404);
  if (!["draft", "pending_payment"].includes(sale.status)) {
    return errorResponse(`Sale is ${sale.status} and cannot be modified`);
  }

  const { data: loc } = await supa.from("locations").select("processing_fee_pct, tip_enabled").eq("id", sale.location_id).maybeSingle();
  const processingFeePct = Number(loc?.processing_fee_pct ?? 3.5);

  // Resolve each item's price server-side
  const resolvedItems: any[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    let unit_price_cents = 0;
    let label = it.label;
    let tippable = true;
    let taxable = false;
    const metadata: any = it.metadata ?? {};

    if (it.kind === "service") {
      const { data: s } = await supa.from("services").select("name, price_cents, tippable").eq("id", it.reference_id!).maybeSingle();
      if (!s) return errorResponse(`Service not found: ${it.reference_id}`);
      unit_price_cents = s.price_cents ?? 0;
      label = s.name;
      tippable = s.tippable !== false;
    } else if (it.kind === "unit_service") {
      const { data: us } = await supa.from("unit_services").select("price_per_unit_cents, unit_label, services(name, tippable)").eq("service_id", it.reference_id!).maybeSingle();
      if (!us) return errorResponse(`Unit service not configured: ${it.reference_id}`);
      unit_price_cents = us.price_per_unit_cents;
      label = `${(us as any).services?.name ?? "Service"} (${it.quantity} ${us.unit_label})`;
      tippable = (us as any).services?.tippable !== false;
      metadata.unit_label = us.unit_label;
      metadata.units = it.quantity;
    } else if (it.kind === "product" || it.kind === "package" || it.kind === "service_addon") {
      const { data: p } = await supa.from("products").select("name, price_cents, taxable, tippable, kind").eq("id", it.reference_id!).maybeSingle();
      if (p) {
        unit_price_cents = p.price_cents;
        label = p.name;
        taxable = p.taxable;
        tippable = p.tippable;
      } else if (it.kind === "package") {
        const { data: s } = await supa.from("services").select("name, tippable").eq("id", it.reference_id!).maybeSingle();
        if (!s && typeof it.unit_price_cents !== "number") return errorResponse(`Package not found: ${it.reference_id}`);
        unit_price_cents = Math.max(0, Math.round(it.unit_price_cents ?? 0));
        label = it.label?.trim() || (s ? `${s.name} package` : "Package");
        taxable = false;
        tippable = s ? s.tippable !== false : true;
      } else {
        return errorResponse(`Product not found: ${it.reference_id}`);
      }
    } else if (it.kind === "custom") {
      // Custom one-off line item; staff supplies label + price
      if (typeof it.unit_price_cents !== "number") return errorResponse("Custom item requires unit_price_cents");
      unit_price_cents = Math.max(0, Math.round(it.unit_price_cents));
      label = it.label?.trim() || "Custom service";
      tippable = true;
    }

    const line_total_cents = Math.round(unit_price_cents * it.quantity);
    resolvedItems.push({
      sale_id: saleId,
      kind: it.kind,
      reference_id: it.reference_id ?? null,
      label,
      quantity: it.quantity,
      unit_price_cents,
      line_total_cents,
      taxable,
      tippable,
      metadata,
      display_order: i,
    });
  }

  // Validate promo code (if provided)
  let resolvedDiscountPct = discountPct ?? 0;
  let resolvedDiscountAmount = discountAmountCents ?? 0;
  let promoMeta: any = null;
  if (promoCode) {
    const { data: promo } = await supa.from("promo_codes").select("*").ilike("code", promoCode.trim()).eq("is_active", true).maybeSingle();
    if (!promo) return errorResponse("Promo code not valid");
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) return errorResponse("Promo code expired");
    if (promo.starts_at && new Date(promo.starts_at) > new Date()) return errorResponse("Promo code not yet active");
    if (promo.max_uses && promo.used_count >= promo.max_uses) return errorResponse("Promo code fully used");

    promoMeta = { code: promo.code, label: promo.label, id: promo.id };

    if (promo.kind === "percent") {
      resolvedDiscountPct = Math.max(resolvedDiscountPct, Number(promo.value_pct ?? 0));
    } else if (promo.kind === "fixed") {
      resolvedDiscountAmount += promo.value_cents ?? 0;
    } else if (promo.kind === "package_price") {
      // Package price: replaces a unit_service line if conditions met
      const minUnits = (promo.conditions as any)?.min_units ?? 0;
      const targetSvc = promo.applies_to.startsWith("service:") ? promo.applies_to.split(":")[1] : null;
      const matchIdx = resolvedItems.findIndex((it) =>
        ["unit_service", "service"].includes(it.kind) && (!targetSvc || it.reference_id === targetSvc) && it.quantity >= minUnits
      );
      if (matchIdx === -1) return errorResponse(`Promo requires at least ${minUnits} units of the qualifying service`);
      const matched = resolvedItems[matchIdx];
      const packagePrice = promo.value_cents ?? 0;
      const promoUnits = minUnits;
      const remainingUnits = matched.quantity - promoUnits;
      // Replace original line with package line
      resolvedItems[matchIdx] = {
        ...matched,
        kind: "package",
        label: `${matched.label.split(" (")[0]} — ${promo.label}`,
        quantity: 1,
        unit_price_cents: packagePrice,
        line_total_cents: packagePrice,
        metadata: { ...matched.metadata, promo_code: promo.code, original_units: matched.quantity, package_units: promoUnits },
      };
      // Add remainder line if any units left
      if (remainingUnits > 0) {
        resolvedItems.splice(matchIdx + 1, 0, {
          ...matched,
          quantity: remainingUnits,
          line_total_cents: matched.unit_price_cents * remainingUnits,
          label: `${matched.label.split(" (")[0]} (${remainingUnits} ${(matched.metadata as any)?.unit_label ?? "unit"} additional)`,
          kind: matched.kind,
          metadata: { ...matched.metadata, units: remainingUnits, promo_remainder_of: promo.code },
        });
        // Re-number display_order
        resolvedItems.forEach((it, i) => (it.display_order = i));
      }
    }
  }

  // Validate voucher (we just validate here; actual redeem happens at finalize).
  // Supports both dollar gift cards and service-entitlement vouchers (no amount needed).
  let voucherInfo: any = null;
  let voucherAppliedCents = 0;
  if (voucherCode && voucherCode.trim()) {
    const res = await resolveVoucherForSale(supa, voucherCode, voucherAmountCents, resolvedItems as any);
    if ("error" in res) return errorResponse(res.error);
    voucherAppliedCents = res.appliedCents;
    voucherInfo = {
      id: res.voucher.id,
      code: res.voucher.code,
      balance_cents: res.voucher.balance_cents,
      is_entitlement: res.isEntitlement,
      applied_cents: res.appliedCents,
      label: res.label,
    };
  }

  // Resolve points redemption (server-side validation + caps)
  let pointsApplied = 0;
  let pointsValueCents = 0;
  let pointsInfo: any = null;
  if ((pointsRedeemed ?? 0) > 0 && sale.client_email) {
    const { data: settings } = await supa.from("client_points_settings").select("*").eq("id", true).maybeSingle();
    if (!settings?.is_enabled) {
      return errorResponse("Rewards program is disabled");
    }
    if (settings.block_promo_combo && (promoMeta || (resolvedDiscountAmount + (resolvedDiscountPct ? 1 : 0)) > 0)) {
      return errorResponse("Points cannot be combined with promo codes or manual discounts");
    }
    const { data: balRow } = await supa.rpc("get_points_balance", { _client_email: sale.client_email });
    const available = Number(balRow ?? 0);
    if (pointsRedeemed! > available) {
      return errorResponse(`Only ${available} points available`);
    }
    pointsApplied = pointsRedeemed!;
    pointsValueCents = pointsApplied * Number(settings.point_value_cents ?? 10);
    pointsInfo = { points: pointsApplied, value_cents: pointsValueCents, balance_before: available };
  }

  const totals = recomputeTotals({
    items: resolvedItems,
    tipAmountCents,
    tipPct,
    discountAmountCents: resolvedDiscountAmount,
    discountPct: resolvedDiscountPct,
    voucherAmountCents: voucherAppliedCents,
    // Treat points-value as another credit deduction in the same bucket as account credit.
    creditAppliedCents: (creditAppliedCents ?? 0) + pointsValueCents,
    unitBankAppliedCents: unitBankAppliedCents ?? 0,
    processingFeePct,
    applyProcessingFee: applyProcessingFee !== false,
  });

  // Enforce 50% cap on point value vs total before tip+fee
  if (pointsApplied > 0) {
    const { data: settings2 } = await supa.from("client_points_settings").select("max_redemption_pct").eq("id", true).maybeSingle();
    const cap = Number(settings2?.max_redemption_pct ?? 50);
    const capBase = totals.subtotal_cents - totals.discount_cents;
    const capValue = Math.floor((capBase * cap) / 100);
    if (pointsValueCents > capValue) {
      return errorResponse(`Points value $${(pointsValueCents/100).toFixed(2)} exceeds ${cap}% cap ($${(capValue/100).toFixed(2)})`);
    }
  }

  // Replace items
  await supa.from("sale_items").delete().eq("sale_id", saleId);
  if (resolvedItems.length) await supa.from("sale_items").insert(resolvedItems);

  // Persist tip/discount/voucher info in sale metadata
  await supa.from("sales").update({
    ...totals,
    notes: notes ?? sale.notes,
    discount_pct: resolvedDiscountPct > 0 ? resolvedDiscountPct : null,
    discount_amount_cents: resolvedDiscountAmount > 0 ? resolvedDiscountAmount : null,
    discount_reason: discountReason && discountReason.trim() ? discountReason.trim() : null,
    promo_code: promoMeta?.code ?? null,
    points_redeemed: pointsApplied,
  }).eq("id", saleId);

  return json({
    saleId,
    totals,
    promo: promoMeta,
    voucher: voucherInfo,
    points: pointsInfo,
    items: resolvedItems,
    discountReason: discountReason ?? null,
  });
});
