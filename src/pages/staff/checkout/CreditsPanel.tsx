import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fmt, LineItem } from "./shared";

type ServiceCredit = {
  id: string;
  kind: string;
  service_id: string | null;
  service_label: string | null;
  units: number | null;
  amount_cents: number;
  reason: string;
};

type Props = {
  clientEmail?: string | null;
  serviceCredits: ServiceCredit[];
  claimedCreditIds: string[];
  setClaimedCreditIds: (fn: (ids: string[]) => string[]) => void;
  items: LineItem[];
  computeServiceCreditDiscount: (cred: ServiceCredit) => number;
  creditBalanceCents: number;
  creditApply: string;
  setCreditApply: (v: string) => void;
  creditCents: number;
  amountDueCents: number;
  claimedServiceCreditCents: number;
};

export function CreditsPanel(p: Props) {
  return (
    <>
      {p.clientEmail && p.serviceCredits.length > 0 && (
        <div className="mt-4 rounded-xl border border-warning/30 bg-warning-soft/50 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-wider text-warning-soft-foreground">Service credits</span>
            <span className="font-medium text-warning-soft-foreground">{p.serviceCredits.length} available</span>
          </div>
          <div className="space-y-1.5">
            {p.serviceCredits.map(cred => {
              const claimed = p.claimedCreditIds.includes(cred.id);
              const discount = p.computeServiceCreditDiscount(cred);
              const isUnitBank = cred.kind === "service_value" && !!cred.units && cred.units > 0 && !!cred.service_id;
              const noMatch = cred.kind === "service_free" && cred.service_id &&
                !p.items.find(it => it.kind === "service" && it.reference_id === cred.service_id);
              const noUnitMatch = isUnitBank &&
                !p.items.find(it => (it.kind === "unit_service" || it.kind === "service") && it.reference_id === cred.service_id && it.quantity > 0);
              const pricePerUnit = isUnitBank && cred.units ? cred.amount_cents / cred.units : 0;
              const unitsUsed = isUnitBank && claimed && pricePerUnit > 0 ? Math.round(discount / pricePerUnit) : 0;
              const unitsRemaining = isUnitBank && cred.units ? Math.max(0, cred.units - unitsUsed) : 0;
              return (
                <div
                  key={cred.id}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition ${
                    claimed
                      ? "bg-success-soft border-success/30 ring-1 ring-success/40"
                      : "bg-background/70 border-warning/30"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate flex items-center gap-1.5">
                      {claimed && <CheckCircle2 className="h-4 w-4 text-success-soft-foreground shrink-0" />}
                      <span className="truncate">{cred.service_label || "Service credit"}</span>
                    </div>
                    <div className={`text-[11px] ${claimed ? "text-success-soft-foreground font-medium" : "text-muted-foreground"}`}>
                      {claimed && isUnitBank
                        ? `Auto-applied · −${fmt(discount)} · ${unitsRemaining} ${unitsRemaining === 1 ? "unit" : "units"} remain`
                        : claimed
                          ? `Applied · −${fmt(discount)}`
                          : `${cred.kind === "service_free" ? "Free service" : "Service value"} · ${fmt(cred.amount_cents)}`}
                      {noMatch && !claimed && <span className="text-warning-soft-foreground"> · Add this service to claim</span>}
                      {noUnitMatch && !claimed && <span className="text-warning-soft-foreground"> · Enter units on the line item to auto-apply</span>}
                    </div>
                  </div>
                  {isUnitBank ? (
                    // Unit-bank credits auto-apply/un-apply based on the cart — no manual button.
                    null
                  ) : claimed ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        p.setClaimedCreditIds(ids => ids.filter(i => i !== cred.id));
                        toast.message("Service credit removed", { description: cred.service_label || "Credit removed from this sale" });
                      }}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!noMatch || discount <= 0}
                      onClick={() => {
                        p.setClaimedCreditIds(ids => [...ids, cred.id]);
                        toast.success("Service credit applied", { description: `${cred.service_label || "Credit"} · −${fmt(discount)}` });
                      }}
                    >
                      Claim
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {p.clientEmail && p.creditBalanceCents > 0 && (
        <div className="mt-4 rounded-xl border border-success/30 bg-success-soft/50 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-wider text-success-soft-foreground">Account credit</span>
            <span className="font-medium text-success-soft-foreground">{fmt(p.creditBalanceCents)} available</span>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={p.creditApply}
              onChange={(e) => p.setCreditApply(e.target.value)}
              className="h-9"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => p.setCreditApply(((Math.min(p.creditBalanceCents, Math.max(0, p.amountDueCents - p.claimedServiceCreditCents))) / 100).toFixed(2))}
            >
              Apply max
            </Button>
            {p.creditCents > 0 && (
              <Button variant="ghost" size="sm" onClick={() => p.setCreditApply("")}>Clear</Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
