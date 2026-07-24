import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { fmt, LineItem } from "./shared";

type Props = {
  items: LineItem[];
  updateQty: (idx: number, q: number) => void;
  removeItem: (idx: number) => void;
  recompute: () => void;
};

export function CheckoutCart({ items, updateQty, removeItem, recompute }: Props) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Items</h2>
      {items.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
      <ul className="space-y-2">
        {items.map((it, idx) => {
          const fromChart = !!it.metadata?.from_chart;
          const unitWord = it.kind === "unit_service" ? (it.metadata?.unit_label ?? "unit") : "each";
          return (
            <li key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/40">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium truncate">{it.label}</div>
                  {fromChart && (
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      from chart
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {it.quantity} {unitWord}{it.quantity === 1 ? "" : "s"} × {fmt(it.unit_price_cents)} = {fmt(it.line_total_cents)}
                </div>
              </div>
              <div className="flex flex-col items-center">
                {it.kind === "unit_service" && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                    {it.metadata?.unit_label ?? "units"}
                  </span>
                )}
                <Input
                  type="number" min={0} max={500}
                  value={it.quantity}
                  onChange={(e) => updateQty(idx, parseInt(e.target.value || "0"))}
                  onBlur={() => recompute()}
                  className="w-20 h-9 text-center"
                />
              </div>
              <div className="w-24 text-right text-sm font-medium tabular-nums">{fmt(it.line_total_cents)}</div>
              <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
