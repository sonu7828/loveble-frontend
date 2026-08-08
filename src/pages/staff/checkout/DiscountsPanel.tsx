import { Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
  const hasAny = !!(p.discountPct || p.discountAmount || p.discountReason);
  return (
    <section className="rounded-2xl border border-border bg-card px-5">
      <Accordion type="single" collapsible defaultValue="discounts">
        <AccordionItem value="discounts" className="border-b-0">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Manual Discount</span>
              {hasAny && (
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">applied</span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-5 space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-medium">Manual discount %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={p.discountPct}
                  onChange={(e) => p.setDiscountPct(e.target.value)}
                  placeholder="10"
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Manual discount ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={p.discountAmount}
                  onChange={(e) => p.setDiscountAmount(e.target.value)}
                  placeholder="25.00"
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Discount reason</Label>
                <Select value={p.discountReason || "__none"} onValueChange={(v) => p.setDiscountReason(v === "__none" ? "" : v)}>
                  <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— None —</SelectItem>
                    <SelectItem value="New client">New client</SelectItem>
                    <SelectItem value="Friend">Friend / VIP</SelectItem>
                    <SelectItem value="Review">Review</SelectItem>
                    <SelectItem value="Healthcare worker">Healthcare worker</SelectItem>
                    <SelectItem value="Special promotion">Special promotion</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {p.discountReason === "Other" && (
              <Input
                value={p.discountReasonCustom}
                onChange={(e) => p.setDiscountReasonCustom(e.target.value)}
                placeholder="Enter custom discount reason (e.g., Birthday discount, Staff family)"
                className="mt-2 text-xs"
              />
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
