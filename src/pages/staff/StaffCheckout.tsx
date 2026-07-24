import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { withUndo } from "@/lib/undoToast";

import { fmt, LineItem, functionErrorMessage } from "./checkout/shared";
import { WalkInSetupScreen } from "./checkout/WalkInSetupScreen";
import { PaymentMonitorScreen } from "./checkout/PaymentMonitorScreen";
import { PaidSuccessScreen } from "./checkout/PaidSuccessScreen";
import { TipPanel } from "./checkout/TipPanel";
import { DiscountsPanel } from "./checkout/DiscountsPanel";
import { QuickAddPanel } from "./checkout/QuickAddPanel";
import { CreditsPanel } from "./checkout/CreditsPanel";
import { PaymentActionsPanel } from "./checkout/PaymentActionsPanel";
import { CheckoutCart } from "./checkout/CheckoutCart";
import { TotalsPanel } from "./checkout/TotalsPanel";
import { ReceiptPreviewSheet } from "./checkout/ReceiptPreviewSheet";
import { PointsPanel } from "./checkout/PointsPanel";
import { PaymentDialogs } from "./checkout/PaymentDialogs";
import { EligibilityStrip } from "./checkout/EligibilityStrip";
import { CheckoutProposalBanner } from "./checkout/CheckoutProposalBanner";
import { usePaymentPolling } from "./checkout/usePaymentPolling";
import { usePaidRedirect } from "./checkout/usePaidRedirect";
import { useClientSearch } from "./checkout/useClientSearch";
import { computeServiceCreditDiscount, sumClaimedServiceCredits, clampCreditApply, isUnitBankCredit } from "./checkout/creditMath";

