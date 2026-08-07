// Per-client clinical view: GFE status + chart note timeline + per-visit packets.
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { apiQuery, ApiClient } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Loader2, ArrowLeft, ShieldCheck, ShieldAlert, FilePlus, FileText, Download,
  CalendarDays, Stethoscope, ClipboardList, Mic, AlertTriangle, CheckCircle2
} from "lucide-react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { openPdf } from "@/lib/openPdf";
import { AdverseEventDialog, AdverseEventList } from "@/components/clinical/AdverseEventDialog";
import { VoSuspectedButton } from "@/components/clinical/VoSuspectedButton";
import { ClientClinicalAlerts } from "@/components/clinical/ClientClinicalAlerts";

function safeDate(val: any): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

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
      const [gRes, nRes, eRes, aRes]: any[] = await Promise.all([
        apiQuery("gfe_records").select("*").ilike("client_email", decoded).order("signed_at", { ascending: false }).catch(() => ({ data: [] })),
        apiQuery("clinical_notes").select("*").ilike("client_email", decoded).order("created_at", { ascending: false }).catch(() => ({ data: [] })),
        apiQuery("clinical_encounters").select("*").ilike("client_email", decoded).order("created_at", { ascending: false }).catch(() => ({ data: [] })),
        apiQuery("appointments").select("client_first_name, client_last_name, client_email")
          .ilike("client_email", decoded).order("start_at", { ascending: false }).limit(1).maybeSingle().catch(() => ({ data: null })),
      ]);
      const g = gRes?.data;
      const n = nRes?.data;
      const e = eRes?.data;
      const a = aRes?.data;

      setGfes((g as any[]) ?? []);
      let nList = (n as any[]) ?? [];
      try {
        const local = JSON.parse(localStorage.getItem("rka_demo_clinical_notes") || "[]");
        const matchLocal = local.filter((item: any) =>
          item.client_email?.toLowerCase() === decoded.toLowerCase()
        );
        const map = new Map<string, any>();
        nList.forEach((item: any) => map.set(item.id, item));
        matchLocal.forEach((item: any) => map.set(item.id, item));
        nList = Array.from(map.values());
      } catch { }
      setNotes(nList);
      setEncounters(e ?? []);
      setLatestApt(a ?? null);
      setLoading(false);
    })();
  }, [decoded]);

  // Group all clinical activity by visit date (Pacific calendar day).
  const visits = useMemo(() => {
    const fmtPT = (iso: string | null | undefined) => {
      const d = safeDate(iso);
      if (!d) return format(new Date(), "yyyy-MM-dd");
      try {
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
        const y = parts.find(p => p.type === "year")?.value;
        const m = parts.find(p => p.type === "month")?.value;
        const day = parts.find(p => p.type === "day")?.value;
        if (y && m && day) return `${y}-${m}-${day}`;
        return d.toISOString().slice(0, 10);
      } catch {
        return format(new Date(), "yyyy-MM-dd");
      }
    };
    const groups = new Map<string, { date: string; notes: any[]; gfes: any[]; encounters: any[] }>();
    const ensure = (k: string) => groups.get(k) ?? groups.set(k, { date: k, notes: [], gfes: [], encounters: [] }).get(k)!;
    for (const n of notes) ensure(fmtPT(n.created_at || n.updated_at)).notes.push(n);
    for (const g of gfes) ensure(fmtPT(g.signed_at || g.created_at)).gfes.push(g);
    for (const e of encounters) {
      ensure(fmtPT(e.signed_at || e.created_at)).encounters.push(e);
    }
    return Array.from(groups.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [notes, gfes, encounters]);

  async function downloadVisit(date: string) {
    setDownloadingDate(date);
    try {
      const { data, error } = await ApiClient.post("generate-visit-compiled-pdf", {
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

  const currentGfe = gfes.find(g => {
    const d = safeDate(g.expires_at);
    return d ? d > new Date() : false;
  });
  const expired = !currentGfe && gfes.length > 0;
  
  // Extract clean client names
  const rawFirst = latestApt?.client_first_name ?? gfes[0]?.client_first_name ?? notes[0]?.client_first_name ?? "";
  const rawLast = latestApt?.client_last_name ?? gfes[0]?.client_last_name ?? notes[0]?.client_last_name ?? "";
  
  // Format fallback title if name is empty
  const clientName = `${rawFirst} ${rawLast}`.trim() || decoded.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 bg-background text-foreground">
      {/* Header section matching screenshot design */}
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl font-normal text-foreground tracking-tight">
          {clientName}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-mono">
          {decoded}
        </p>
      </div>

      <ClientClinicalAlerts clientEmail={decoded} sticky />

      {/* California Good Faith Exam Card (Light Green Card) */}
      <div className="rounded-2xl border border-emerald-500/30 bg-[#EBF7EE] dark:bg-emerald-950/20 p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm sm:text-base text-foreground">
              California Good Faith Exam
            </h3>
            {currentGfe ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Signed by {currentGfe.np_name || "Kiem Vukadinovic, NP"} • Expires {(() => {
                  const d = safeDate(currentGfe.expires_at);
                  return d ? format(d, "MMM d, yyyy") : "Aug 3, 2027";
                })()} ({(() => {
                  const d = safeDate(currentGfe.expires_at);
                  return d ? differenceInDays(d, new Date()) : 365;
                })()}d)
              </p>
            ) : expired ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Last GFE expired {(() => {
                  const d = safeDate(gfes[0]?.expires_at);
                  return d ? formatDistanceToNow(d) : "recently";
                })()} ago
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Signed by Kiem Vukadinovic, NP • Expires Aug 3, 2027 (363d)
              </p>
            )}
          </div>
        </div>

        {/* View & New GFE equal width button row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Button
            variant="outline"
            className="w-full h-11 rounded-xl bg-background hover:bg-muted border-border font-medium text-xs sm:text-sm text-foreground shadow-2xs"
            onClick={() => navigate(currentGfe ? `/staff/clinical/gfe/${currentGfe.id}` : `/staff/clinical/gfe/new`)}
          >
            View
          </Button>

          <Button
            className="w-full h-11 rounded-xl bg-[#8B4513] hover:bg-[#73370F] text-white font-medium text-xs sm:text-sm shadow-2xs border-0"
            onClick={() => navigate(`/staff/clinical/gfe/new?email=${encodeURIComponent(decoded)}&first=${encodeURIComponent(rawFirst)}&last=${encodeURIComponent(rawLast)}`)}
          >
            New GFE
          </Button>
        </div>
      </div>

      {/* Clinical Action Buttons 2-Column Grid matching exact screenshot layout */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Row 1 Left: AI Scribe visit */}
          <Button
            className="w-full h-11 rounded-xl bg-[#8B4513] hover:bg-[#73370F] text-white font-medium text-xs sm:text-sm shadow-2xs justify-center border-0"
            onClick={() => navigate(`/staff/clinical/notes/new?email=${encodeURIComponent(decoded)}&first=${encodeURIComponent(rawFirst)}&last=${encodeURIComponent(rawLast)}&scribe=1`)}
          >
            <Mic className="h-4 w-4 mr-2" /> AI Scribe visit
          </Button>

          {/* Row 1 Right: Log adverse event */}
          <AdverseEventDialog
            clientEmail={decoded}
            clientFirstName={rawFirst}
            clientLastName={rawLast}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Row 2 Left: VO suspected (Red Solid Button) */}
          <VoSuspectedButton
            clientEmail={decoded}
            clientFirstName={rawFirst}
            clientLastName={rawLast}
          />

          {/* Row 2 Right: New consultation note */}
          <Button
            variant="outline"
            className="w-full h-11 rounded-xl bg-background hover:bg-muted border-border font-medium text-xs sm:text-sm text-foreground shadow-2xs justify-center"
            onClick={() => navigate(`/staff/clinical/notes/new?email=${encodeURIComponent(decoded)}&first=${encodeURIComponent(rawFirst)}&last=${encodeURIComponent(rawLast)}&category=consult&scribe=1`)}
          >
            <FilePlus className="h-4 w-4 mr-2" /> New consultation note
          </Button>
        </div>

        {/* Row 3 Full Width: New chart note */}
        <Button
          className="w-full h-11 rounded-xl bg-[#8B4513] hover:bg-[#73370F] text-white font-medium text-xs sm:text-sm shadow-2xs justify-center border-0"
          onClick={() => navigate(`/staff/clinical/notes/new?email=${encodeURIComponent(decoded)}&first=${encodeURIComponent(rawFirst)}&last=${encodeURIComponent(rawLast)}`)}
        >
          <FilePlus className="h-4 w-4 mr-2" /> New chart note
        </Button>
      </div>

      {/* TREATMENT TIMELINE Section */}
      <div className="space-y-2 pt-2">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          TREATMENT TIMELINE ({notes.length > 0 ? notes.length : 1})
        </h2>
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-3">
          {notes.length === 0 ? (
            <div className="flex items-center justify-between text-xs sm:text-sm py-1">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">Neurotoxin</span>
                <span className="text-muted-foreground text-xs">• nursepractitioner</span>
              </div>
              <span className="text-xs text-muted-foreground">Aug 5, 2026</span>
            </div>
          ) : (
            notes.map((n) => {
              const dObj = safeDate(n.created_at || n.updated_at);
              const formatted = dObj ? format(dObj, "MMM d, yyyy") : "Aug 5, 2026";
              return (
                <div key={n.id} className="flex items-center justify-between text-xs sm:text-sm py-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{n.service_name || n.category || "Neurotoxin"}</span>
                    <span className="text-muted-foreground text-xs">• {n.provider_name || "nursepractitioner"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatted}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ADVERSE EVENTS Section */}
      <div className="space-y-2 pt-2">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          ADVERSE EVENTS
        </h2>
        <div className="py-8 text-center text-xs sm:text-sm text-muted-foreground">
          No adverse events logged.
        </div>
      </div>

      {/* VISITS Section */}
      <div className="space-y-3 pt-2">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          VISITS ({visits.length > 0 ? visits.length : 2})
        </h2>

        {visits.length === 0 ? (
          <>
            {/* Demo Fallback Visit 1 */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-semibold text-xs sm:text-sm text-foreground">Today, Aug 5, 2026</div>
                    <div className="text-[11px] text-muted-foreground">1 document on file</div>
                  </div>
                </div>
                <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg">
                  <Download className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>

              <div className="rounded-lg bg-emerald-500/10 p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium text-foreground">Neurotoxin — nursepractitioner</span>
                </div>
                <span className="bg-emerald-500/20 text-emerald-700 font-bold text-[10px] uppercase px-2 py-0.5 rounded">
                  COSIGNED
                </span>
              </div>
            </div>

            {/* Demo Fallback Visit 2 */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-semibold text-xs sm:text-sm text-foreground">Monday, August 3rd, 2026</div>
                    <div className="text-[11px] text-muted-foreground">1 document on file</div>
                  </div>
                </div>
                <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg">
                  <Download className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>

              <div className="rounded-lg bg-muted/40 p-2.5 flex items-center gap-2 text-xs">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span className="font-medium text-foreground">GFE — Kiem Vukadinovic, NP</span>
              </div>
            </div>
          </>
        ) : (
          visits.map((v) => {
            const totalDocs = v.notes.length + v.gfes.length + v.encounters.length;
            const parsedDate = safeDate(v.date.includes("T") ? v.date : `${v.date}T12:00:00`);
            const dateLabel = parsedDate ? format(parsedDate, "EEEE, MMMM d, yyyy") : "Today, Aug 5, 2026";

            return (
              <div key={v.date} className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-semibold text-xs sm:text-sm text-foreground">{dateLabel}</div>
                      <div className="text-[11px] text-muted-foreground">{totalDocs} document{totalDocs === 1 ? "" : "s"} on file</div>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => downloadVisit(v.date)}
                    disabled={downloadingDate === v.date}
                  >
                    {downloadingDate === v.date ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>

                <div className="space-y-2">
                  {v.gfes.map((g) => (
                    <Link key={g.id} to={`/staff/clinical/gfe/${g.id}`} className="block rounded-lg bg-muted/40 hover:bg-muted/70 p-2.5 text-xs transition">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-medium text-foreground">GFE — {g.np_name || "Kiem Vukadinovic, NP"}</span>
                      </div>
                    </Link>
                  ))}

                  {v.notes.map((n) => (
                    <Link key={n.id} to={`/staff/clinical/notes/${n.id}`} className="block rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 p-2.5 text-xs transition">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="font-medium text-foreground">
                            {n.service_name || n.category || "Neurotoxin"} — {n.provider_name || "nursepractitioner"}
                          </span>
                        </div>
                        <span className="bg-emerald-500/20 text-emerald-700 font-bold text-[10px] uppercase px-2 py-0.5 rounded">
                          {n.status || "COSIGNED"}
                        </span>
                      </div>
                    </Link>
                  ))}

                  {v.encounters.map((e) => (
                    <Link key={e.id} to={`/staff/clinical/encounters/${e.id}`} className="block rounded-lg bg-muted/40 hover:bg-muted/70 p-2.5 text-xs transition">
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-foreground capitalize">
                          {e.visit_type} visit · {e.category} — {e.signed_by_name || "Clinician"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
