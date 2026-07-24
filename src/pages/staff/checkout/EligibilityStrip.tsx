import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { getClientEligibility, type EligibilityPerk } from "@/lib/clientEligibility";

type Props = {
  clientEmail: string | null | undefined;
  onApply: (perk: EligibilityPerk) => void;
  activeReason?: string;
};

export function EligibilityStrip({ clientEmail, onApply, activeReason }: Props) {
  const [perks, setPerks] = useState<EligibilityPerk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getClientEligibility(clientEmail)
      .then((p) => { if (!cancelled) setPerks(p); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientEmail]);

  if (loading || perks.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Eligible discounts — tap to apply
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {perks.map((p) => {
          const active = activeReason === p.reason;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onApply(p)}
              className={
                "text-left rounded-xl px-3 py-2 border transition " +
                (active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/40 hover:border-primary/50 hover:bg-primary/5")
              }
            >
              <div className="text-sm font-medium">{p.label}</div>
              {p.note && <div className="text-[11px] text-muted-foreground mt-0.5">{p.note}</div>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