export default function StaffCheckout() {
  const { appointmentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [paymentMonitorActive, setPaymentMonitorActive] = useState(false);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [sale, setSale] = useState<any>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [unitServices, setUnitServices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [readers, setReaders] = useState<any[]>([]);
  const [tipPct, setTipPct] = useState<number | null>(20);
  const [tipCustom, setTipCustom] = useState<string>("");
  const [promoCode, setPromoCode] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherAmount, setVoucherAmount] = useState<string>("");
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; is_entitlement: boolean; applied_cents: number; label: string } | null>(null);
  const [discountPct, setDiscountPct] = useState<string>("");
  const [discountAmount, setDiscountAmount] = useState<string>("");
  const [discountReason, setDiscountReason] = useState("");
  const [discountReasonCustom, setDiscountReasonCustom] = useState("");
  const [applyFee, setApplyFee] = useState(true);
  const [readerId, setReaderId] = useState<string>("");
  const [searchQ, setSearchQ] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [totals, setTotals] = useState<any>({ subtotal_cents: 0, discount_cents: 0, tip_cents: 0, processing_fee_cents: 0, voucher_applied_cents: 0, total_cents: 0, amount_due_cents: 0 });
  const [manualCard, setManualCard] = useState<{ clientSecret: string; amountDueCents: number } | null>(null);
  const [affirmLink, setAffirmLink] = useState<{ url: string; amountDueCents: number } | null>(null);
  const [creditBalanceCents, setCreditBalanceCents] = useState<number>(0);
  const [creditApply, setCreditApply] = useState<string>("");
  const [serviceCredits, setServiceCredits] = useState<Array<{ id: string; kind: string; service_id: string | null; service_label: string | null; units: number | null; amount_cents: number; reason: string }>>([]);
  const [claimedCreditIds, setClaimedCreditIds] = useState<string[]>([]);
  const [walkInCardOnFile, setWalkInCardOnFile] = useState<{ brand: string | null; last4: string | null } | null>(null);
  const [pointsBalance, setPointsBalance] = useState<number>(0);
  const [pointsApply, setPointsApply] = useState<string>("");
  const [pointsSettings, setPointsSettings] = useState<{ point_value_cents: number; max_redemption_pct: number; block_promo_combo: boolean; is_enabled: boolean } | null>(null);

  // Walk-in setup (when there's no appointmentId)
  const [walkInLocations, setWalkInLocations] = useState<any[]>([]);
  const [walkInLocationId, setWalkInLocationId] = useState<string>("");
  const [walkInFirstName, setWalkInFirstName] = useState("");
  const [walkInLastName, setWalkInLastName] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInStarting, setWalkInStarting] = useState(false);
  const { clientSearch, setClientSearch, clientResults, clientSearching, buildPickClient } =
    useClientSearch(!appointmentId && !sale);
  const pickClient = buildPickClient(setWalkInFirstName, setWalkInLastName, setWalkInEmail, setWalkInPhone);

  const loadSaleData = useCallback(async (sId: string) => {
    const [{ data: s }, { data: it }, { data: svc }, { data: us }, { data: prods }, { data: readerRows, error: readerError }] = await Promise.all([
      supabase.from("sales").select("*").eq("id", sId).maybeSingle(),
      supabase.from("sale_items").select("*").eq("sale_id", sId).order("display_order"),
      supabase.from("services").select("id, name, price_cents, tippable, is_featured").eq("is_active", true).order("name"),
      supabase.from("unit_services").select("service_id, price_per_unit_cents, unit_label, min_units, max_units, services(name)").eq("is_active", true),
      supabase.from("products").select("id, name, price_cents, kind, taxable, tippable").eq("is_active", true).order("display_order"),
      supabase.from("terminal_readers").select("*").eq("is_active", true).order("created_at", { ascending: false }),
    ]);
    setSale(s);
    if (s) {
      setTotals({
        subtotal_cents: s.subtotal_cents ?? 0,
        discount_cents: s.discount_cents ?? 0,
        tip_cents: s.tip_cents ?? 0,
        processing_fee_cents: s.processing_fee_cents ?? 0,
        voucher_applied_cents: s.voucher_applied_cents ?? 0,
        total_cents: s.total_cents ?? 0,
        amount_due_cents: s.amount_due_cents ?? s.total_cents ?? 0,
      });
    }
    setItems((it ?? []).map((row: any) => ({
      kind: row.kind, reference_id: row.reference_id, label: row.label, quantity: Number(row.quantity),
      unit_price_cents: row.unit_price_cents, line_total_cents: row.line_total_cents,
      metadata: row.metadata ?? {}, tippable: row.tippable, taxable: row.taxable,
    })));
    setServices(svc ?? []);
    setUnitServices(us ?? []);
    setProducts(prods ?? []);
    if (readerError) {
      toast.error(`Could not load paired readers: ${readerError.message}`);
    }
    const allActive = (readerRows ?? []).filter((r: any) => r.is_active);
    const sameLoc = allActive.filter((r: any) => r.location_id === s?.location_id);
    const rs = sameLoc.length > 0 ? sameLoc : allActive;
    setReaders(rs);
    setReaderId((current) => current && rs.some((r: any) => r.id === current) ? current : (rs[0]?.id ?? ""));
    // Load points settings (independent of client)
    const { data: ps } = await supabase.from("client_points_settings" as any).select("*").eq("id", true).maybeSingle();
    setPointsSettings(ps as any);
    if (s?.client_email) {
      const [{ data: bal }, { data: svcCreds }, { data: cards }, { data: pts }] = await Promise.all([
        supabase
          .from("client_credit_balances" as any)
          .select("balance_cents")
          .ilike("client_email", s.client_email)
          .maybeSingle(),
        supabase
          .from("client_service_credits_available" as any)
          .select("id, kind, service_id, service_label, units, amount_cents, reason")
          .ilike("client_email", s.client_email),
        supabase
          .from("client_payment_methods")
          .select("brand, last4, is_default")
          .ilike("client_email", s.client_email)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.rpc("get_points_balance" as any, { _client_email: s.client_email }),
      ]);
      setCreditBalanceCents(Math.max(0, (bal as any)?.balance_cents ?? 0));
      setServiceCredits((svcCreds as any) ?? []);
      const c = (cards as any[])?.[0];
      setWalkInCardOnFile(c ? { brand: c.brand, last4: c.last4 } : null);
      setPointsBalance(Math.max(0, Number(pts ?? 0)));
    } else {
      setCreditBalanceCents(0);
      setServiceCredits([]);
      setWalkInCardOnFile(null);
      setPointsBalance(0);
    }
    setLoading(false);
  }, []);

  const startAppointmentSale = useCallback(async () => {
    if (!appointmentId) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("pos-create-or-get-sale", { body: { appointmentId } });
    if (error || data?.error) { toast.error(data?.error || await functionErrorMessage(error, "Could not start checkout")); setLoading(false); return; }
    setSaleId(data.saleId);
    await loadSaleData(data.saleId);
  }, [appointmentId, loadSaleData]);

  const startWalkInSale = useCallback(async () => {
    if (!walkInLocationId) { toast.error("Pick a location"); return; }
    if (!walkInFirstName.trim() || !walkInLastName.trim()) { toast.error("Enter client name"); return; }
    setWalkInStarting(true);
    const body: any = {
      locationId: walkInLocationId,
      clientFirstName: walkInFirstName.trim(),
      clientLastName: walkInLastName.trim(),
    };
    if (walkInEmail.trim()) body.clientEmail = walkInEmail.trim();
    if (walkInPhone.trim()) body.clientPhone = walkInPhone.trim();
    const { data, error } = await supabase.functions.invoke("pos-create-or-get-sale", { body });
    setWalkInStarting(false);
    if (error || data?.error) { toast.error(data?.error || await functionErrorMessage(error, "Could not start walk-in checkout")); return; }
    setSaleId(data.saleId);
    setLoading(true);
    await loadSaleData(data.saleId);
  }, [walkInLocationId, walkInFirstName, walkInLastName, walkInEmail, walkInPhone, loadSaleData]);

  useEffect(() => {
    if (appointmentId) {
      startAppointmentSale();
    } else {
      setLoading(false);
      const qFirst = searchParams.get("first") || searchParams.get("firstName") || "";
      const qLast = searchParams.get("last") || searchParams.get("lastName") || "";
      const qEmail = searchParams.get("email") || "";
      const qPhone = searchParams.get("phone") || "";
      const qLoc = searchParams.get("locationId") || "";
      if (qFirst) setWalkInFirstName(qFirst);
      if (qLast) setWalkInLastName(qLast);
      if (qEmail) setWalkInEmail(qEmail);
      if (qPhone) setWalkInPhone(qPhone);
      supabase.from("locations").select("id, name").eq("is_active", true).order("name").then(({ data }) => {
        setWalkInLocations(data ?? []);
        if (qLoc && data?.some((l: any) => l.id === qLoc)) setWalkInLocationId(qLoc);
        else if (data && data.length === 1) setWalkInLocationId(data[0].id);
      });
    }
  }, [appointmentId, startAppointmentSale, searchParams]);

  usePaymentPolling({ saleId, sale, paymentMonitorActive, setSale, setPaymentMonitorActive });
  const redirectSecs = usePaidRedirect(sale?.status, appointmentId);

  const confirmManualCardPaid = useCallback(async () => {
    if (!saleId) return false;
    await supabase.functions.invoke("pos-confirm-payment", { body: { saleId } });
    const { data: s } = await supabase.from("sales").select("*").eq("id", saleId).maybeSingle();
    if (s) {
      setSale(s);
      if (s.status === "paid") {
        setPaymentMonitorActive(false);
        toast.success(s.client_email ? `Payment collected — receipt sent to ${s.client_email}` : "Payment collected");
        return true;
      }
    }
    setPaymentMonitorActive(true);
    return false;
  }, [saleId]);

  const recompute = useCallback(async (overrides: Partial<{
    items: LineItem[]; promoCode: string; voucherCode: string; voucherAmountCents: number;
    discountPct: number; discountAmountCents: number; tipPct: number | null; tipAmount: number; applyFee: boolean;
  }> = {}) => {
    if (!saleId) return;
    const useItems = overrides.items ?? items;
    const useTipPct = overrides.tipPct !== undefined ? overrides.tipPct : tipPct;
    const customTip = tipCustom ? Math.round(parseFloat(tipCustom) * 100) : 0;
    const useTipAmt = overrides.tipAmount !== undefined ? overrides.tipAmount : (useTipPct === null ? customTip : undefined);
    const dPct = overrides.discountPct !== undefined ? overrides.discountPct : (discountPct ? parseFloat(discountPct) : 0);
    const dAmtCents = overrides.discountAmountCents !== undefined ? overrides.discountAmountCents : (discountAmount ? Math.round(parseFloat(discountAmount) * 100) : 0);
    const vCents = overrides.voucherAmountCents !== undefined ? overrides.voucherAmountCents : (voucherAmount ? Math.round(parseFloat(voucherAmount) * 100) : 0);
    const body: any = {
      saleId,
      items: useItems.map((i) => ({ kind: i.kind, reference_id: i.reference_id, label: i.label, quantity: i.quantity, metadata: i.metadata, ...(i.kind === "custom" ? { unit_price_cents: i.unit_price_cents } : {}) })),
      applyProcessingFee: overrides.applyFee !== undefined ? overrides.applyFee : applyFee,
    };
    if (useTipPct !== null && useTipPct !== undefined) body.tipPct = useTipPct;
    if (useTipAmt !== undefined && useTipAmt > 0) { body.tipAmountCents = useTipAmt; delete body.tipPct; }
    if (dPct > 0) body.discountPct = dPct;
    if (dAmtCents > 0) body.discountAmountCents = dAmtCents;
    const reasonOut = discountReason === "Other" ? discountReasonCustom : discountReason;
    if (reasonOut) body.discountReason = reasonOut;
    const code = overrides.promoCode !== undefined ? overrides.promoCode : promoCode;
    if (code) body.promoCode = code;
    const vCode = overrides.voucherCode !== undefined ? overrides.voucherCode : voucherCode;
    if (vCode && vCode.trim()) {
      body.voucherCode = vCode.trim();
      if (vCents > 0) body.voucherAmountCents = vCents;
    }
    const ptsNum = Math.max(0, Math.floor(Number(pointsApply || 0)));
    if (ptsNum > 0) body.pointsRedeemed = ptsNum;

    const { data, error } = await supabase.functions.invoke("pos-update-sale", { body });
    if (error || data?.error) { toast.error(data?.error || await functionErrorMessage(error, "Could not update checkout totals")); return; }
    setItems(data.items.map((i: any) => ({
      kind: i.kind, reference_id: i.reference_id, label: i.label, quantity: Number(i.quantity),
      unit_price_cents: i.unit_price_cents, line_total_cents: i.line_total_cents, metadata: i.metadata,
      tippable: i.tippable, taxable: i.taxable,
    })));
    setTotals(data.totals);
    setAppliedVoucher(data.voucher ?? null);
    if (data.voucher && overrides.voucherCode === undefined && vCode) {
      if (data.voucher.is_entitlement) toast.success(`Voucher claimed — covers ${data.voucher.label}`);
    }
  }, [saleId, items, tipPct, tipCustom, discountPct, discountAmount, discountReason, discountReasonCustom, promoCode, voucherCode, voucherAmount, applyFee, pointsApply]);

  useEffect(() => {
    if (!saleId || loading) return;
    const t = setTimeout(() => { recompute(); }, 400);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [tipPct, tipCustom, discountPct, discountAmount, discountReason, discountReasonCustom, applyFee, voucherAmount, pointsApply]);

  useEffect(() => {
    if (saleId && !loading && items.length > 0 && totals.subtotal_cents === 0) {
      recompute({ items });
    }
    // eslint-disable-next-line
  }, [saleId, loading]);

  const addService = (id: string) => {
    const s = services.find((x) => x.id === id); if (!s) return;
    const existing = items.findIndex((it) => it.kind === "service" && it.reference_id === id);
    if (existing !== -1) { toast.info(`${s.name} is already on the checkout. Edit the quantity or remove it first.`); return; }
    const next: LineItem[] = [...items, { kind: "service" as const, reference_id: id, label: s.name, quantity: 1, unit_price_cents: s.price_cents ?? 0, line_total_cents: s.price_cents ?? 0, tippable: s.tippable, metadata: {} }];
    setItems(next); recompute({ items: next });
  };
  const addUnit = (svcId: string) => {
    const us = unitServices.find((x) => x.service_id === svcId); if (!us) return;
    const existing = items.findIndex((it) => it.kind === "unit_service" && it.reference_id === svcId);
    if (existing !== -1) { toast.info(`${us.services?.name ?? "Service"} is already on the checkout. Enter the units in the quantity box.`); return; }
    const next: LineItem[] = [...items, { kind: "unit_service" as const, reference_id: svcId, label: `${us.services?.name} (1 ${us.unit_label})`, quantity: 1, unit_price_cents: us.price_per_unit_cents, line_total_cents: us.price_per_unit_cents, metadata: { unit_label: us.unit_label, units: 1 } }];
    setItems(next); recompute({ items: next });
  };
  const addProduct = (id: string) => {
    const p = products.find((x) => x.id === id); if (!p) return;
    const kind = (p.kind === "package" ? "package" : p.kind === "service_addon" ? "service_addon" : "product") as LineItem["kind"];
    const existing = items.findIndex((it) => it.kind === kind && it.reference_id === id);
    if (existing !== -1) { toast.info(`${p.name} is already on the checkout. Edit the quantity or remove it first.`); return; }
    const next: LineItem[] = [...items, { kind, reference_id: id, label: p.name, quantity: 1, unit_price_cents: p.price_cents, line_total_cents: p.price_cents, tippable: p.tippable, taxable: p.taxable, metadata: {} }];
    setItems(next); recompute({ items: next });
  };
  const addCustom = (label: string, priceDollars: string) => {
    const cents = Math.round(parseFloat(priceDollars) * 100);
    if (!label.trim()) { toast.error("Enter a service name"); return; }
    if (!Number.isFinite(cents) || cents < 0) { toast.error("Enter a valid price"); return; }
    const next = [...items, { kind: "custom" as const, reference_id: null, label: label.trim(), quantity: 1, unit_price_cents: cents, line_total_cents: cents, tippable: true, metadata: { custom: true } }];
    setItems(next); recompute({ items: next });
  };
  const updateQty = (idx: number, q: number) => {
    const qq = Math.max(0, Math.min(500, q));
    const next = items.map((it, i) => i === idx ? { ...it, quantity: qq, line_total_cents: it.unit_price_cents * qq, metadata: { ...(it.metadata ?? {}), units: it.kind === "unit_service" ? qq : it.metadata?.units } } : it);
    setItems(next);
  };
  const removeItem = (idx: number) => {
    const removed = items[idx];
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    withUndo({
      label: `Removed “${removed?.label ?? "item"}”`,
      onUndo: () => {
        setItems((curr) => {
          const restored = [...curr];
          restored.splice(idx, 0, removed);
          return restored;
        });
        recompute({ items });
      },
      commit: () => { recompute({ items: next }); },
    });
  };

  // Auto-apply unit-bank credits whenever the matching unit_service line has qty > 0.
  // Auto-remove when the line drops to 0 — staff never has to press "Claim" for these.
  useEffect(() => {
    const autoIds = serviceCredits
      .filter(c => isUnitBankCredit(c) && computeServiceCreditDiscount(c, items) > 0)
      .map(c => c.id);
    setClaimedCreditIds(prev => {
      // Drop unit-bank ids that no longer have a matching cart line.
      const kept = prev.filter(id => {
        const c = serviceCredits.find(x => x.id === id);
        if (!c || !isUnitBankCredit(c)) return true;
        return autoIds.includes(id);
      });
      const merged = Array.from(new Set([...kept, ...autoIds]));
      // Avoid an infinite re-render loop when nothing changed.
      if (merged.length === prev.length && merged.every(id => prev.includes(id))) return prev;
      return merged;
    });
  }, [items, serviceCredits]);

  const claimedServiceCreditCents = sumClaimedServiceCredits(serviceCredits, claimedCreditIds, items);
  const creditCents = clampCreditApply(creditApply, creditBalanceCents, totals.amount_due_cents, claimedServiceCreditCents);
  const netDueCents = Math.max(0, totals.amount_due_cents - claimedServiceCreditCents - creditCents);

  const recordCreditApplication = async () => {
    if (!sale?.client_email || creditCents <= 0) return;
    const { error } = await supabase.from("client_credits").insert({
      client_email: sale.client_email,
      amount_cents: -creditCents,
      reason: "applied_to_sale",
      note: `Applied to sale ${saleId}`,
      appointment_id: sale.appointment_id ?? null,
      kind: "dollar",
    });
    if (error) {
      toast.error(`Sale paid but account credit was not deducted: ${error.message}`);
    } else {
      setCreditBalanceCents((b) => Math.max(0, b - creditCents));
      setCreditApply("");
    }
  };

  const recordServiceCreditRedemptions = async () => {
    if (!saleId || claimedCreditIds.length === 0) return;
    const claimed = serviceCredits.filter(c => claimedCreditIds.includes(c.id));
    const results = await Promise.all(claimed.map(c => {
      const usedCents = computeServiceCreditDiscount(c, items);
      // Unit-bank partial: decrement units & amount; keep the credit active for next visit.
      if (isUnitBankCredit(c) && c.units && usedCents > 0 && usedCents < c.amount_cents) {
        const pricePerUnit = c.amount_cents / c.units;
        const unitsUsed = Math.min(c.units, Math.round(usedCents / pricePerUnit));
        const newUnits = Math.max(0, c.units - unitsUsed);
        const newAmount = Math.max(0, c.amount_cents - usedCents);
        if (newUnits > 0 && newAmount > 0) {
          return supabase.from("client_credits").update({
            units: newUnits,
            amount_cents: newAmount,
            service_label: c.service_label?.replace(/^\d+\s*units/i, `${newUnits} units`) ?? c.service_label,
            note: `Partial redemption on sale ${saleId} (−${unitsUsed} units)`,
          }).eq("id", c.id);
        }
      }
      return supabase.from("client_credits").update({
        redeemed_at: new Date().toISOString(),
        redeemed_sale_id: saleId,
        redeemed_amount_cents: usedCents,
      }).eq("id", c.id);
    }));
    const errs = results.filter(r => r.error);
    if (errs.length > 0) {
      toast.error(`Sale paid but ${errs.length} service credit(s) not marked redeemed`);
    } else {
      // Reload credits so partials show updated remaining units immediately.
      if (sale?.client_email) {
        const { data: refreshed } = await supabase
          .from("client_service_credits_available" as any)
          .select("id, kind, service_id, service_label, units, amount_cents, reason")
          .ilike("client_email", sale.client_email);
        setServiceCredits((refreshed as any) ?? []);
      } else {
        setServiceCredits(curr => curr.filter(c => !claimedCreditIds.includes(c.id)));
      }
      setClaimedCreditIds([]);
    }
  };

  // Track credits/service-credits that should be applied AFTER the payment is
  // confirmed paid. Previously these were debited synchronously on terminal/
  // manual-card/Affirm paths — so a decline or cancel silently consumed the
  // client's balance. Now we snapshot the intent here and replay it only when
  // sale.status flips to "paid" (via the polling/webhook update).
  const pendingCreditsRef = useRef<null | {
    creditCents: number;
    claimedCreditIds: string[];
  }>(null);
  const snapshotPendingCredits = () => {
    if (creditCents > 0 || claimedCreditIds.length > 0) {
      pendingCreditsRef.current = { creditCents, claimedCreditIds: [...claimedCreditIds] };
    }
  };
  const flushPendingCredits = useCallback(async () => {
    const snap = pendingCreditsRef.current;
    if (!snap) return;
    pendingCreditsRef.current = null;
    // Run with whichever snapshot was captured at finalize time — the live
    // creditCents / claimedCreditIds in state may have been cleared by
    // subsequent UI updates.
    if (snap.creditCents > 0 && sale?.client_email && saleId) {
      const { error } = await supabase.from("client_credits").insert({
        client_email: sale.client_email,
        amount_cents: -snap.creditCents,
        reason: "applied_to_sale",
        note: `Applied to sale ${saleId}`,
        appointment_id: sale.appointment_id ?? null,
        kind: "dollar",
      });
      if (error) toast.error(`Sale paid but account credit was not deducted: ${error.message}`);
      else {
        setCreditBalanceCents((b) => Math.max(0, b - snap.creditCents));
        setCreditApply("");
      }
    }
    if (snap.claimedCreditIds.length > 0 && saleId) {
      const claimed = serviceCredits.filter(c => snap.claimedCreditIds.includes(c.id));
      const results = await Promise.all(claimed.map(c => {
        const usedCents = computeServiceCreditDiscount(c, items);
        if (isUnitBankCredit(c) && c.units && usedCents > 0 && usedCents < c.amount_cents) {
          const pricePerUnit = c.amount_cents / c.units;
          const unitsUsed = Math.min(c.units, Math.round(usedCents / pricePerUnit));
          const newUnits = Math.max(0, c.units - unitsUsed);
          const newAmount = Math.max(0, c.amount_cents - usedCents);
          if (newUnits > 0 && newAmount > 0) {
            return supabase.from("client_credits").update({
              units: newUnits,
              amount_cents: newAmount,
              service_label: c.service_label?.replace(/^\d+\s*units/i, `${newUnits} units`) ?? c.service_label,
              note: `Partial redemption on sale ${saleId} (−${unitsUsed} units)`,
            }).eq("id", c.id);
          }
        }
        return supabase.from("client_credits").update({
          redeemed_at: new Date().toISOString(),
          redeemed_sale_id: saleId,
          redeemed_amount_cents: usedCents,
        }).eq("id", c.id);
      }));
      const errs = results.filter(r => r.error);
      if (errs.length > 0) toast.error(`Sale paid but ${errs.length} service credit(s) not marked redeemed`);
      else setClaimedCreditIds([]);
    }
  }, [sale?.client_email, sale?.appointment_id, saleId, serviceCredits, items]);

  // Fire pending credit application the moment a previously-pending sale flips to paid.
  useEffect(() => {
    if (sale?.status === "paid" && pendingCreditsRef.current) {
      void flushPendingCredits();
    }
  }, [sale?.status, flushPendingCredits]);

  const finalize = async (paymentMethod: "terminal" | "card_on_file" | "manual_card_intent" | "cash" | "credit_only" | "affirm") => {
    if (!saleId) return;
    if (paymentMethod === "credit_only") {
      if (creditCents <= 0 && claimedServiceCreditCents <= 0) { toast.error("Apply a credit first"); return; }
      if (netDueCents > 0) { toast.error("Credit doesn't fully cover the sale — choose another method for the remainder"); return; }
    }
    if (paymentMethod === "terminal" && netDueCents === 0 && creditCents <= 0) { return; }
    if (paymentMethod === "terminal" && !readerId && netDueCents > 0) { toast.error("Pick a reader first"); return; }
    setWorking(true);
    const customTip = tipCustom ? Math.round(parseFloat(tipCustom) * 100) : 0;
    const body: any = { saleId, paymentMethod, applyProcessingFee: applyFee };
    if (paymentMethod === "terminal") body.readerId = readerId;
    if (tipPct !== null) body.tipPct = tipPct; else body.tipAmountCents = customTip;
    if (discountPct) body.discountPct = parseFloat(discountPct);
    const manualDiscountCents = discountAmount ? Math.round(parseFloat(discountAmount) * 100) : 0;
    const totalDiscountCents = manualDiscountCents + claimedServiceCreditCents;
    if (totalDiscountCents > 0) body.discountAmountCents = totalDiscountCents;
    if (creditCents > 0) body.creditAppliedCents = creditCents;
    const claimedLabels = serviceCredits
      .filter(c => claimedCreditIds.includes(c.id))
      .map(c => c.service_label || "Service credit");
    const baseReason = discountReason === "Other" ? discountReasonCustom : discountReason;
    const reasonOut = [baseReason, claimedLabels.length ? `Service credit: ${claimedLabels.join(", ")}` : ""]
      .filter(Boolean).join(" + ");
    if (reasonOut) body.discountReason = reasonOut;
    if (promoCode) body.promoCode = promoCode;
    if (voucherCode && voucherCode.trim()) {
      body.voucherCode = voucherCode.trim();
      const vc = voucherAmount ? Math.round(parseFloat(voucherAmount) * 100) : 0;
      if (vc > 0) body.voucherAmountCents = vc;
    }
    const ptsNum = Math.max(0, Math.floor(Number(pointsApply || 0)));
    if (ptsNum > 0) body.pointsRedeemed = ptsNum;

    const saveBody = {
      ...body,
      items: items.map((i) => ({
        kind: i.kind,
        reference_id: i.reference_id,
        label: i.label,
        quantity: i.quantity,
        metadata: i.metadata,
        ...(i.kind === "custom" ? { unit_price_cents: i.unit_price_cents } : {}),
      })),
    };
    delete (saveBody as any).paymentMethod;
    delete (saveBody as any).readerId;
    const saved = await supabase.functions.invoke("pos-update-sale", { body: saveBody });
    if (saved.error || saved.data?.error) {
      setWorking(false);
      toast.error(saved.data?.error || await functionErrorMessage(saved.error, "Could not save checkout before payment"));
      return;
    }

    let { data, error } = await supabase.functions.invoke("pos-finalize-sale", { body });
    // Duplicate-charge guard returns 409 with a confirmation message.
    const dupMsg: string | undefined = data?.error;
    if (dupMsg && /duplicate/i.test(dupMsg) && /already charged/i.test(dupMsg)) {
      if (window.confirm(`${dupMsg}\n\nCharge this client again anyway?`)) {
        ({ data, error } = await supabase.functions.invoke("pos-finalize-sale", { body: { ...body, acknowledgeDuplicate: true } }));
      } else {
        setWorking(false);
        return;
      }
    }
    setWorking(false);
    if (error || data?.error) { toast.error(data?.error || await functionErrorMessage(error, "Could not complete checkout")); return; }
    if (data.status === "paid") {
      setPaymentMonitorActive(false);
      // Sale completed immediately (cash / credit-only / zero-amount) — apply now.
      await recordCreditApplication(); await recordServiceCreditRedemptions();
      const { data: paidSale } = await supabase.from("sales").select("*").eq("id", saleId).maybeSingle();
      if (paidSale) setSale(paidSale);
      const email = sale?.client_email;
      toast.success(email ? `Payment collected — receipt sent to ${email}` : "Payment collected");
    }
    else if (data.status === "reader_in_progress") {
      // Snapshot the credit intent; we'll apply it only when the payment is
      // confirmed paid (effect on sale.status === "paid"). Previously we
      // debited immediately — a decline / cancel silently consumed credit.
      snapshotPendingCredits();
      setSale((prev: any) => ({ ...prev, status: "pending_payment", payment_method: "terminal", reader_action_status: "in_progress", stripe_payment_intent_id: data.paymentIntentId }));
      setPaymentMonitorActive(true);
      toast.success("Sent to reader — finish on the device.");
    }
    else if (data.status === "pending_payment") {
      snapshotPendingCredits();
      setSale((prev: any) => ({ ...prev, status: "pending_payment", payment_method: "card_on_file", stripe_payment_intent_id: data.paymentIntentId }));
      setPaymentMonitorActive(true);
    }
    else if (data.status === "awaiting_card" && data.clientSecret) {
      snapshotPendingCredits();
      setManualCard({ clientSecret: data.clientSecret, amountDueCents: data.amountDue ?? netDueCents });
    }
    else if (data.status === "affirm_link" && data.url) {
      snapshotPendingCredits();
      setAffirmLink({ url: data.url, amountDueCents: data.amountDue ?? netDueCents });
      toast.success("Affirm link ready — share the QR or send by email.");
    }
  };

  if (loading) return <div className="p-12 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading checkout…</div>;

  // Walk-in setup: no appointment selected yet
  if (!appointmentId && !sale) {
    return (
      <WalkInSetupScreen
        clientSearch={clientSearch}
        setClientSearch={setClientSearch}
        clientSearching={clientSearching}
        clientResults={clientResults}
        pickClient={pickClient}
        walkInLocations={walkInLocations}
        walkInLocationId={walkInLocationId}
        setWalkInLocationId={setWalkInLocationId}
        walkInFirstName={walkInFirstName}
        setWalkInFirstName={setWalkInFirstName}
        walkInLastName={walkInLastName}
        setWalkInLastName={setWalkInLastName}
        walkInEmail={walkInEmail}
        setWalkInEmail={setWalkInEmail}
        walkInPhone={walkInPhone}
        setWalkInPhone={setWalkInPhone}
        walkInStarting={walkInStarting}
        startWalkInSale={startWalkInSale}
      />
    );
  }

  if (!sale) return <div className="p-12">Sale not found.</div>;

  const backHref = appointmentId ? `/staff/appointments/${appointmentId}` : "/staff/today";
  const backLabel = appointmentId ? "Back to appointment" : "Back";

  const isCardPaymentPending = sale.status === "pending_payment" && sale.payment_method !== "manual_card";
  if (sale.status !== "paid" && (paymentMonitorActive || isCardPaymentPending)) {
    return (
      <PaymentMonitorScreen
        saleId={saleId}
        totalCents={sale.total_cents ?? totals.total_cents ?? 0}
        onCheckNow={() => setPaymentMonitorActive(true)}
        onCancelled={async () => {
          setPaymentMonitorActive(false);
          setManualCard(null);
          setAffirmLink(null);
          if (saleId) await loadSaleData(saleId);
        }}
      />
    );
  }

  if (sale.status === "paid") {
    return <PaidSuccessScreen sale={sale} items={items} redirectSecs={redirectSecs} backHref={backHref} />;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <Link to={backHref} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Link>
        <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full ${sale.status === "paid" ? "bg-success-soft text-success-soft-foreground" : sale.status === "refunded" ? "bg-warning-soft text-warning-soft-foreground" : "bg-secondary"}`}>
          {sale.status === "paid" ? "Completed" : sale.status === "pending_payment" ? "Awaiting payment" : sale.status === "refunded" ? "Refunded" : sale.status === "voided" ? "Voided" : (sale.status as string).replace(/_/g, " ")}
        </span>
      </div>

      {sale.status === "paid" && (
        <div className="mb-6 rounded-xl border border-success/30 bg-success-soft p-4 text-sm text-success-soft-foreground">
          ✓ Payment completed.{sale.client_email ? ` A receipt has been emailed to ${sale.client_email}.` : " No client email on file — receipt not sent."}
        </div>
      )}

      <h1 className="font-serif text-3xl mb-1">Checkout</h1>
      <p className="text-sm text-muted-foreground mb-6">{sale.client_first_name} {sale.client_last_name} · {sale.client_email}</p>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        {/* Line items + add panels */}
        <div className="space-y-4">
          <CheckoutProposalBanner
            appointmentId={appointmentId ?? null}
            onAccept={(proposalItems, disc) => {
              setItems(proposalItems);
              if (disc.reason) setDiscountReason(disc.reason);
              if (disc.pct != null) setDiscountPct(String(disc.pct));
              if (disc.amountCents != null) setDiscountAmount((disc.amountCents / 100).toFixed(2));
              recompute({
                items: proposalItems,
                discountPct: disc.pct ?? 0,
                discountAmountCents: disc.amountCents ?? 0,
              });
              toast.success("Cart loaded from chart");
            }}
          />
          <CheckoutCart items={items} updateQty={updateQty} removeItem={removeItem} recompute={() => recompute()} />

          <QuickAddPanel
            services={services}
            unitServices={unitServices}
            products={products}
            addService={addService}
            addUnit={addUnit}
            addProduct={addProduct}
            addCustom={addCustom}
            searchQ={searchQ}
            setSearchQ={setSearchQ}
            customLabel={customLabel}
            setCustomLabel={setCustomLabel}
            customPrice={customPrice}
            setCustomPrice={setCustomPrice}
          />

          <EligibilityStrip
            clientEmail={sale?.client_email}
            activeReason={discountReason}
            onApply={(perk) => {
              setDiscountReason(perk.reason);
              if (perk.kind === "percent") {
                setDiscountPct(String(perk.value));
                setDiscountAmount("");
                recompute({ discountPct: perk.value, discountAmountCents: 0 });
              } else {
                setDiscountAmount(perk.value.toFixed(2));
                setDiscountPct("");
                recompute({ discountPct: 0, discountAmountCents: Math.round(perk.value * 100) });
              }
            }}
          />

          <DiscountsPanel
            promoCode={promoCode}
            setPromoCode={setPromoCode}
            voucherCode={voucherCode}
            setVoucherCode={setVoucherCode}
            voucherAmount={voucherAmount}
            setVoucherAmount={setVoucherAmount}
            discountPct={discountPct}
            setDiscountPct={setDiscountPct}
            discountAmount={discountAmount}
            setDiscountAmount={setDiscountAmount}
            discountReason={discountReason}
            setDiscountReason={setDiscountReason}
            discountReasonCustom={discountReasonCustom}
            setDiscountReasonCustom={setDiscountReasonCustom}
            appliedVoucher={appliedVoucher}
            setAppliedVoucher={setAppliedVoucher}
            recompute={() => recompute()}
          />

          <TipPanel
            tipPct={tipPct}
            setTipPct={setTipPct}
            tipCustom={tipCustom}
            setTipCustom={setTipCustom}
            applyFee={applyFee}
            setApplyFee={setApplyFee}
          />
        </div>

        {/* Totals + Payment */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-5 sticky top-4">
            <TotalsPanel
              totals={totals}
              creditCents={creditCents}
              claimedServiceCreditCents={claimedServiceCreditCents}
              netDueCents={netDueCents}
            />

            <ReceiptPreviewSheet
              items={items}
              totals={totals}
              netDueCents={netDueCents}
              creditCents={creditCents}
              claimedServiceCreditCents={claimedServiceCreditCents}
              clientName={[sale?.client_first_name, sale?.client_last_name].filter(Boolean).join(" ") || null}
              clientEmail={sale?.client_email ?? null}
            />


            <CreditsPanel
              clientEmail={sale?.client_email}
              serviceCredits={serviceCredits}
              claimedCreditIds={claimedCreditIds}
              setClaimedCreditIds={(fn) => setClaimedCreditIds(fn)}
              items={items}
              computeServiceCreditDiscount={(c) => computeServiceCreditDiscount(c, items)}
              creditBalanceCents={creditBalanceCents}
              creditApply={creditApply}
              setCreditApply={setCreditApply}
              creditCents={creditCents}
              amountDueCents={totals.amount_due_cents}
              claimedServiceCreditCents={claimedServiceCreditCents}
            />

            <PointsPanel
              clientEmail={sale?.client_email}
              pointsBalance={pointsBalance}
              pointValueCents={pointsSettings?.point_value_cents ?? 10}
              maxRedemptionPct={pointsSettings?.max_redemption_pct ?? 50}
              capBaseCents={Math.max(0, (totals.subtotal_cents ?? 0) - (totals.discount_cents ?? 0))}
              pointsApply={pointsApply}
              setPointsApply={setPointsApply}
              disabledReason={
                !pointsSettings?.is_enabled ? "Rewards program is currently disabled."
                : (pointsSettings?.block_promo_combo && (promoCode || discountPct || discountAmount))
                    ? "Remove the promo code or manual discount to use points."
                : null
              }
            />



            <PaymentActionsPanel
              readers={readers}
              readerId={readerId}
              setReaderId={setReaderId}
              netDueCents={netDueCents}
              creditCents={creditCents}
              voucherAppliedCents={totals.voucher_applied_cents}
              claimedServiceCreditCents={claimedServiceCreditCents}
              walkInCardOnFile={walkInCardOnFile}
              sale={sale}
              working={working}
              finalize={finalize}
            />
          </section>
        </aside>
      </div>
      <PaymentDialogs
        manualCard={manualCard}
        setManualCard={setManualCard}
        onManualPaid={confirmManualCardPaid}
        affirmLink={affirmLink}
        setAffirmLink={setAffirmLink}
        saleId={saleId}
        defaultEmail={sale?.client_email ?? ""}
        defaultName={sale?.client_first_name ?? ""}
      />
    </div>
  );
}
