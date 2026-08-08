// Clinical inbox — simplified. Everything lives in the patient's chart.
// This page is just: find a patient, plus urgent alerts (cosign queue, expiring GFEs, HIPAA amendment requests).
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiQuery, ApiClient } from "@/services/api";
import { clinicalService } from "@/services/api/clinicalService";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ShieldAlert, FileText, ShieldCheck, Search, Calendar as CalIcon, AlertTriangle, FileEdit, CheckCircle2, XCircle, Clock, Send } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fetchIncompleteCharts, type IncompleteChart } from "@/lib/incompleteCharts";
import { isTestPatient } from "@/lib/testPatientFilter";
import { toast } from "sonner";

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

  // HIPAA Amendment Requests State
  const [amendments, setAmendments] = useState<any[]>([]);
  const [selectedAmendment, setSelectedAmendment] = useState<any | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [processingAmendment, setProcessingAmendment] = useState(false);

  const loadAmendments = async () => {
    let dbAmendments: any[] = [];
    try {
      const { data } = await apiQuery("chart_amendments" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (data) dbAmendments = data;
    } catch {}

    let localAmendments: any[] = [];
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("rka_patient_amendments_"));
      keys.forEach((k) => {
        const email = k.replace("rka_patient_amendments_", "");
        const arr = JSON.parse(localStorage.getItem(k) || "[]");
        arr.forEach((item: any) => {
          localAmendments.push({ ...item, patient_email: email });
        });
      });
    } catch {}

    const map = new Map<string, any>();
    dbAmendments.forEach((a) => map.set(a.id, a));
    localAmendments.forEach((a) =>
      map.set(a.id, {
        id: a.id,
        patient_email: a.patient_email || a.email || "patient@example.com",
        record_type: a.recordType || a.record_type || "Clinical Note / Chart Entry",
        current_text: a.currentText || a.current_text || "",
        requested_correction: a.requestedText || a.requested_correction || "",
        rationale: a.reason || a.rationale || "",
        status: a.status || "pending",
        created_at: a.submittedAt || a.created_at || new Date().toISOString(),
      })
    );

    setAmendments(Array.from(map.values()));
  };

  const handleUpdateAmendmentStatus = async (newStatus: "approved" | "denied") => {
    if (!selectedAmendment) return;
    setProcessingAmendment(true);
    const id = selectedAmendment.id;
    const nowIso = new Date().toISOString();

    try {
      // 1. Try DB update
      try {
        await apiQuery("chart_amendments" as any)
          .update({
            status: newStatus,
            reviewed_at: nowIso,
            reviewer_email: user?.email || "staff@radiantilyk.com",
            review_notes: actionNotes.trim() || null,
          })
          .eq("id", id);
      } catch {}

      // 2. Update local storage for affected patient
      if (selectedAmendment.patient_email) {
        const storageKey = `rka_patient_amendments_${selectedAmendment.patient_email.toLowerCase()}`;
        try {
          const local: any[] = JSON.parse(localStorage.getItem(storageKey) || "[]");
          const updated = local.map((r) =>
            r.id === id ? { ...r, status: newStatus, reviewNotes: actionNotes.trim() || undefined } : r
          );
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {}
      }

      setAmendments((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
      toast.success(
        `Amendment request for ${selectedAmendment.patient_email} marked as ${
          newStatus === "approved" ? "Approved & Amended" : "Denied"
        }.`
      );
      setSelectedAmendment(null);
      setActionNotes("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update amendment status");
    } finally {
      setProcessingAmendment(false);
    }
  };

  const loadRecentNotes = async () => {
    let dbNotes: any[] = [];
    try {
      const { data } = await apiQuery("clinical_notes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) dbNotes = data;
    } catch {}

    let dbGfes: any[] = [];
    try {
      const { data } = await apiQuery("gfe_records")
        .select("*")
        .order("signed_at", { ascending: false })
        .limit(50);
      if (data) dbGfes = data;
    } catch {}

    let localNotes: any[] = [];
    try {
      localNotes = JSON.parse(localStorage.getItem("rka_demo_clinical_notes") || "[]");
    } catch {}

    let localGfes: any[] = [];
    try {
      localGfes = JSON.parse(localStorage.getItem("rka_demo_gfe_records") || "[]");
    } catch {}

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

    dbGfes.forEach((g) => {
      if (g.id) map.set(`gfe-${g.id}`, formatGfe(g));
    });
    localGfes.forEach((g) => {
      if (g.id) map.set(`gfe-${g.id}`, formatGfe(g));
    });

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
          apiQuery("gfe_records")
            .select("id, client_email, client_first_name, client_last_name, np_name, expires_at")
            .gte("expires_at", now.toISOString())
            .lt("expires_at", in30)
            .order("expires_at")
            .limit(20),
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
        await loadAmendments();
      } catch (e) {
        console.error("[StaffClinical] load failed:", e);
        setIncompleteError(e instanceof Error ? e.message : "Incomplete charts could not be loaded.");
      } finally {
        setLoading(false);
      }
    })();

    const handleUpdate = () => {
      loadRecentNotes();
      loadAmendments();
    };
    window.addEventListener("rka_clinical_note_saved", handleUpdate);
    return () => window.removeEventListener("rka_clinical_note_saved", handleUpdate);
  }, [user, authLoading, canSeeAll, staffId]);

  const handleOpenChart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookup.trim()) return;
    const term = lookup.trim();
    if (term.includes("@")) {
      navigate(`/staff/clinical/clients/${encodeURIComponent(term.toLowerCase())}`);
    } else {
      navigate(`/staff/clients?q=${encodeURIComponent(term)}`);
    }
  };

  const pendingAmendmentsCount = amendments.filter((a) => a.status === "pending" || !a.status).length;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="border-b border-border pb-5">
        <h1 className="font-serif text-2xl md:text-3xl font-medium tracking-tight">Clinical Dashboard &amp; Charts</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Find patient charts, manage incomplete visit notes, review GFEs, and process HIPAA record amendments.
        </p>
      </div>

      {/* Patient Search Bar */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
          Find or open a patient chart
        </div>
        <form onSubmit={handleOpenChart} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="Enter patient email or name..."
              className="pl-8"
            />
          </div>
          <Button type="submit" size="sm">
            Open chart
          </Button>
        </form>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link to="/staff/today">
              <CalIcon className="h-4 w-4 mr-2" />
              Today's schedule
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/staff/clients">
              <Search className="h-4 w-4 mr-2" />
              Browse all patients
            </Link>
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && (
        <>
          {/* Patient Record Amendment Requests (HIPAA §164.526) */}
          <Section title={`Patient Record Amendment Requests (${amendments.length})`} accent={pendingAmendmentsCount > 0}>
            <div className="flex items-center justify-between gap-2 -mt-1 mb-2">
              <p className="text-[11px] text-muted-foreground">
                Patient requests to amend or correct their clinical chart entries under HIPAA §164.526.
              </p>
              {pendingAmendmentsCount > 0 && (
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] font-semibold">
                  {pendingAmendmentsCount} Pending SLA Review
                </Badge>
              )}
            </div>

            {amendments.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground text-center">
                No patient record amendment requests submitted.
              </div>
            ) : (
              <div className="space-y-2.5">
                {amendments.map((a) => (
                  <div key={a.id} className="rounded-xl border border-border bg-card p-4 text-xs space-y-2 hover:border-primary/40 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileEdit className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-semibold text-foreground">{a.patient_email}</span>
                        <span className="text-muted-foreground">• {a.record_type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.status === "approved" ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                          </Badge>
                        ) : a.status === "denied" ? (
                          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]">
                            <XCircle className="h-3 w-3 mr-1" /> Denied
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                            <Clock className="h-3 w-3 mr-1" /> Pending SLA Review
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedAmendment(a);
                            setActionNotes("");
                          }}
                          className="h-7 text-xs rounded-full px-3"
                        >
                          Review Request
                        </Button>
                      </div>
                    </div>
                    <p className="text-muted-foreground">
                      <strong className="text-foreground font-medium">Requested Amendment:</strong> {a.requested_correction}
                    </p>
                    <p className="text-muted-foreground">
                      <strong className="text-foreground font-medium">Rationale:</strong> {a.rationale}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Recent Chart Notes */}
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
              recentNotes.slice(0, 10).map((n) => <NoteRow key={n.id} n={n} />)
            )}
          </Section>

          {(isNP || isMedicalDirector || isAdmin) && needsCosign.length > 0 && (
            <Section title={`Awaiting co-signature (${needsCosign.length})`} accent>
              {needsCosign.map((n) => (
                <NoteRow key={n.id} n={n} />
              ))}
            </Section>
          )}

          {expiringGfes.length > 0 && (
            <Section title="GFEs expiring soon">
              {expiringGfes.map((g) => (
                <Link
                  key={g.id}
                  to={`/staff/clinical/clients/${encodeURIComponent(g.client_email)}`}
                  className="block rounded-md border border-border p-3 hover:border-primary/40 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {g.client_first_name} {g.client_last_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {g.client_email} • by {g.np_name}
                        </p>
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

      {/* Review & Respond Amendment Dialog */}
      <Dialog open={!!selectedAmendment} onOpenChange={(open) => !open && setSelectedAmendment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-serif">
              <ShieldCheck className="h-5 w-5 text-primary" /> Review HIPAA §164.526 Amendment Request
            </DialogTitle>
          </DialogHeader>

          {selectedAmendment && (
            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1.5">
                <div>
                  <span className="font-semibold text-foreground">Patient Email:</span> {selectedAmendment.patient_email}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Record Category:</span> {selectedAmendment.record_type}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Submitted Date:</span>{" "}
                  {new Date(selectedAmendment.created_at).toLocaleString()}
                </div>
              </div>

              {selectedAmendment.current_text && (
                <div>
                  <span className="font-semibold text-foreground">Existing Record Entry:</span>
                  <p className="p-2.5 rounded-lg border border-border bg-background mt-1 text-muted-foreground">
                    {selectedAmendment.current_text}
                  </p>
                </div>
              )}

              <div>
                <span className="font-semibold text-foreground">Requested Correction / Amendment:</span>
                <p className="p-2.5 rounded-lg border border-border bg-background mt-1 font-medium text-foreground">
                  {selectedAmendment.requested_correction}
                </p>
              </div>

              <div>
                <span className="font-semibold text-foreground">Patient Rationale:</span>
                <p className="p-2.5 rounded-lg border border-border bg-background mt-1 text-muted-foreground">
                  {selectedAmendment.rationale}
                </p>
              </div>

              <div>
                <span className="font-semibold text-foreground">Staff Review Notes / Addendum Statement (Optional):</span>
                <Textarea
                  rows={2}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Enter staff review explanation or addendum details..."
                  className="mt-1 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => setSelectedAmendment(null)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={processingAmendment}
              onClick={() => handleUpdateAmendmentStatus("denied")}
              className="text-rose-600 border-rose-500/30 hover:bg-rose-500/10"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" /> Deny Request
            </Button>
            <Button
              size="sm"
              disabled={processingAmendment}
              onClick={() => handleUpdateAmendmentStatus("approved")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve &amp; Amend Chart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <div className={`text-xs uppercase tracking-widest ${accent ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function NoteRow({ n }: { n: any }) {
  const cls =
    n.status === "cosigned" || n.status === "locked"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
      : n.status === "signed" || n.isGfe
      ? "bg-emerald-600 text-white font-semibold"
      : "bg-secondary text-muted-foreground";
  const name = `${n.client_first_name ?? ""} ${n.client_last_name ?? ""}`.trim() || n.client_email || "Client";
  const linkTo = n.isGfe ? `/staff/clinical/gfe/${n.id.replace(/^gfe-/, "")}` : `/staff/clinical/notes/${n.id}`;

  return (
    <Link
      to={linkTo}
      className="block rounded-md border border-border p-3 hover:border-primary/40 hover:bg-secondary/40 transition"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {name} <span className="text-muted-foreground">— {n.service_name ?? n.category}</span>
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {n.provider_name || "Provider"} • {formatDateSafe(n.signed_at || n.created_at)}
            </p>
          </div>
        </div>
        <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded shrink-0 ${cls}`}>
          {n.isGfe ? "Signed GFE" : n.status || "signed"}
        </span>
      </div>
    </Link>
  );
}
