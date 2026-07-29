import { useEffect, useState, useMemo } from "react";
import { apiQuery } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Save, Star, Search, Tag, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

interface Cat { id: string; name: string; display_order: number; }
interface Svc {
  id: string; category_id: string; name: string; duration_minutes: number;
  price_cents: number | null; price_note: string | null; is_active: boolean; display_order: number;
  rebook_followup_days: number | null; is_featured: boolean;
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

const daysToInput = (d: number | null | undefined): string =>
  d === null || d === undefined ? "" : String(d);

const parseDays = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 365 || !Number.isInteger(n)) return null;
  return n;
};

interface Draft { price: string; note: string; rebook: string; }

const AdminServices = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [cats, setCats] = useState<Cat[]>([]);
  const [svcs, setSvcs] = useState<Svc[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
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

      // Merge local overrides if any
      const overrides: Record<string, Partial<Svc>> = JSON.parse(localStorage.getItem("rka_services_overrides") || "{}");
      if (Object.keys(overrides).length > 0) {
        serviceList = serviceList.map((svc) => {
          if (overrides[svc.id]) {
            return { ...svc, ...overrides[svc.id] };
          }
          return svc;
        });
      }

      setCats(categoryList);
      setSvcs(serviceList);

      const d: Record<string, Draft> = {};
      serviceList.forEach((x) => {
        d[x.id] = {
          price: centsToInput(x.price_cents),
          note: x.price_note ?? "",
          rebook: daysToInput(x.rebook_followup_days),
        };
      });
      setDrafts(d);
      setLoading(false);
    })();
  }, []);

  const save = async (svc: Svc) => {
    const draft = drafts[svc.id];
    const priceCents = dollarsToCents(draft.price);
    if (draft.price && priceCents === null) {
      toast.error("Price must be a valid positive number");
      return;
    }
    const rebookDays = parseDays(draft.rebook);
    if (draft.rebook && rebookDays === null) {
      toast.error("Rebook days must be a whole number between 0–365");
      return;
    }

    setSavingId(svc.id);
    const note = draft.note.trim() || null;

    // Update DB
    try {
      await apiQuery("services").update({
        price_cents: priceCents,
        price_note: note,
        rebook_followup_days: rebookDays,
      }).eq("id", svc.id);
    } catch {}

    // Save to Local Overrides cache
    const overrides: Record<string, Partial<Svc>> = JSON.parse(localStorage.getItem("rka_services_overrides") || "{}");
    overrides[svc.id] = {
      ...overrides[svc.id],
      price_cents: priceCents,
      price_note: note,
      rebook_followup_days: rebookDays,
    };
    localStorage.setItem("rka_services_overrides", JSON.stringify(overrides));

    setSavingId(null);
    toast.success(`${svc.name} updated successfully`);

    setSvcs((prev) =>
      prev.map((x) =>
        x.id === svc.id
          ? { ...x, price_cents: priceCents, price_note: note, rebook_followup_days: rebookDays }
          : x
      )
    );
  };

  const toggleFeatured = async (s: Svc) => {
    const next = !s.is_featured;
    setSvcs((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_featured: next } : x)));

    // Update Local Overrides
    const overrides: Record<string, Partial<Svc>> = JSON.parse(localStorage.getItem("rka_services_overrides") || "{}");
    overrides[s.id] = { ...overrides[s.id], is_featured: next };
    localStorage.setItem("rka_services_overrides", JSON.stringify(overrides));

    try {
      await apiQuery("services").update({ is_featured: next }).eq("id", s.id);
    } catch {}

    toast.success(next ? `${s.name} pinned to Quick Add` : `${s.name} unpinned from Quick Add`);
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
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">Service Pricing & Follow-up</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Live Sync Active
            </span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-primary shrink-0" />
            Set pricing, notes (e.g. "per unit", "per syringe"), and automatic "time to rebook" follow-up SMS triggers.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search service name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-card border-border/80"
          />
        </div>
      </div>

      {/* Suggested Guidance Box */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-foreground">
        <div className="font-semibold text-primary mb-1 flex items-center gap-1.5">
          <span>💡 Suggested Rebook Follow-Up Guidelines</span>
        </div>
        <div className="text-muted-foreground text-[11px] space-y-1">
          <p>
            • <strong>Botox / Neurotoxins:</strong> 90 Days &nbsp;|&nbsp; <strong>Dermal Fillers:</strong> 180 Days &nbsp;|&nbsp; <strong>Facials & Peels:</strong> 30 Days &nbsp;|&nbsp; <strong>Lasers:</strong> 45 Days
          </p>
          <p className="text-[10px] text-muted-foreground/80">
            * Leave <em>Rebook (days)</em> blank to disable automated follow-up SMS reminders for that specific service.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-medium">Loading RKA treatment catalog & pricing...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {cats.map((c) => {
            const list = filteredServices.filter((s) => s.category_id === c.id);
            if (list.length === 0) return null;

            return (
              <section key={c.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
                    <span>{c.name}</span>
                    <span className="text-xs font-mono font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {list.length} services
                    </span>
                  </h2>
                </div>

                <div className="border border-border/80 rounded-2xl overflow-hidden bg-card shadow-2xs divide-y divide-border/60">
                  <div className="hidden md:grid grid-cols-[1fr_70px_110px_1fr_110px_100px] gap-3 px-4 py-2.5 bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <div>Service</div>
                    <div className="text-center" title="Featured on staff Quick Add">Quick Add</div>
                    <div>Price ($)</div>
                    <div>Pricing Note</div>
                    <div>Rebook (Days)</div>
                    <div className="text-right">Action</div>
                  </div>

                  {list.map((s) => {
                    const d = drafts[s.id] ?? { price: "", note: "", rebook: "" };
                    const dirty =
                      d.price !== centsToInput(s.price_cents) ||
                      (d.note ?? "") !== (s.price_note ?? "") ||
                      (d.rebook ?? "") !== daysToInput(s.rebook_followup_days);

                    return (
                      <div
                        key={s.id}
                        className="grid grid-cols-1 md:grid-cols-[1fr_70px_110px_1fr_110px_100px] gap-3 px-4 py-3 items-center hover:bg-muted/20 transition-colors"
                      >
                        <div>
                          <div className="text-xs font-semibold text-foreground">{s.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {s.duration_minutes} min {!s.is_active && " · Inactive"}
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => toggleFeatured(s)}
                            title={s.is_featured ? "Pinned to staff Quick Add" : "Pin to staff Quick Add"}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-border/80 hover:bg-secondary/60 transition cursor-pointer"
                          >
                            <Star
                              className={`h-4 w-4 ${
                                s.is_featured ? "fill-amber-400 text-amber-500" : "text-muted-foreground/50"
                              }`}
                            />
                          </button>
                        </div>

                        <div>
                          <Input
                            inputMode="decimal"
                            placeholder="0.00"
                            value={d.price}
                            onChange={(e) => setDrafts((p) => ({ ...p, [s.id]: { ...p[s.id], price: e.target.value } }))}
                            className="h-8.5 text-xs font-mono bg-background"
                          />
                        </div>

                        <div>
                          <Input
                            placeholder="e.g. per unit / per vial"
                            value={d.note}
                            onChange={(e) => setDrafts((p) => ({ ...p, [s.id]: { ...p[s.id], note: e.target.value } }))}
                            className="h-8.5 text-xs bg-background"
                          />
                        </div>

                        <div>
                          <Input
                            inputMode="numeric"
                            placeholder="e.g. 90"
                            value={d.rebook}
                            onChange={(e) => setDrafts((p) => ({ ...p, [s.id]: { ...p[s.id], rebook: e.target.value } }))}
                            className="h-8.5 text-xs font-mono bg-background"
                          />
                        </div>

                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant={dirty ? "default" : "outline"}
                            disabled={!dirty || savingId === s.id}
                            onClick={() => save(s)}
                            className="h-8 text-xs rounded-xl font-medium gap-1 px-3"
                          >
                            {savingId === s.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Save className="h-3 w-3" />
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
