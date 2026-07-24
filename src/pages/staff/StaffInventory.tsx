import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, AlertTriangle, PackageX, PackageSearch, Boxes, Flame, Pencil } from "lucide-react";
import { ReceiveLotDialog } from "@/components/staff/ReceiveLotDialog";
import { differenceInDays, format } from "date-fns";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import StaffInventoryBurn from "./StaffInventoryBurn";

type Lot = {
  id: string; product_name: string; lot_number: string;
  expiration_date: string | null;
  quantity_initial: number; quantity_remaining: number;
  unit: string; category: string | null;
  low_stock_threshold: number; notes: string | null;
  is_active: boolean; received_at: string;
};

type TabKey = "all" | "low" | "expiring" | "expired";

function lotStatus(l: Lot): "expired" | "expiring" | "low" | "out" | "ok" {
  if (l.quantity_remaining <= 0) return "out";
  if (l.expiration_date) {
    const d = differenceInDays(new Date(l.expiration_date), new Date());
    if (d < 0) return "expired";
    if (d <= 30) return "expiring";
  }
  if (l.low_stock_threshold > 0 && l.quantity_remaining <= l.low_stock_threshold) return "low";
  return "ok";
}

export default function StaffInventory() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [drawer, setDrawer] = useState<Lot | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_lots")
      .select("*")
      .order("product_name", { ascending: true })
      .order("expiration_date", { ascending: true, nullsFirst: false });
    if (error) toast.error(error.message);
    setLots((data ?? []) as Lot[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return lots.filter(l => {
      const s = lotStatus(l);
      if (tab === "low" && !(s === "low" || s === "out")) return false;
      if (tab === "expiring" && s !== "expiring") return false;
      if (tab === "expired" && s !== "expired") return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return l.product_name.toLowerCase().includes(q) || l.lot_number.toLowerCase().includes(q);
      }
      return true;
    });
  }, [lots, tab, search]);

  const counts = useMemo(() => {
    let low = 0, expiring = 0, expired = 0;
    for (const l of lots) {
      const s = lotStatus(l);
      if (s === "low" || s === "out") low++;
      if (s === "expiring") expiring++;
      if (s === "expired") expired++;
    }
    return { low, expiring, expired };
  }, [lots]);

  const adjust = async (lot: Lot) => {
    const next = window.prompt(`New remaining quantity for ${lot.product_name} lot ${lot.lot_number}:`, String(lot.quantity_remaining));
    if (next == null) return;
    const n = Number(next);
    if (Number.isNaN(n) || n < 0) { toast.error("Invalid quantity"); return; }
    const { error } = await supabase.rpc("adjust_lot", {
      _lot_id: lot.id, _new_quantity: n, _reason: "adjust", _notes: null,
    });
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };

  const deactivate = async (lot: Lot) => {
    if (!(await confirmDialog({
      title: `Deactivate lot ${lot.lot_number}?`,
      description: "It will be hidden from chart pickers. Movement history is kept.",
      confirmLabel: "Deactivate", destructive: true,
    }))) return;
    const { error } = await supabase.from("product_lots").update({ is_active: false }).eq("id", lot.id);
    if (error) toast.error(error.message); else { toast.success("Deactivated"); load(); }
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("tab") === "burn" ? "burn" : "lots";
  const setView = (v: "lots" | "burn") => {
    const next = new URLSearchParams(searchParams);
    if (v === "burn") next.set("tab", "burn"); else next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl font-medium mb-1">Inventory</h1>
          <p className="text-sm text-muted-foreground">Product lots, expiration tracking, and stock levels.</p>
        </div>
        <div className="flex items-center gap-2">
          {view === "burn" ? (
            <Button variant="outline" className="rounded-full" onClick={() => setView("lots")}>
              <Boxes className="h-4 w-4 mr-1.5" />Lots
            </Button>
          ) : (
            <>
              <Button variant="outline" className="rounded-full" onClick={() => setView("burn")}>
                <Flame className="h-4 w-4 mr-1.5" />Burn report
              </Button>
              <Button onClick={() => setReceiveOpen(true)} className="rounded-full">
                <Plus className="h-4 w-4 mr-1.5" />Receive lot
              </Button>
            </>
          )}
        </div>
      </div>

      {view === "burn" ? <StaffInventoryBurn /> : (<>


      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total lots" value={lots.filter(l => l.is_active).length} icon={<Boxes className="h-4 w-4" />} />
        <Stat label="Low stock" value={counts.low} tone={counts.low ? "amber" : undefined} icon={<PackageSearch className="h-4 w-4" />} />
        <Stat label="Expiring ≤30d" value={counts.expiring} tone={counts.expiring ? "amber" : undefined} icon={<AlertTriangle className="h-4 w-4" />} />
        <Stat label="Expired" value={counts.expired} tone={counts.expired ? "red" : undefined} icon={<PackageX className="h-4 w-4" />} />
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        {(["all", "low", "expiring", "expired"] as TabKey[]).map(k => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-wider border ${tab === k ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}
          >
            {k === "all" ? "All" : k === "low" ? "Low stock" : k === "expiring" ? "Expiring" : "Expired"}
          </button>
        ))}
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search product or lot #"
          className="h-8 max-w-xs ml-auto"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">No lots match this filter.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Product</th>
                <th className="text-left px-4 py-2.5">Lot #</th>
                <th className="text-left px-4 py-2.5">Expires</th>
                <th className="text-right px-4 py-2.5">Remaining</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-right px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(l => {
                const s = lotStatus(l);
                return (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{l.product_name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{l.lot_number}</td>
                    <td className="px-4 py-2.5 text-xs">{l.expiration_date ? format(new Date(l.expiration_date), "MMM d, yyyy") : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{l.quantity_remaining} <span className="text-muted-foreground">{l.unit}</span></td>
                    <td className="px-4 py-2.5"><StatusBadge status={s} /></td>
                    <td className="px-4 py-2.5 text-right">
                      <button className="text-xs text-muted-foreground hover:text-foreground mr-3" onClick={() => setDrawer(l)}>History</button>
                      <button className="text-xs text-muted-foreground hover:text-foreground mr-3" onClick={() => adjust(l)}><Pencil className="h-3.5 w-3.5 inline mr-1" />Adjust</button>
                      {l.is_active && <button className="text-xs text-destructive hover:opacity-80" onClick={() => deactivate(l)}>Deactivate</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ReceiveLotDialog open={receiveOpen} onOpenChange={setReceiveOpen} onReceived={load} />

      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent className="sm:max-w-md">
          {drawer && (
            <>
              <SheetHeader>
                <SheetTitle>{drawer.product_name} · {drawer.lot_number}</SheetTitle>
              </SheetHeader>
              <LotHistory lotId={drawer.id} />
            </>
          )}
        </SheetContent>
      </Sheet>
      </>)}
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone?: "amber" | "red" }) {
  const toneCls = tone === "red" ? "text-destructive bg-destructive/5 border-destructive/30"
    : tone === "amber" ? "text-warning-soft-foreground bg-warning-soft border-warning/30" : "text-foreground bg-card border-border";
  return (
    <div className={`rounded-2xl border p-4 ${toneCls}`}>
      <div className="text-[11px] uppercase tracking-wider opacity-70 flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-2xl font-serif mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReturnType<typeof lotStatus> }) {
  const map: Record<typeof status, { label: string; cls: string }> = {
    ok: { label: "OK", cls: "bg-success-soft text-success-soft-foreground" },
    low: { label: "Low stock", cls: "bg-warning-soft text-warning-soft-foreground" },
    out: { label: "Out", cls: "bg-destructive-soft text-destructive-soft-foreground" },
    expiring: { label: "Expiring", cls: "bg-warning-soft text-warning-soft-foreground" },
    expired: { label: "Expired", cls: "bg-destructive-soft text-destructive-soft-foreground" },
  };
  const m = map[status];
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>;
}

function LotHistory({ lotId }: { lotId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    supabase.from("inventory_movements")
      .select("*")
      .eq("lot_id", lotId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, [lotId]);
  if (loading) return <div className="mt-4 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin inline mr-2" />Loading…</div>;
  if (rows.length === 0) return <div className="mt-4 text-xs text-muted-foreground">No movements yet.</div>;
  return (
    <ul className="mt-4 space-y-2">
      {rows.map(r => (
        <li key={r.id} className="text-sm border-l-2 border-border pl-3 py-1">
          <div className="flex items-center justify-between gap-2">
            <span className="capitalize">{r.reason}</span>
            <span className={`tabular-nums font-mono text-xs ${r.qty_delta < 0 ? "text-destructive" : "text-success-soft-foreground"}`}>
              {r.qty_delta > 0 ? "+" : ""}{r.qty_delta}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy · h:mm a")}{r.notes ? ` · ${r.notes}` : ""}</div>
        </li>
      ))}
    </ul>
  );
}
