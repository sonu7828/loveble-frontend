import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, AlertTriangle } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { ReceiveLotDialog } from "./ReceiveLotDialog";

export type LotOption = {
  id: string;
  product_name: string;
  lot_number: string;
  expiration_date: string | null;
  quantity_remaining: number;
  unit: string;
  low_stock_threshold: number;
};

type Props = {
  product: string;
  category?: string;
  unit?: string;
  value: string | null;             // selected lot id
  onChange: (lot: LotOption | null) => void;
  label?: string;
  required?: boolean;
};

export function LotPicker({ product, category, unit = "unit", value, onChange, label = "Lot", required }: Props) {
  const [lots, setLots] = useState<LotOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const load = useCallback(async () => {
    if (!product) { setLots([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("product_lots")
      .select("id, product_name, lot_number, expiration_date, quantity_remaining, unit, low_stock_threshold")
      .ilike("product_name", product)
      .eq("is_active", true)
      .order("expiration_date", { ascending: true, nullsFirst: false });
    setLots((data ?? []) as LotOption[]);
    setLoading(false);
  }, [product]);

  useEffect(() => { load(); }, [load]);

  // Auto-select FEFO: when nothing is picked, default to the earliest-expiring
  // usable lot (lots are already ordered by expiration ascending).
  useEffect(() => {
    if (value || loading || lots.length === 0) return;
    const usable = lots.filter(l => {
      if (l.quantity_remaining <= 0) return false;
      if (l.expiration_date && differenceInDays(new Date(l.expiration_date), new Date()) < 0) return false;
      return true;
    });
    if (usable.length >= 1) {
      onChange(usable[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lots, loading, value]);


  const selected = lots.find(l => l.id === value) ?? null;

  const labelFor = (l: LotOption) => {
    const exp = l.expiration_date ? format(new Date(l.expiration_date), "MMM yyyy") : "no exp";
    const daysLeft = l.expiration_date ? differenceInDays(new Date(l.expiration_date), new Date()) : null;
    const expFlag = daysLeft != null && daysLeft < 0 ? " · EXPIRED"
      : daysLeft != null && daysLeft <= 30 ? ` · ${daysLeft}d left`
      : "";
    return `${l.lot_number}  ·  ${l.quantity_remaining} ${l.unit} left  ·  exp ${exp}${expFlag}`;
  };

  const handleSelect = (id: string) => {
    if (id === "__new__") { setReceiveOpen(true); return; }
    const lot = lots.find(l => l.id === id) ?? null;
    onChange(lot);
  };

  const warn = selected && selected.expiration_date
    ? differenceInDays(new Date(selected.expiration_date), new Date())
    : null;
  const expired = warn !== null && warn < 0;
  const expiringSoon = warn !== null && warn >= 0 && warn <= 30;
  const lowStock = selected && selected.low_stock_threshold > 0 && selected.quantity_remaining <= selected.low_stock_threshold;

  return (
    <div className="space-y-1">
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {label}{required ? " *" : ""}
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      </label>
      <div className="flex gap-1.5">
        <select
          className={`h-9 flex-1 rounded-md border bg-background px-2 text-sm ${expired ? "border-destructive text-destructive" : "border-input"}`}
          value={value ?? ""}
          onChange={e => handleSelect(e.target.value)}
        >
          <option value="">— Select lot —</option>
          {lots.map(l => (
            <option key={l.id} value={l.id} disabled={l.quantity_remaining <= 0}>
              {labelFor(l)}
            </option>
          ))}
          <option value="__new__">+ Receive new lot…</option>
        </select>
        <button
          type="button"
          onClick={() => setReceiveOpen(true)}
          className="h-9 px-2 rounded-md border border-input hover:bg-muted inline-flex items-center"
          title="Receive new lot"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {selected && (
        <div className="text-[11px] flex items-center gap-1.5">
          {expired && (
            <span className="text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Lot is EXPIRED — do not use</span>
          )}
          {!expired && expiringSoon && (
            <span className="text-warning-soft-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Expires in {warn} day{warn === 1 ? "" : "s"}</span>
          )}
          {lowStock && (
            <span className="text-warning-soft-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Low stock</span>
          )}
          {!expired && !expiringSoon && !lowStock && (
            <span className="text-muted-foreground">
              {selected.quantity_remaining} {selected.unit} on hand
            </span>
          )}
        </div>
      )}
      {!loading && product && lots.length === 0 && (
        <div className="text-[11px] text-muted-foreground">No lots on file for "{product}". Use "+" to receive one.</div>
      )}

      <ReceiveLotDialog
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        defaultProduct={product}
        defaultCategory={category}
        defaultUnit={unit}
        onReceived={async (lotId) => {
          await load();
          // auto-select just-received lot
          setTimeout(() => {
            setLots(curr => {
              const justAdded = curr.find(l => l.id === lotId);
              if (justAdded) onChange(justAdded);
              return curr;
            });
          }, 50);
        }}
      />
    </div>
  );
}
