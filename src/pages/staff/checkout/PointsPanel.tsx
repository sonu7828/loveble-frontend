import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmt } from "./shared";

type Props = {
  clientEmail?: string | null;
  pointsBalance: number;
  pointValueCents: number;     // e.g. 10 = $0.10/pt
  maxRedemptionPct: number;    // e.g. 50
  capBaseCents: number;        // subtotal − discount, the cap base
  pointsApply: string;
  setPointsApply: (v: string) => void;
  disabledReason: string | null;
};

export function PointsPanel(p: Props) {
  // Always visible during checkout so staff can always see/apply rewards.
  // Only fully hide when there's no client at all (walk-in with no email).
  if (!p.clientEmail) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-3">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Rewards points
        </div>
        <p className="text-xs text-muted-foreground mt-1">Add a client email to this sale to apply rewards points.</p>
      </div>
    );
  }
  const balanceValue = p.pointsBalance * p.pointValueCents;
  const capCents = Math.max(0, Math.floor((p.capBaseCents * p.maxRedemptionPct) / 100));
  const maxPoints = Math.min(p.pointsBalance, Math.floor(capCents / Math.max(1, p.pointValueCents)));

  const apply = (n: number) => p.setPointsApply(String(Math.max(0, Math.min(maxPoints, n))));

  return (
    <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Rewards points
        </span>
        <span className="font-medium text-primary">
          {p.pointsBalance.toLocaleString()} pts · {fmt(balanceValue)}
        </span>
      </div>
      {p.pointsBalance <= 0 ? (
        <p className="text-xs text-muted-foreground">
          No rewards points available yet. Points are earned automatically once this sale is paid.
        </p>
      ) : p.disabledReason ? (
        <p className="text-xs text-muted-foreground">{p.disabledReason}</p>
      ) : (
        <>
          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="0"
              value={p.pointsApply}
              onChange={(e) => p.setPointsApply(e.target.value.replace(/\D/g, ""))}
              className="h-9"
            />
            <Button variant="outline" size="sm" onClick={() => apply(maxPoints)} disabled={maxPoints <= 0}>
              Use max
            </Button>
            {p.pointsApply && (
              <Button variant="ghost" size="sm" onClick={() => p.setPointsApply("")}>Clear</Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            1 point = {fmt(p.pointValueCents)} off · max {p.maxRedemptionPct}% of bill
            {maxPoints < p.pointsBalance && ` (capped at ${maxPoints.toLocaleString()} pts on this sale)`}
          </p>
        </>
      )}
    </div>
  );
}
