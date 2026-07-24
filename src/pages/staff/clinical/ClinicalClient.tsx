// Per-client clinical view: GFE status + chart note timeline + per-visit packets.
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ShieldCheck, ShieldAlert, FilePlus, FileText, Download, CalendarDays, Stethoscope, ClipboardList, Mic } from "lucide-react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { openPdf } from "@/lib/openPdf";
import { TreatmentTimeline } from "@/components/clinical/TreatmentTimeline";
import { LifetimeToxCard } from "@/components/clinical/LifetimeToxCard";
import { AdverseEventDialog, AdverseEventList } from "@/components/clinical/AdverseEventDialog";
import { VoSuspectedButton } from "@/components/clinical/VoSuspectedButton";
import { ClientClinicalAlerts } from "@/components/clinical/ClientClinicalAlerts";


export default function ClinicalClient() {
  const { email = "" } = useParams();
  const navigate = useNavigate();
  const { isNP, isAdmin } = useAuth();
  const decoded = decodeURIComponent(email).toLowerCase();
  const [loading, setLoading] = useState(true);
  const [gfes, setGfes] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [encounters, setEncounters] = useState<any[]>([]);
  const [latestApt, setLatestApt] = useState<any>(null);
  const [downloadingDate, setDownloadingDate] = useState<string | null>(null);

  useEffect(() => {
    if (!decoded) return;
    (async () => {
      setLoading(true);
      const [{ data: g }, { data: n }, { data: e }, { data: a }] = await Promise.all([
        supabase.from("gfe_records").select("*").ilike("client_email", decoded).order("signed_at", { ascending: false }),
        supabase.from("clinical_notes").select("*").ilike("client_email", decoded).order("created_at", { ascending: false }),
        supabase.from("clinical_encounters").select("*").ilike("client_email", decoded).order("created_at", { ascending: false }),
        supabase.from("appointments").select("client_first_name, client_last_name, client_email")
          .ilike("client_email", decoded).order("start_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setGfes(g ?? []);
      setNotes(n ?? []);
      setEncounters(e ?? []);
      setLatestApt(a ?? null);
      setLoading(false);
    })();
  }, [decoded]);

  // Group all clinical activity by visit date (Pacific calendar day).
  const visits = useMemo(() => {
    const fmtPT = (iso: string) => {
      const d = new Date(iso);
      // YYYY-MM-DD in America/Los_Angeles
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
      const y = parts.find(p => p.type === "year")?.value;
      const m = parts.find(p => p.type === "month")?.value;
      const day = parts.find(p => p.type === "day")?.value;
      return `${y}-${m}-${day}`;
    };
    const groups = new Map<string, { date: string; notes: any[]; gfes: any[]; encounters: any[] }>();
    const ensure = (k: string) => groups.get(k) ?? groups.set(k, { date: k, notes: [], gfes: [], encounters: [] }).get(k)!;
    for (const n of notes) ensure(fmtPT(n.created_at)).notes.push(n);
    for (const g of gfes) ensure(fmtPT(g.signed_at)).gfes.push(g);
    for (const e of encounters) {
      ensure(fmtPT(e.signed_at ?? e.created_at)).encounters.push(e);
    }
    return Array.from(groups.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [notes, gfes, encounters]);

  async function downloadVisit(date: string) {
    setDownloadingDate(date);
    try {
      const { data, error } = await supabase.functions.invoke("generate-visit-compiled-pdf", {
        body: { client_email: decoded, visit_date: date },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No PDF returned");
      openPdf(data.url, `visit-${date}.pdf`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to compile visit PDF");
    } finally {
      setDownloadingDate(null);
    }
  }

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const currentGfe = gfes.find(g => new Date(g.expires_at) > new Date());
  const expired = !currentGfe && gfes.length > 0;
  const first = latestApt?.client_first_name ?? gfes[0]?.client_first_name ?? notes[0]?.client_first_name ?? "";
  const last = latestApt?.client_last_name ?? gfes[0]?.client_last_name ?? notes[0]?.client_last_name ?? "";

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/staff/clients/${encodeURIComponent(decoded)}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" />Client profile
        </Button>
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Clinical chart</div>
        <h1 className="text-2xl font-serif">{first} {last}</h1>
        <p className="text-sm text-muted-foreground mt-1">{decoded}</p>
      </div>

      <ClientClinicalAlerts clientEmail={decoded} sticky />

      {/* GFE status card */}

      <div className={`rounded-lg border p-4 ${currentGfe ? "border-success/30 bg-success-soft dark:bg-success-soft" : "border-warning/30 bg-warning-soft dark:bg-warning-soft"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {currentGfe
              ? <ShieldCheck className="h-5 w-5 text-success-soft-foreground mt-0.5" />
              : <ShieldAlert className="h-5 w-5 text-warning-soft-foreground mt-0.5" />}
            <div>
              <p className="font-medium text-sm">California Good Faith Exam</p>
              {currentGfe ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Signed by {currentGfe.np_name} • Expires {format(new Date(currentGfe.expires_at), "PP")} ({differenceInDays(new Date(currentGfe.expires_at), new Date())}d)
                </p>
              ) : expired ? (
                <p className="text-xs text-muted-foreground mt-0.5">Last GFE expired {formatDistanceToNow(new Date(gfes[0].expires_at))} ago</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">Not on file. Required before any procedure.</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {currentGfe && (
              <Button size="sm" variant="outline" onClick={() => navigate(`/staff/clinical/gfe/${currentGfe.id}`)}>View</Button>
            )}
            {(isNP || isAdmin) && (
              <Button size="sm" onClick={() => navigate(`/staff/clinical/gfe/new?email=${encodeURIComponent(decoded)}&first=${encodeURIComponent(first)}&last=${encodeURIComponent(last)}`)}>
                {currentGfe ? "New GFE" : "Conduct GFE"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* New note CTA + safety actions */}
      <div className="flex justify-end gap-2 flex-wrap">
        <Button
          variant="default"
          onClick={() => navigate(`/staff/clinical/notes/new?email=${encodeURIComponent(decoded)}&first=${encodeURIComponent(first)}&last=${encodeURIComponent(last)}&scribe=1`)}
          title="Record the visit and let AI auto-fill the chart. Review before signing."
        >
          <Mic className="h-4 w-4 mr-1" /> AI Scribe visit
        </Button>
        <AdverseEventDialog
          clientEmail={decoded}
          clientFirstName={first}
          clientLastName={last}
        />
        <VoSuspectedButton
          clientEmail={decoded}
          clientFirstName={first}
          clientLastName={last}
        />
        <Button
          variant="outline"
          onClick={() => navigate(`/staff/clinical/notes/new?email=${encodeURIComponent(decoded)}&first=${encodeURIComponent(first)}&last=${encodeURIComponent(last)}&category=consult&scribe=1`)}
          title="Consultation-only SOAP note — no procedure, no products, AI Scribe records the discussion."
        >
          <FilePlus className="h-4 w-4 mr-1" /> New consultation note
        </Button>
        <Button onClick={() => navigate(`/staff/clinical/notes/new?email=${encodeURIComponent(decoded)}&first=${encodeURIComponent(first)}&last=${encodeURIComponent(last)}`)}>
          <FilePlus className="h-4 w-4 mr-1" /> New chart note
        </Button>
      </div>

      {/* Lifetime tox tracker */}
      <LifetimeToxCard clientEmail={decoded} />

      {/* Treatment timeline + dose forecasting */}
      <TreatmentTimeline clientEmail={decoded} />

      {/* Adverse events log */}
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Adverse events</div>
        <AdverseEventList clientEmail={decoded} />
      </div>


      {/* Visits compiled — grouped by date, downloadable as one packet */}
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Visits ({visits.length})</div>
        {visits.length === 0 && <p className="text-sm text-muted-foreground italic">No clinical visits recorded yet.</p>}
        {visits.map(v => {
          const total = v.notes.length + v.gfes.length + v.encounters.length;
          return (
            <div key={v.date} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{format(new Date(`${v.date}T12:00:00`), "PPPP")}</p>
                    <p className="text-xs text-muted-foreground">{total} document{total === 1 ? "" : "s"} on file</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => downloadVisit(v.date)} disabled={downloadingDate === v.date}>
                  {downloadingDate === v.date
                    ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    : <Download className="h-4 w-4 mr-1" />}
                  Download visit
                </Button>
              </div>
              <div className="pl-6 space-y-1">
                {v.gfes.map(g => (
                  <Link key={g.id} to={`/staff/clinical/gfe/${g.id}`} className="flex items-center gap-2 text-xs hover:underline">
                    <ShieldCheck className="h-3 w-3 text-success-soft-foreground" />
                    <span>GFE — {g.np_name}</span>
                  </Link>
                ))}
                {v.encounters.map(e => (
                  <Link key={e.id} to={`/staff/clinical/encounters/${e.id}`} className="flex items-center gap-2 text-xs hover:underline">
                    <Stethoscope className="h-3 w-3 text-muted-foreground" />
                    <span className="capitalize">{e.visit_type} visit · {e.category} — {e.signed_by_name}</span>
                  </Link>
                ))}
                {v.notes.map(n => (
                  <Link key={n.id} to={`/staff/clinical/notes/${n.id}`} className="flex items-center gap-2 text-xs hover:underline">
                    <ClipboardList className="h-3 w-3 text-muted-foreground" />
                    <span>{n.service_name ?? n.category} — {n.provider_name}</span>
                    <StatusBadge s={n.status} />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Notes timeline */}
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">All chart notes ({notes.length})</div>
        {notes.length === 0 && <p className="text-sm text-muted-foreground italic">No chart notes yet.</p>}
        {notes.map(n => (
          <Link key={n.id} to={`/staff/clinical/notes/${n.id}`} className="block rounded-md border border-border p-3 hover:border-primary/40 hover:bg-secondary/40 transition">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{n.service_name ?? "Chart note"} <span className="text-muted-foreground capitalize">• {n.category}</span></p>
                  <p className="text-xs text-muted-foreground truncate">{n.provider_name} • {format(new Date(n.created_at), "PPP p")}</p>
                </div>
              </div>
              <StatusBadge s={n.status} />
            </div>
          </Link>
        ))}
      </div>

      {/* GFE history */}
      {gfes.length > 1 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Previous GFEs</div>
          {gfes.slice(1).map(g => (
            <Link key={g.id} to={`/staff/clinical/gfe/${g.id}`} className="block rounded-md border border-border p-3 hover:border-primary/40 transition">
              <p className="text-sm">{format(new Date(g.signed_at), "PPP")} • {g.np_name} <span className="text-muted-foreground">— expired {format(new Date(g.expires_at), "PP")}</span></p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const cls =
    s === "cosigned" || s === "locked" ? "bg-success-soft text-success-soft-foreground" :
    s === "signed" ? "bg-warning-soft text-warning-soft-foreground" :
    "bg-secondary text-muted-foreground";
  return <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded ${cls}`}>{s}</span>;
}
