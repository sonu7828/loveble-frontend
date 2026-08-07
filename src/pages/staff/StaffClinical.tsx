// Clinical inbox — simplified. Everything lives in the patient's chart.
// This page is just: find a patient, plus urgent alerts (cosign queue, expiring GFEs).
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiQuery, authService, ApiClient } from "@/services/api";
import { clinicalService } from "@/services/api/clinicalService";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ShieldAlert, FileText, ShieldCheck, Search, Calendar as CalIcon, AlertTriangle, ClipboardPlus, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchIncompleteCharts, type IncompleteChart } from "@/lib/incompleteCharts";
import { isTestPatient } from "@/lib/testPatientFilter";

export default function StaffClinical() {
  const { user, isClinicalStaff, isNP, isMedicalDirector, isAdmin, canSeeAll, staffId, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [lookup, setLookup] = useState("");
  const [loading, setLoading] = useState(true);
  const [needsCosign, setNeedsCosign] = useState<any[]>([]);
  const [expiringGfes, setExpiringGfes] = useState<any[]>([]);
  const [incomplete, setIncomplete] = useState<IncompleteChart[]>([]);
  const [incompleteError, setIncompleteError] = useState<string | null>(null);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);

  const loadRecentNotes = async () => {
    let dbNotes: any[] = [];
    try {
      const { data } = await apiQuery("clinical_notes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) dbNotes = data;
    } catch { }

    let dbGfes: any[] = [];
    try {
      const { data } = await apiQuery("gfe_records")
        .select("*")
        .order("signed_at", { ascending: false })
        .limit(50);
      if (data) dbGfes = data;
    } catch { }

    let localNotes: any[] = [];
    try {
      localNotes = JSON.parse(localStorage.getItem("rka_demo_clinical_notes") || "[]");
    } catch { }

    let localGfes: any[] = [];
    try {
      localGfes = JSON.parse(localStorage.getItem("rka_demo_gfe_records") || "[]");
    } catch { }

    const map = new Map<string, any>();
    
    // Add DB & Local SOAP Clinical Notes
    dbNotes.forEach((n) => map.set(n.id, n));
    localNotes.forEach((n) => map.set(n.id, n));

    // Add DB & Local GFEs mapped into chart note format
    const formatGfe = (g: any) => ({
      id: g.id,
      client_email: g.client_email,
      client_first_name: g.client_first_name,
      client_last_name: g.client_last_name,
      service_name: "California Good Faith Exam (GFE)",
      category: "GFE",
      provider_name: g.np_name || "NP Practitioner",
      status: "signed",
      signed_at: g.signed_at || g.created_at,
      created_at: g.created_at || g.signed_at,
      isGfe: true,
    });

    dbGfes.forEach((g) => { if (g.id) map.set(`gfe-${g.id}`, formatGfe(g)); });
    localGfes.forEach((g) => { if (g.id) map.set(`gfe-${g.id}`, formatGfe(g)); });

    const merged = Array.from(map.values());

    const sorted = [...merged]
      .filter((n) => !isTestPatient(n))
      .sort((a, b) => {
        const tA = new Date(a.signed_at || a.created_at || 0).getTime();
        const tB = new Date(b.signed_at || b.created_at || 0).getTime();
        return tB - tA;
      });

    setRecentNotes(sorted);
  };

  useEffect(() => {
    if (!user || authLoading) return;
    (async () => {
      setLoading(true);
      setIncompleteError(null);
      try {
        const now = new Date();
        const in30 = new Date(now.getTime() + 30 * 86400000).toISOString();
        const [cosQueue, gexRes, incompleteRows] = await Promise.all([
          clinicalService.getCosignQueue().catch(() => []),
          apiQuery("gfe_records").select("id, client_email, client_first_name, client_last_name, np_name, expires_at").gte("expires_at", now.toISOString()).lt("expires_at", in30).order("expires_at").limit(20),
          fetchIncompleteCharts({ canSeeAll, staffId }),
        ]);
        if (gexRes.error) console.error("[StaffClinical] gfe query error:", gexRes.error);
        const mappedCosign = cosQueue
          .map((item: any) => ({
            id: item.note?.id || item.noteId,
            client_first_name: item.note?.patient?.firstName || "",
            client_last_name: item.note?.patient?.lastName || "",
            client_email: item.note?.patient?.email || "—",
            service_name: item.note?.serviceName || "Clinical Note",
            provider_name: item.author?.fullName || "RN Injector",
            signed_at: item.note?.signedAt || item.requestedAt,
            status: item.note?.status || "pending_cosign",
          }))
          .filter((n: any) => !isTestPatient(n));
        setNeedsCosign(mappedCosign);
        setExpiringGfes((gexRes.data ?? []).filter((g: any) => !isTestPatient(g)));
        setIncomplete(incompleteRows.filter((r) => !isTestPatient(r.appointment)));
        await loadRecentNotes();
      } catch (e) {
        console.error("[StaffClinical] load failed:", e);
        setIncompleteError(e instanceof Error ? e.message : "Incomplete charts could not be loaded.");
      } finally {
        setLoading(false);
      }
    })();

    const handleUpdate = () => loadRecentNotes();
    window.addEventListener("rka_chart_note_updated", handleUpdate);
    window.addEventListener("rka_gfe_updated", handleUpdate);
    return () => {
      window.removeEventListener("rka_chart_note_updated", handleUpdate);
      window.removeEventListener("rka_gfe_updated", handleUpdate);
    };
  }, [user, authLoading, canSeeAll, staffId]);

  if (authLoading) return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isClinicalStaff && !canSeeAll) {
    return (
      <div className="max-w-md mx-auto p-10 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 mx-auto text-warning" />
        <p className="text-sm text-muted-foreground">Clinical staff role required.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Clinical Documentation</div>
        <h1 className="text-2xl font-serif">Charts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every patient has one chart. GFE, chart notes, photos, and consents all live there.
        </p>
      </div>

      {/* Incomplete charts — first thing staff need to see */}
      {loading ? (
        <div className="rounded-lg border border-warning/30 bg-warning-soft/40 p-5 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-warning-soft-foreground" />
          <p className="text-sm text-muted-foreground">Loading incomplete charts…</p>
        </div>
      ) : incomplete.length > 0 ? (
        <Section title={`Incomplete charts (${incomplete.length})`} accent>
          <p className="text-[11px] text-muted-foreground -mt-1">
            All past appointments with missing chart notes or unsigned consents.
          </p>

          {incomplete.map((row) => {
            const a = row.appointment;
            const reasons: string[] = [];
            if (row.missingNote) reasons.push("Chart note");
            if (row.unsignedConsents > 0) reasons.push(`${row.unsignedConsents} unsigned consent${row.unsignedConsents > 1 ? "s" : ""}`);
            return (
              <div
                key={a.id}
                className="rounded-md border border-warning/30 bg-warning-soft/40 p-3 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <AlertTriangle className="h-4 w-4 text-warning-soft-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {a.client_first_name} {a.client_last_name}{" "}
                        <span className="text-muted-foreground">— {reasons.join(" • ")}</span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.client_email}{a.staff_name ? ` • ${a.staff_name}` : ""} • {format(new Date(a.end_at), "PP")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {row.missingNote && (
                      <Button asChild size="sm" className="rounded-full">
                        <Link to={`/staff/clinical/notes/new?appointment=${a.id}`}>
                          <ClipboardPlus className="h-3.5 w-3.5 mr-1.5" />Complete chart
                        </Link>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline" className="rounded-full">
                      <Link to={`/staff/appointments/${a.id}`}>
                        Open appointment<ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </Section>
      ) : incompleteError ? (
        <Section title="Incomplete charts" accent>
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Could not load incomplete charts: {incompleteError}
          </p>
        </Section>
      ) : (
        <Section title="Incomplete charts">
          <p className="rounded-md border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
            No incomplete charts. 🎉
          </p>
        </Section>
      )}

      {/* Open a patient's chart */}
      <div className="rounded-lg border border-border bg-secondary/30 p-5 space-y-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Open a patient chart</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const query = lookup.trim().toLowerCase();
            if (!query) return;

            let matchedEmail = "";
            try {
              const gfes: any[] = JSON.parse(localStorage.getItem("rka_demo_gfe_records") || "[]");
              const gfeMatch = gfes.find(g =>
                (g.client_email || "").toLowerCase() === query ||
                (`${g.client_first_name || ""} ${g.client_last_name || ""}`).toLowerCase().includes(query)
              );
              if (gfeMatch?.client_email) matchedEmail = gfeMatch.client_email;
            } catch { }

            if (!matchedEmail) {
              try {
                const notes: any[] = JSON.parse(localStorage.getItem("rka_demo_clinical_notes") || "[]");
                const noteMatch = notes.find(n =>
                  (n.client_email || "").toLowerCase() === query ||
                  (`${n.client_first_name || ""} ${n.client_last_name || ""}`).toLowerCase().includes(query)
                );
                if (noteMatch?.client_email) matchedEmail = noteMatch.client_email;
              } catch { }
            }

            if (!matchedEmail) {
              try {
                const appts: any[] = JSON.parse(localStorage.getItem("rka_demo_appointments") || "[]");
                const apptMatch = appts.find(a =>
                  (a.client_email || a.clientEmail || "").toLowerCase() === query ||
                  (`${a.client_first_name || a.first_name || ""} ${a.client_last_name || a.last_name || ""}`).toLowerCase().includes(query)
                );
                if (apptMatch?.client_email || apptMatch?.clientEmail) matchedEmail = apptMatch.client_email || apptMatch.clientEmail;
              } catch { }
            }

            const target = matchedEmail || query;
            navigate(`/staff/clinical/clients/${encodeURIComponent(target)}`);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="Search patient by Name, Phone, or Email…"
              type="text"
              className="pl-8"
            />
          </div>
          <Button type="submit" size="sm">Open chart</Button>
        </form>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link to="/staff/today"><CalIcon className="h-4 w-4 mr-2" />Today's schedule</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/staff/clients"><Search className="h-4 w-4 mr-2" />Browse all patients</Link>
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Tip: every patient chart contains <span className="font-medium">Good Faith Examinations (GFEs)</span>, <span className="font-medium">SOAP chart notes</span>, <span className="font-medium">Pre/Post photos</span>, and <span className="font-medium">consents</span>.
          {isNP && <> NPs can sign a GFE anytime — it stays valid for 12 months.</>}
        </p>
      </div>

      {!loading && (
        <>
          <Section title={`Recent Chart Notes (${recentNotes.length})`}>
            <div className="flex items-center justify-between gap-2 -mt-1 mb-1">
              <p className="text-[11px] text-muted-foreground">Recently created and signed chart notes across all patients</p>
              <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs text-primary font-medium">
                <Link to="/staff/clinical/notes">View all chart notes →</Link>
              </Button>
            </div>

            {recentNotes.length === 0 ? (
              <p className="rounded-md border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
                No recent chart notes found. Create a new chart note from any patient appointment or profile.
              </p>
            ) : (
              recentNotes.slice(0, 10).map((n) => (
                <NoteRow key={n.id} n={n} />
              ))
            )}
          </Section>

          {(isNP || isMedicalDirector || isAdmin) && needsCosign.length > 0 && (
            <Section title={`Awaiting co-signature (${needsCosign.length})`} accent>
              {needsCosign.map(n => <NoteRow key={n.id} n={n} />)}
            </Section>
          )}


          {expiringGfes.length > 0 && (
            <Section title="GFEs expiring soon">
              {expiringGfes.map(g => (
                <Link key={g.id} to={`/staff/clinical/clients/${encodeURIComponent(g.client_email)}`} className="block rounded-md border border-border p-3 hover:border-primary/40 transition">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{g.client_first_name} {g.client_last_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{g.client_email} • by {g.np_name}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">Expires {formatDateSafe(g.expires_at, "PP")}</span>
                  </div>
                </Link>
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function formatDateSafe(val: any, fmt = "PPP p") {
  if (!val) return "Recently";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "Recently";
    return format(d, fmt);
  } catch {
    return "Recently";
  }
}

function Section({ title, accent, children }: { title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className={`text-xs uppercase tracking-widest ${accent ? "text-warning-soft-foreground" : "text-muted-foreground"}`}>{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function NoteRow({ n }: { n: any }) {
  const cls =
    n.status === "cosigned" || n.status === "locked" ? "bg-success-soft text-success-soft-foreground" :
    n.status === "signed" || n.isGfe ? "bg-emerald-600 text-white font-semibold" :
    "bg-secondary text-muted-foreground";
  const name = `${n.client_first_name ?? ""} ${n.client_last_name ?? ""}`.trim() || n.client_email || "Client";
  const linkTo = n.isGfe ? `/staff/clinical/gfe/${n.id.replace(/^gfe-/, "")}` : `/staff/clinical/notes/${n.id}`;

  return (
    <Link to={linkTo} className="block rounded-md border border-border p-3 hover:border-primary/40 hover:bg-secondary/40 transition">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{name} <span className="text-muted-foreground">— {n.service_name ?? n.category}</span></p>
            <p className="text-xs text-muted-foreground truncate">{n.provider_name || "Provider"} • {formatDateSafe(n.signed_at || n.created_at)}</p>
          </div>
        </div>
        <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded shrink-0 ${cls}`}>{n.isGfe ? "Signed GFE" : n.status || "signed"}</span>
      </div>
    </Link>
  );
}
