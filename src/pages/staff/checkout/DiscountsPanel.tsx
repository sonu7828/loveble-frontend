import { CheckCircle2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { fmt } from "./shared";

type Props = {
  promoCode: string;
  setPromoCode: (v: string) => void;
  voucherCode: string;
  setVoucherCode: (v: string) => void;
  voucherAmount: string;
  setVoucherAmount: (v: string) => void;
  discountPct: string;
  setDiscountPct: (v: string) => void;
  discountAmount: string;
  setDiscountAmount: (v: string) => void;
  discountReason: string;
  setDiscountReason: (v: string) => void;
  discountReasonCustom: string;
  setDiscountReasonCustom: (v: string) => void;
  appliedVoucher: { code: string; is_entitlement: boolean; applied_cents: number; label: string } | null;
  setAppliedVoucher: (v: null) => void;
  recompute: () => void;
};

export function DiscountsPanel(p: Props) {
  const hasAny = !!(p.promoCode || p.voucherCode || p.discountPct || p.discountAmount);
  return (
    <section className="rounded-2xl border border-border bg-card px-5">
      <Accordion type="single" collapsible defaultValue={hasAny ? "discounts" : undefined}>
        <AccordionItem value="discounts" className="border-b-0">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Promo / Voucher / Discount</span>
              {hasAny && (
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">applied</span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-5 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Promo code</Label>
                <div className="flex gap-2">
                  <Input value={p.promoCode} onChange={(e) => p.setPromoCode(e.target.value.toUpperCase())} placeholder="BOTOX259" />
                  <Button variant="outline" onClick={p.recompute}>Apply</Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Manual discount %</Label>
                <Input type="number" min={0} max={100} value={p.discountPct} onChange={(e) => p.setDiscountPct(e.target.value)} placeholder="10" />
              </div>
              <div>
                <Label className="text-xs">Voucher code</Label>
                <div className="flex gap-2">
                  <Input
                    value={p.voucherCode}
                    onChange={(e) => { p.setVoucherCode(e.target.value.toUpperCase()); p.setAppliedVoucher(null); }}
                    placeholder="GC-XXXXXXXX"
                  />
                  <Button variant="outline" onClick={p.recompute}>Apply</Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Voucher amount ($) — optional</Label>
                <Input type="number" min={0} step="0.01" value={p.voucherAmount} onChange={(e) => p.setVoucherAmount(e.target.value)} placeholder="Auto" />
                <p className="text-[10px] text-muted-foreground mt-1">Leave blank — service vouchers and full gift-card balances apply automatically.</p>
              </div>
              <div>
                <Label className="text-xs">Manual discount ($)</Label>
                <Input type="number" min={0} step="0.01" value={p.discountAmount} onChange={(e) => p.setDiscountAmount(e.target.value)} placeholder="25.00" />
              </div>
              <div>
                <Label className="text-xs">Discount reason</Label>
                <Select value={p.discountReason || "__none"} onValueChange={(v) => p.setDiscountReason(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— None —</SelectItem>
                    <SelectItem value="Friend">Friend</SelectItem>
                    <SelectItem value="Review">Review</SelectItem>
                    <SelectItem value="Healthcare worker">Healthcare worker</SelectItem>
                    <SelectItem value="New client">New client</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {p.discountReason === "Other" && (
              <Input value={p.discountReasonCustom} onChange={(e) => p.setDiscountReasonCustom(e.target.value)} placeholder="Custom discount reason" />
            )}
            {p.appliedVoucher && (
              <div className="rounded-lg border border-success/30 bg-success-soft px-3 py-2 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success-soft-foreground mt-0.5 shrink-0" />
                <div className="text-sm text-success-soft-foreground">
                  <span className="font-medium">Voucher {p.appliedVoucher.code} claimed</span>
                  {" — "}
                  {p.appliedVoucher.is_entitlement
                    ? <>covers {p.appliedVoucher.label} (−{fmt(p.appliedVoucher.applied_cents)})</>
                    : <>−{fmt(p.appliedVoucher.applied_cents)} applied</>}
                </div>
              </div>
            )}
            {p.voucherCode.trim() !== "" && !p.appliedVoucher && (
              <p className="text-xs text-warning-soft-foreground">Voucher not applied yet — press Apply to claim it.</p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
