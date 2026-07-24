import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Save, Star } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [c, s] = await Promise.all([
        supabase.from("service_categories").select("*").order("display_order"),
        supabase.from("services").select("*").order("display_order"),
      ]);
      setCats(c.data ?? []);
      const list = (s.data ?? []) as Svc[];
      setSvcs(list);
      const d: Record<string, Draft> = {};
      list.forEach(x => {
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
    if (draft.price && priceCents === null) { toast.error("Price must be a positive number"); return; }
    const rebookDays = parseDays(draft.rebook);
    if (draft.rebook && rebookDays === null) { toast.error("Rebook days must be a whole number 0–365"); return; }
    setSavingId(svc.id);
    const note = draft.note.trim() || null;
    const { error } = await supabase.from("services").update({
      price_cents: priceCents,
      price_note: note,
      rebook_followup_days: rebookDays,
    }).eq("id", svc.id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${svc.name} updated`);
    setSvcs(prev => prev.map(x => x.id === svc.id
      ? { ...x, price_cents: priceCents, price_note: note, rebook_followup_days: rebookDays }
      : x));
  };

  if (authLoading) return <div className="p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/staff/today" replace />;

  return (
    <div className="p-6 md:p-10 max-w-5xl">
      <h1 className="font-serif text-3xl mb-2">Service pricing & follow-up</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Set the price, an optional pricing note (e.g. <span className="italic">"per unit"</span>),
        and how many days after a visit to send a "time to rebook" SMS.
        Suggested: Botox/Dysport <span className="italic">90</span>, Filler <span className="italic">180</span>,
        Facials/Peels <span className="italic">30</span>, Laser <span className="italic">45</span>.
        Leave Rebook blank to disable for that service.
      </p>

      {loading && <Loader2 className="h-5 w-5 animate-spin" />}

      <div className="space-y-10">
        {cats.map(c => {
          const list = svcs.filter(s => s.category_id === c.id);
          if (list.length === 0) return null;
          return (
            <section key={c.id}>
              <h2 className="font-serif text-xl mb-3">{c.name}</h2>
              <div className="border border-border rounded-xl divide-y divide-border bg-card">
                <div className="hidden md:grid grid-cols-[1fr_70px_110px_1fr_110px_100px] gap-3 px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <div>Service</div><div title="Featured on staff Quick Add">Quick</div><div>Price ($)</div><div>Pricing note</div><div>Rebook (days)</div><div></div>
                </div>
                {list.map(s => {
                  const d = drafts[s.id] ?? { price: "", note: "", rebook: "" };
                  const dirty =
                    d.price !== centsToInput(s.price_cents) ||
                    (d.note ?? "") !== (s.price_note ?? "") ||
                    (d.rebook ?? "") !== daysToInput(s.rebook_followup_days);
                  return (
                    <div key={s.id} className="grid grid-cols-1 md:grid-cols-[1fr_70px_110px_1fr_110px_100px] gap-3 px-4 py-3 items-center">
                      <div>
                        <div className="text-sm">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.duration_minutes} min{!s.is_active && " · inactive"}</div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const next = !s.is_featured;
                          setSvcs(prev => prev.map(x => x.id === s.id ? { ...x, is_featured: next } : x));
                          const { error } = await supabase.from("services").update({ is_featured: next }).eq("id", s.id);
                          if (error) {
                            setSvcs(prev => prev.map(x => x.id === s.id ? { ...x, is_featured: !next } : x));
                            toast.error(error.message);
                          } else {
                            toast.success(next ? `${s.name} pinned to Quick Add` : `${s.name} removed from Quick Add`);
                          }
                        }}
                        title={s.is_featured ? "Pinned to staff Quick Add" : "Pin to staff Quick Add"}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border hover:bg-secondary/60"
                      >
                        <Star className={`h-4 w-4 ${s.is_featured ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                      </button>
                      <Input
                        inputMode="decimal" placeholder="—"
                        value={d.price}
                        onChange={(e) => setDrafts(p => ({ ...p, [s.id]: { ...p[s.id], price: e.target.value } }))}
                      />
                      <Input
                        placeholder="e.g. per unit"
                        value={d.note}
                        onChange={(e) => setDrafts(p => ({ ...p, [s.id]: { ...p[s.id], note: e.target.value } }))}
                      />
                      <Input
                        inputMode="numeric" placeholder="—"
                        value={d.rebook}
                        onChange={(e) => setDrafts(p => ({ ...p, [s.id]: { ...p[s.id], rebook: e.target.value } }))}
                      />
                      <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || savingId === s.id} onClick={() => save(s)}>
                        {savingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="h-3 w-3 mr-1" />Save</>}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default AdminServices;

