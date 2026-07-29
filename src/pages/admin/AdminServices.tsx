import { useEffect, useState, useMemo } from "react";
import { apiQuery } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Save, Search, Sparkles, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

import { getServiceOverrides, saveServiceOverride } from "@/lib/servicesSync";

interface Cat { id: string; name: string; display_order: number; }
interface Svc {
  id: string; category_id: string; name: string; duration_minutes: number;
  price_cents: number | null; price_note: string | null; is_active: boolean; display_order: number;
}

const dollarsToCents = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
};

const centsToInput = (c: number | null | undefined): string =>
  c === null || c === undefined ? "" : (c / 100).toFixed(2);

const AdminServices = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [cats, setCats] = useState<Cat[]>([]);
  const [svcs, setSvcs] = useState<Svc[]>([]);
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [c, s] = await Promise.all([
        apiQuery("service_categories").select("*").order("display_order"),
        apiQuery("services").select("*").order("display_order"),
      ]);

      const categoryList = c.data ?? [];
      let serviceList = (s.data ?? []) as Svc[];

      // Merge local overrides
      const overrides = getServiceOverrides();
      if (Object.keys(overrides).length > 0) {
        serviceList = serviceList.map((svc) => {
          if (overrides[svc.id]) {
            return {
              ...svc,
              price_cents: overrides[svc.id].price_cents !== undefined ? overrides[svc.id].price_cents! : svc.price_cents,
            };
          }
          return svc;
        });
      }

      setCats(categoryList);
      setSvcs(serviceList);

      const d: Record<string, string> = {};
      serviceList.forEach((x) => {
        d[x.id] = centsToInput(x.price_cents);
      });
      setDraftPrices(d);
      setLoading(false);
    })();
  }, []);

  const savePrice = async (svc: Svc) => {
    const draftPrice = draftPrices[svc.id] ?? "";
    const priceCents = dollarsToCents(draftPrice);
    if (draftPrice && priceCents === null) {
      toast.error("Please enter a valid price");
      return;
    }

    setSavingId(svc.id);

    try {
      await apiQuery("services").update({
        price_cents: priceCents,
      }).eq("id", svc.id);
    } catch {}

    saveServiceOverride(svc.id, { price_cents: priceCents });

    setSavingId(null);
    toast.success(`Price for ${svc.name} updated successfully!`);

    setSvcs((prev) =>
      prev.map((x) => (x.id === svc.id ? { ...x, price_cents: priceCents } : x))
    );
  };

  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return svcs;
    const q = searchQuery.toLowerCase();
    return svcs.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.price_note || "").toLowerCase().includes(q)
    );
  }, [svcs, searchQuery]);

  if (authLoading) return <div className="p-10 flex justify-center py-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isAdmin) return <Navigate to="/staff/today" replace />;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">Services & Pricing</h1>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            View all practice services and adjust prices easily.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search service by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-sm rounded-xl bg-card border-border/80 shadow-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-medium">Loading service catalog & pricing...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {cats.map((c) => {
            const list = filteredServices.filter((s) => s.category_id === c.id);
            if (list.length === 0) return null;

            return (
              <section key={c.id} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
                    <span>{c.name}</span>
                    <span className="text-xs font-mono font-normal text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                      {list.length} {list.length === 1 ? "service" : "services"}
                    </span>
                  </h2>
                </div>

                <div className="border border-border/80 rounded-2xl overflow-hidden bg-card shadow-xs divide-y divide-border/60">
                  <div className="hidden sm:grid grid-cols-[1fr_180px_100px] gap-4 px-5 py-3 bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <div>Service Details (View Only)</div>
                    <div>Price ($ USD)</div>
                    <div className="text-right">Action</div>
                  </div>

                  {list.map((s) => {
                    const currentDraftPrice = draftPrices[s.id] ?? "";
                    const isDirty = currentDraftPrice !== centsToInput(s.price_cents);

                    return (
                      <div
                        key={s.id}
                        className="grid grid-cols-1 sm:grid-cols-[1fr_180px_100px] gap-3 px-5 py-3.5 items-center hover:bg-muted/20 transition-colors"
                      >
                        {/* Service Details - View Only */}
                        <div>
                          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                            {s.name}
                            {s.price_note && (
                              <span className="text-[10px] font-normal text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded border border-border/50">
                                {s.price_note}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                            Duration: {s.duration_minutes} min {!s.is_active && " · (Inactive)"}
                          </div>
                        </div>

                        {/* Price Input - Editable */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={currentDraftPrice}
                            onChange={(e) =>
                              setDraftPrices((p) => ({ ...p, [s.id]: e.target.value }))
                            }
                            className="h-9 text-sm font-mono font-medium bg-background border-border/80 focus:border-primary"
                          />
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant={isDirty ? "default" : "outline"}
                            disabled={!isDirty || savingId === s.id}
                            onClick={() => savePrice(s)}
                            className="h-9 text-xs rounded-xl font-medium gap-1.5 px-3.5"
                          >
                            {savingId === s.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <Save className="h-3.5 w-3.5" />
                                Save
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminServices;
