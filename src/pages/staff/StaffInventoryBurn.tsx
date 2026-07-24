// Inventory burn report — consumption rate and projected runway per product.
// Reads inventory_movements with reason='consume' and aggregates by product.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Flame, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Row = {
  product_name: string;
  unit: string;
  consumed: number;
  remaining: number;
  per_day: number;
  days_left: number | null;
};

const RANGES: Array<{ key: string; label: string; days: number }> = [
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "60", label: "Last 60 days", days: 60 },
  { key: "90", label: "Last 90 days", days: 90 },
];

export default function StaffInventoryBurn() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const since = new Date(Date.now() - days * 86400_000).toISOString();

        // Pull recent consume movements with their lot product info.
        const { data: moves, error: e1 } = await supabase
          .from("inventory_movements")
          .select("qty_delta, reason, created_at, product_lots(product_name, unit)")
          .eq("reason", "consume")
          .gte("created_at", since)
          .limit(5000);
        if (e1) throw e1;

        // Current on-hand inventory grouped by product name.
        const { data: lots, error: e2 } = await supabase
          .from("product_lots")
          .select("product_name, unit, quantity_remaining, is_active");
        if (e2) throw e2;

        const consumedBy = new Map<string, { consumed: number; unit: string }>();
        for (const m of (moves ?? []) as any[]) {
          const pl = m.product_lots;
          if (!pl?.product_name) continue;
          const key = pl.product_name.trim();
          const entry = consumedBy.get(key) ?? { consumed: 0, unit: pl.unit ?? "unit" };
          entry.consumed += Math.abs(Number(m.qty_delta) || 0);
          consumedBy.set(key, entry);
        }

        const remainingBy = new Map<string, { remaining: number; unit: string }>();
        for (const l of (lots ?? []) as any[]) {
          if (!l.is_active) continue;
          const key = (l.product_name ?? "").trim();
          if (!key) continue;
          const entry = remainingBy.get(key) ?? { remaining: 0, unit: l.unit ?? "unit" };
          entry.remaining += Number(l.quantity_remaining) || 0;
          remainingBy.set(key, entry);
        }

        const allNames = new Set([...consumedBy.keys(), ...remainingBy.keys()]);
        const out: Row[] = [];
        for (const name of allNames) {
          const c = consumedBy.get(name);
          const r = remainingBy.get(name);
          const consumed = c?.consumed ?? 0;
          const remaining = r?.remaining ?? 0;
          const per_day = consumed / days;
          const days_left = per_day > 0 ? Math.floor(remaining / per_day) : null;
          out.push({
            product_name: name,
            unit: c?.unit ?? r?.unit ?? "unit",
            consumed, remaining, per_day, days_left,
          });
        }
        out.sort((a, b) => b.consumed - a.consumed);
        setRows(out);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load burn report");
      } finally {
        setLoading(false);
      }
    })();
  }, [days]);

  const totals = useMemo(() => {
    const consumed = rows.reduce((s, r) => s + r.consumed, 0);
    const at_risk = rows.filter(r => r.days_left !== null && r.days_left <= 14).length;
    return { consumed, at_risk, products: rows.length };
  }, [rows]);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/staff/inventory">
          <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" />Inventory</Button>
        </Link>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGES.map(r => <SelectItem key={r.key} value={String(r.days)}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <header>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Flame className="h-6 w-6 text-warning" /> Inventory burn report
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consumption rate from charted procedures and projected runway based on current on-hand stock.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Products tracked" value={String(totals.products)} />
        <Stat label={`Units consumed (${days}d)`} value={totals.consumed.toFixed(1)} />
        <Stat label="At risk (≤14d runway)" value={String(totals.at_risk)} tone={totals.at_risk > 0 ? "warn" : "ok"} />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No consumption recorded in the selected period.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Product</th>
                <th className="text-right px-3 py-2">Consumed</th>
                <th className="text-right px-3 py-2">Per day</th>
                <th className="text-right px-3 py-2">On hand</th>
                <th className="text-right px-3 py-2">Runway</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.product_name} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.product_name}</td>
                  <td className="px-3 py-2 text-right">{r.consumed.toFixed(1)} {r.unit}</td>
                  <td className="px-3 py-2 text-right">{r.per_day.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{r.remaining.toFixed(1)}</td>
                  <td className={`px-3 py-2 text-right ${r.days_left !== null && r.days_left <= 14 ? "text-warning font-medium" : ""}`}>
                    {r.days_left === null ? "—" : (
                      <span className="inline-flex items-center gap-1 justify-end">
                        {r.days_left <= 14 && <AlertTriangle className="h-3.5 w-3.5" />}
                        {r.days_left}d
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-warning" : ""}`}>{value}</div>
    </div>
  );
}
