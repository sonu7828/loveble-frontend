// Client-facing "My Chart" timeline + downloadable Product Passport PDF.
// Queries the same signed-note tables the staff TreatmentTimeline uses — RLS
// limits the result to the authenticated client's own signed/cosigned notes.
// Also surfaces lifetime tox units / filler syringes, the next predicted
// touch-up window per category, and photos the provider has shared with the
// patient (clinical_photo_meta.is_shared_with_patient = true).
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getClientSession } from "@/hooks/useClientAuth";
import { addDays, addMonths, format, formatDistanceToNowStrict } from "date-fns";
import { Loader2, Download, Syringe, Droplet, Zap, Pill, FileText, CalendarClock, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";

type Entry = {
  id: string;
  date: string;
  category: string;
  service: string | null;
  provider: string | null;
  product?: string | null;
  units?: number | null;
  syringes?: number | null;
  areas?: string[] | null;
  device?: string | null;
  dose?: string | null;
  lots: { lot: string; exp?: string | null }[];
  sharedPhotoUrls: string[];
};

const CAT_ICON: Record<string, any> = {
  neurotoxin: Syringe,
  filler: Droplet,
  energy: Zap,
  wellness: Pill,
};

// Touch-up cadence per category. Filler longevity varies by product so we keep
// a conservative midpoint and let the copy say "around" rather than a hard date.
function predictNextDue(category: string, lastVisit: Date, product?: string | null): Date | null {
  const p = (product ?? "").toLowerCase();
  switch (category) {
    case "neurotoxin": return addDays(lastVisit, 84); // ~12 weeks
    case "filler":
      if (p.includes("voluma") || p.includes("volux")) return addMonths(lastVisit, 18);
      if (p.includes("vollure")) return addMonths(lastVisit, 15);
      if (p.includes("volbella") || p.includes("kysse")) return addMonths(lastVisit, 12);
      if (p.includes("ultra") || p.includes("restylane")) return addMonths(lastVisit, 9);
      return addMonths(lastVisit, 12);
    case "energy":
      if (p.includes("microneed") || (product ?? "").toLowerCase().includes("morpheus")) return addDays(lastVisit, 28);
      return addMonths(lastVisit, 6);
    default: return null;
  }
}

const CATEGORY_LABEL: Record<string, string> = {
  neurotoxin: "Botox / Tox",
  filler: "Filler",
  energy: "Energy / Device",
  wellness: "Medical wellness",
};

export function MyChartTimelineCard() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Entry[]>([]);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const session = await getClientSession();
        const e = session?.user?.email?.toLowerCase();
        if (!e) return;
        setEmail(e);

        const { data: notes } = await supabase
          .from("clinical_notes")
          .select("id, created_at, category, service_name, provider_name, status")
          .ilike("client_email", e)
          .in("status", ["signed", "cosigned", "locked"])
          .order("created_at", { ascending: false })
          .limit(60);

        const ids = (notes ?? []).map((n: any) => n.id);
        if (ids.length === 0) {
          if (!cancel) setRows([]);
          return;
        }

        const [neuro, filler, energy, wellness, sharedPhotos] = await Promise.all([
          supabase.from("clinical_note_neurotoxin" as any).select("clinical_note_id, product, total_units, lot_number, expiration_date").in("clinical_note_id", ids),
          supabase.from("clinical_note_filler" as any).select("clinical_note_id, product, syringes_used, areas, lot_entries").in("clinical_note_id", ids),
          supabase.from("clinical_note_energy" as any).select("clinical_note_id, device, areas").in("clinical_note_id", ids),
          supabase.from("clinical_note_wellness" as any).select("clinical_note_id, product, dose, service_type, lot_number, expiration_date").in("clinical_note_id", ids),
          supabase.from("clinical_photo_meta" as any)
            .select("storage_path, clinical_note_id")
            .in("clinical_note_id", ids)
            .eq("is_shared_with_patient", true),
        ]);
        const neuroMap = new Map<string, any>((neuro.data ?? []).map((r: any) => [r.clinical_note_id, r]));
        const fillerMap = new Map<string, any>((filler.data ?? []).map((r: any) => [r.clinical_note_id, r]));
        const energyMap = new Map<string, any>((energy.data ?? []).map((r: any) => [r.clinical_note_id, r]));
        const wellMap = new Map<string, any>((wellness.data ?? []).map((r: any) => [r.clinical_note_id, r]));

        // Sign URLs for shared photos in parallel (capped to avoid floods).
        const photosByNote = new Map<string, string[]>();
        const capped = (sharedPhotos.data ?? []).slice(0, 200);
        await Promise.all(capped.map(async (p: any) => {
          try {
            const { data } = await supabase.storage.from("clinical-photos").createSignedUrl(p.storage_path, 600);
            if (!data?.signedUrl) return;
            const arr = photosByNote.get(p.clinical_note_id) ?? [];
            arr.push(data.signedUrl);
            photosByNote.set(p.clinical_note_id, arr);
          } catch {}
        }));

        const entries: Entry[] = (notes ?? []).map((n: any) => {
          const base: Entry = {
            id: n.id, date: n.created_at, category: n.category,
            service: n.service_name, provider: n.provider_name, lots: [],
            sharedPhotoUrls: photosByNote.get(n.id) ?? [],
          };
          const nx = neuroMap.get(n.id);
          if (nx) {
            base.product = nx.product; base.units = Number(nx.total_units ?? 0);
            if (nx.lot_number) base.lots.push({ lot: nx.lot_number, exp: nx.expiration_date });
          }
          const fx = fillerMap.get(n.id);
          if (fx) {
            base.product = fx.product; base.syringes = Number(fx.syringes_used ?? 0); base.areas = fx.areas;
            for (const l of (fx.lot_entries ?? []) as any[]) {
              if (l?.lot) base.lots.push({ lot: l.lot, exp: l.exp });
            }
          }
          const ex = energyMap.get(n.id);
          if (ex) { base.device = ex.device; base.areas = ex.areas; }
          const wx = wellMap.get(n.id);
          if (wx) {
            base.product = wx.product; base.dose = wx.dose;
            base.service = base.service ?? wx.service_type;
            if (wx.lot_number) base.lots.push({ lot: wx.lot_number, exp: wx.expiration_date });
          }
          return base;
        });

        if (!cancel) setRows(entries);
      } catch (err) {
        console.warn("Chart load error:", err);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Lifetime totals across all signed visits.
  const lifetime = useMemo(() => {
    let units = 0, syringes = 0;
    for (const r of rows) {
      units += Number(r.units ?? 0);
      syringes += Number(r.syringes ?? 0);
    }
    return { units, syringes, visits: rows.length };
  }, [rows]);

  // Next-due per category: take most recent visit per category and predict.
  const nextDueByCategory = useMemo(() => {
    const seen = new Set<string>();
    const out: { category: string; product: string | null; due: Date; lastVisit: Date }[] = [];
    for (const r of rows) {
      if (seen.has(r.category)) continue;
      seen.add(r.category);
      const last = new Date(r.date);
      const due = predictNextDue(r.category, last, r.product ?? null);
      if (due) out.push({ category: r.category, product: r.product ?? null, due, lastVisit: last });
    }
    return out.sort((a, b) => a.due.getTime() - b.due.getTime());
  }, [rows]);

  const passportRows = useMemo(() => rows.filter(r => r.lots.length > 0 || r.product), [rows]);

  const downloadPassport = () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const W = doc.internal.pageSize.getWidth();
      let y = 56;
      doc.setFont("helvetica", "bold"); doc.setFontSize(20);
      doc.text("Product Passport", 48, y);
      y += 22;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120);
      doc.text(`${email}`, 48, y); y += 12;
      doc.text(`Generated ${format(new Date(), "PPP")} · Radiantilyk Aesthetic`, 48, y); y += 22;
      doc.setTextColor(0);
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text("Visit", 48, y); doc.text("Treatment", 160, y); doc.text("Product / Dose", 300, y); doc.text("Lot · Exp", 450, y);
      y += 6; doc.setDrawColor(220); doc.line(48, y, W - 48, y); y += 14;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);

      if (passportRows.length === 0) {
        doc.setTextColor(140);
        doc.text("No products recorded yet.", 48, y);
      }
      for (const r of passportRows) {
        if (y > 740) { doc.addPage(); y = 56; }
        const date = format(new Date(r.date), "MMM d, yyyy");
        const tx = r.service ?? r.category;
        const product = [
          r.product,
          r.units ? `${r.units}u` : null,
          r.syringes ? `${r.syringes} syr` : null,
          r.dose,
          r.device,
        ].filter(Boolean).join(" · ");
        const lotText = r.lots.length === 0 ? "—" : r.lots.map(l => `${l.lot}${l.exp ? ` · ${l.exp}` : ""}`).join("\n");
        doc.text(date, 48, y);
        doc.text(String(tx ?? ""), 160, y, { maxWidth: 130 });
        doc.text(product || "—", 300, y, { maxWidth: 140 });
        const lotLines = doc.splitTextToSize(lotText, 110);
        doc.text(lotLines, 450, y);
        y += Math.max(16, lotLines.length * 12);
      }
      doc.setTextColor(140); doc.setFontSize(8);
      doc.text("Confidential — for personal records only.", 48, doc.internal.pageSize.getHeight() - 32);
      doc.save(`product-passport-${email.split("@")[0]}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not build PDF");
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your chart…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-serif text-lg">My chart</h3>
        </div>
        <p className="text-sm text-muted-foreground">Your treatment timeline appears here after your first signed visit.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h3 className="font-serif text-lg">My chart</h3>
          <p className="text-xs text-muted-foreground">Your treatment history with products, lots, and shared photos.</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={downloadPassport}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Product passport (PDF)
        </Button>
      </div>

      {/* Lifetime stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Lifetime visits" value={String(lifetime.visits)} />
        <Stat label="Lifetime units" value={lifetime.units > 0 ? lifetime.units.toLocaleString() : "—"} suffix={lifetime.units > 0 ? "u" : undefined} />
        <Stat label="Lifetime syringes" value={lifetime.syringes > 0 ? lifetime.syringes.toString() : "—"} suffix={lifetime.syringes > 0 ? "mL" : undefined} />
      </div>

      {/* Touch-up windows */}
      {nextDueByCategory.length > 0 && (
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">Touch-ups coming up</h4>
          </div>
          <ul className="space-y-1.5">
            {nextDueByCategory.map(({ category, product, due, lastVisit }) => {
              const overdue = due.getTime() < Date.now();
              return (
                <li key={category} className="flex items-center justify-between text-xs gap-2 flex-wrap">
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{CATEGORY_LABEL[category] ?? category}</span>
                    {product ? ` · ${product}` : ""} · last {format(lastVisit, "MMM d, yyyy")}
                  </span>
                  <span className={overdue ? "text-warning-foreground font-medium" : "text-foreground tabular-nums"}>
                    {overdue ? "Due now" : `Around ${format(due, "MMM d, yyyy")}`}
                    <span className="text-muted-foreground ml-1">({overdue ? `${formatDistanceToNowStrict(due)} ago` : `in ${formatDistanceToNowStrict(due)}`})</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Estimated from your visit cadence and product longevity — your provider may adjust based on results.
          </p>
        </div>
      )}

      <ol className="relative">
        {rows.map((r, idx) => {
          const Icon = CAT_ICON[r.category] ?? FileText;
          return (
            <li key={r.id} className="relative pl-9 pr-1 py-3 border-b border-border last:border-b-0">
              <span className="absolute left-3 top-4 h-2 w-2 rounded-full bg-primary" />
              {idx < rows.length - 1 && <span className="absolute left-[15px] top-6 bottom-0 w-px bg-border" aria-hidden />}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-medium min-w-0">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="truncate">{r.service ?? r.category}</span>
                </div>
                <span className="text-xs text-muted-foreground">{format(new Date(r.date), "MMM d, yyyy")}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 pl-6 space-y-0.5">
                {r.product && <div>{r.product}{r.units ? ` · ${r.units}u` : ""}{r.syringes ? ` · ${r.syringes} syringe${r.syringes === 1 ? "" : "s"}` : ""}{r.dose ? ` · ${r.dose}` : ""}</div>}
                {r.device && <div>{r.device}{r.areas?.length ? ` · ${r.areas.slice(0, 3).join(", ")}` : ""}</div>}
                {r.lots.length > 0 && (
                  <div className="font-mono text-[10px]">
                    Lot{r.lots.length === 1 ? "" : "s"}: {r.lots.map(l => `${l.lot}${l.exp ? ` (exp ${l.exp})` : ""}`).join(" · ")}
                  </div>
                )}
                {r.provider && <div>with {r.provider}</div>}
              </div>
              {r.sharedPhotoUrls.length > 0 && (
                <div className="pl-6 mt-2">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                    <ImageIcon className="h-3 w-3" /> Shared photos
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {r.sharedPhotoUrls.slice(0, 6).map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noopener noreferrer">
                        <img src={u} alt="" loading="lazy" className="h-16 w-16 object-cover rounded border border-border hover:opacity-90 transition" />
                      </a>
                    ))}
                    {r.sharedPhotoUrls.length > 6 && (
                      <span className="text-[10px] self-center text-muted-foreground">+{r.sharedPhotoUrls.length - 6} more</span>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-serif text-2xl tabular-nums leading-tight">
        {value}{suffix ? <span className="text-sm text-muted-foreground ml-1">{suffix}</span> : null}
      </div>
    </div>
  );
}

