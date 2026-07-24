// Per-client treatment timeline + dose forecasting.
// Aggregates every signed visit's neurotoxin units, filler syringes, laser passes,
// and wellness doses into one scrollable column. Computes a simple "due now"
// prediction for neurotoxin based on the typical 12-week return.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Syringe, Droplet, Zap, Pill, AlertCircle, CalendarClock } from "lucide-react";
import { format, differenceInWeeks, addWeeks, formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

const NEURO_RETURN_WEEKS = 12;
const FILLER_RETURN_WEEKS = 52;

type Row = {
  noteId: string;
  date: string; // ISO
  category: string;
  service: string | null;
  provider: string | null;
  // category-specific summary
  units?: number;
  product?: string | null;
  syringes?: number;
  areas?: string[] | null;
  device?: string | null;
  passes?: string | null;
  wellnessProduct?: string | null;
  wellnessDose?: string | null;
};

export function TreatmentTimeline({ clientEmail }: { clientEmail: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data: notes } = await supabase
        .from("clinical_notes")
        .select("id, created_at, category, service_name, provider_name, status")
        .ilike("client_email", clientEmail)
        .in("status", ["signed", "cosigned", "locked"])
        .order("created_at", { ascending: false })
        .limit(60);

      const ids = (notes ?? []).map((n: any) => n.id);
      if (ids.length === 0) {
        if (!cancel) { setRows([]); setLoading(false); }
        return;
      }

      const [neuroRes, fillerRes, energyRes, wellnessRes] = await Promise.all([
        supabase.from("clinical_note_neurotoxin").select("clinical_note_id, product, total_units").in("clinical_note_id", ids),
        supabase.from("clinical_note_filler").select("clinical_note_id, product, syringes_used, areas").in("clinical_note_id", ids),
        supabase.from("clinical_note_energy").select("clinical_note_id, device, settings, areas").in("clinical_note_id", ids),
        supabase.from("clinical_note_wellness").select("clinical_note_id, product, dose, service_type").in("clinical_note_id", ids),
      ]);
      const neuroMap = new Map((neuroRes.data ?? []).map((r: any) => [r.clinical_note_id, r]));
      const fillerMap = new Map((fillerRes.data ?? []).map((r: any) => [r.clinical_note_id, r]));
      const energyMap = new Map((energyRes.data ?? []).map((r: any) => [r.clinical_note_id, r]));
      const wellMap = new Map((wellnessRes.data ?? []).map((r: any) => [r.clinical_note_id, r]));

      const out: Row[] = (notes ?? []).map((n: any) => {
        const base: Row = {
          noteId: n.id,
          date: n.created_at,
          category: n.category,
          service: n.service_name,
          provider: n.provider_name,
        };
        const nx: any = neuroMap.get(n.id);
        if (nx) { base.units = Number(nx.total_units ?? 0); base.product = nx.product; }
        const fx: any = fillerMap.get(n.id);
        if (fx) { base.syringes = Number(fx.syringes_used ?? 0); base.product = fx.product; base.areas = fx.areas; }
        const ex: any = energyMap.get(n.id);
        if (ex) {
          base.device = ex.device;
          const s = ex.settings ?? {};
          base.passes = s?.passes ? String(s.passes) : null;
          base.areas = ex.areas;
        }
        const wx: any = wellMap.get(n.id);
        if (wx) { base.wellnessProduct = wx.product; base.wellnessDose = wx.dose; base.service = base.service ?? wx.service_type; }
        return base;
      });

      if (!cancel) { setRows(out); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [clientEmail]);

  // Forecasting: pick the most recent neurotoxin and filler visit
  const forecast = useMemo(() => {
    const lastNeuro = rows.find(r => r.category === "neurotoxin" && (r.units ?? 0) > 0);
    const lastFiller = rows.find(r => r.category === "filler" && (r.syringes ?? 0) > 0);
    const items: { kind: string; last: Row; due: Date; overdue: boolean }[] = [];
    if (lastNeuro) {
      const due = addWeeks(new Date(lastNeuro.date), NEURO_RETURN_WEEKS);
      items.push({ kind: "Neurotoxin", last: lastNeuro, due, overdue: due < new Date() });
    }
    if (lastFiller) {
      const due = addWeeks(new Date(lastFiller.date), FILLER_RETURN_WEEKS);
      items.push({ kind: "Filler", last: lastFiller, due, overdue: due < new Date() });
    }
    return items;
  }, [rows]);

  if (loading) {
    return <div className="rounded-lg border border-border p-6 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground italic">
        No signed treatments yet. The timeline appears after the first signed visit.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {forecast.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5" /> Dose forecast
          </div>
          <div className="space-y-2">
            {forecast.map(f => {
              const last = f.last;
              const weeksAgo = differenceInWeeks(new Date(), new Date(last.date));
              const summary = f.kind === "Neurotoxin"
                ? `${last.units}u ${last.product ?? ""}`.trim()
                : `${last.syringes} syringe${(last.syringes ?? 0) === 1 ? "" : "s"} ${last.product ?? ""}`.trim();
              return (
                <div key={f.kind} className={`flex items-center justify-between gap-3 rounded-md p-3 ${f.overdue ? "bg-warning-soft dark:bg-warning-soft border border-warning/30 dark:border-warning" : "bg-secondary/40"}`}>
                  <div className="text-sm min-w-0">
                    <span className="font-medium">{f.kind}</span>{" · "}
                    <span className="text-muted-foreground">Last {summary} ({weeksAgo}w ago)</span>
                  </div>
                  <div className={`text-xs font-medium ${f.overdue ? "text-warning-soft-foreground dark:text-warning" : "text-muted-foreground"}`}>
                    {f.overdue ? `Due now (${formatDistanceToNow(f.due)} ago)` : `Due ${format(f.due, "MMM d")}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
          Treatment timeline ({rows.length})
        </div>
        <ol className="relative">
          {rows.map((r, idx) => (
            <li key={r.noteId} className="relative pl-10 pr-4 py-3 border-b border-border last:border-b-0">
              <span className="absolute left-4 top-4 h-2 w-2 rounded-full bg-primary" />
              {idx < rows.length - 1 && (
                <span className="absolute left-[19px] top-6 bottom-0 w-px bg-border" aria-hidden />
              )}
              <Link to={`/staff/clinical/notes/${r.noteId}`} className="block hover:bg-secondary/30 -mx-4 px-4 -my-3 py-3 transition">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm font-medium min-w-0">
                    <CategoryIcon c={r.category} />
                    <span className="truncate">{r.service ?? r.category}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{format(new Date(r.date), "MMM d, yyyy")}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 pl-6">
                  {r.category === "neurotoxin" && r.units != null && <span>{r.units}u {r.product}</span>}
                  {r.category === "filler" && r.syringes != null && (
                    <span>
                      {r.syringes} syringe{r.syringes === 1 ? "" : "s"} {r.product}
                      {r.areas?.length ? ` · ${r.areas.slice(0, 3).join(", ")}` : ""}
                    </span>
                  )}
                  {r.category === "energy" && (
                    <span>{r.device}{r.passes ? ` · ${r.passes} passes` : ""}{r.areas?.length ? ` · ${r.areas.slice(0, 3).join(", ")}` : ""}</span>
                  )}
                  {r.category === "wellness" && (
                    <span>{r.wellnessProduct ?? r.service}{r.wellnessDose ? ` · ${r.wellnessDose}` : ""}</span>
                  )}
                  {r.provider && <span> · {r.provider}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function CategoryIcon({ c }: { c: string }) {
  if (c === "neurotoxin") return <Syringe className="h-4 w-4 text-primary" />;
  if (c === "filler") return <Droplet className="h-4 w-4 text-primary" />;
  if (c === "energy") return <Zap className="h-4 w-4 text-warning-soft-foreground" />;
  if (c === "wellness") return <Pill className="h-4 w-4 text-success-soft-foreground" />;
  return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
}
