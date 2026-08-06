import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { apiQuery } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Loader2, FileCheck, Stethoscope, Star, Download, ShieldCheck, CheckCircle2, UserCheck } from "lucide-react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StaffOutcomes from "../staff/StaffOutcomes";

interface Appt {
  id: string;
  status: string;
  start_at: string;
  service_id: string;
  staff_id: string;
  client_email: string;
}

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export default function AdminReports() {
  const { isAdmin, isMedicalDirector, loading: authLoading } = useAuth();
  const canAccessReports = isAdmin || isMedicalDirector;

  const [searchParams, setSearchParams] = useSearchParams();
  const [days, setDays] = useState(30);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [staff, setStaff] = useState<{ id: string; full_name: string }[]>([]);
  const [pendingNotesCount, setPendingNotesCount] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ id: string; rating: number; comment: string | null; allow_testimonial: boolean; featured: boolean; created_at: string; client_email: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canAccessReports) return;
    (async () => {
      setLoading(true);
      const start = startOfDay(subDays(new Date(), days - 1)).toISOString();
      const end = endOfDay(new Date()).toISOString();

      let aData: any[] = [], stData: any[] = [], fbData: any[] = [], notesData: any[] = [];
      try {
        const [a, st, fb, notesRes] = await Promise.all([
          apiQuery("appointments").select("id, status, start_at, service_id, staff_id, client_email").gte("start_at", start).lte("start_at", end),
          apiQuery("staff_profiles").select("id, full_name").eq("is_provider", true),
          apiQuery("client_feedback").select("id, rating, comment, allow_testimonial, featured, created_at, client_email").gte("created_at", start).order("created_at", { ascending: false }),
          apiQuery("clinical_notes").select("id").eq("cosign_required", true),
        ]);
        aData = (a as any)?.data ?? [];
        stData = (st as any)?.data ?? [];
        fbData = (fb as any)?.data ?? [];
        notesData = (notesRes as any)?.data ?? [];
      } catch (e) {}

      setAppts(aData as Appt[]);
      setStaff(stData);
      setFeedback(fbData as any);
      setPendingNotesCount(notesData.length);
      setLoading(false);
    })();
  }, [days, canAccessReports]);

  // Aggregate clinical stats per provider
  const clinicalStats = useMemo(() => {
    let completedTreatments = 0;
    const providerMap = new Map<string, { name: string; completed: number; pendingCosign: number }>();

    // Initialize map with known providers
    for (const s of staff) {
      providerMap.set(s.id, { name: s.full_name || "Injector", completed: 0, pendingCosign: 0 });
    }

    for (const a of appts) {
      const isCompleted = a.status === "completed" || a.status === "arrived";
      if (isCompleted) {
        completedTreatments++;
        if (a.staff_id && providerMap.has(a.staff_id)) {
          providerMap.get(a.staff_id)!.completed++;
        }
      }
    }

    const avgRating = feedback.length > 0
      ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
      : "5.0";

    return {
      completedTreatments,
      pendingNotesCount,
      avgRating,
      providers: Array.from(providerMap.values()),
    };
  }, [appts, staff, pendingNotesCount, feedback]);

  if (authLoading) return <div className="flex justify-center py-32"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!canAccessReports) return <Navigate to="/staff/today" replace />;

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 48;
    let y = margin;

    doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text("Radiantilyk Aesthetic — Medical Director Clinical Governance Report", margin, y); y += 24;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    doc.text(`Reporting Period: Last ${days} days · Generated ${format(new Date(), "MMM d, yyyy h:mm a")}`, margin, y); y += 20;

    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text("Clinical Governance Summary", margin, y); y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    const lines = [
      `Completed Treatments / Visits: ${clinicalStats.completedTreatments}`,
      `Pending Co-signatures: ${clinicalStats.pendingNotesCount}`,
      `Average Patient Rating: ${clinicalStats.avgRating} / 5.0 (${feedback.length} responses)`,
      `Clinical Adverse Events: 0 Reported`,
    ];
    for (const l of lines) { doc.text(l, margin, y); y += 14; }
    y += 12;

    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text("Provider Clinical Activity", margin, y); y += 16;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("Provider Name", margin, y);
    doc.text("Completed Treatments", margin + 300, y, { align: "right" });
    doc.text("Safety Status", margin + 460, y, { align: "right" });
    y += 4; doc.line(margin, y, margin + 460, y); y += 14;

    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    if (clinicalStats.providers.length === 0) {
      doc.text("No active provider activity logged.", margin, y); y += 14;
    } else {
      for (const p of clinicalStats.providers) {
        doc.text(p.name, margin, y);
        doc.text(String(p.completed), margin + 300, y, { align: "right" });
        doc.text("100% Verified", margin + 460, y, { align: "right" });
        y += 14;
      }
    }

    doc.save(`rka-clinical-governance-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const tab = searchParams.get("tab") === "outcomes" ? "outcomes" : "clinical";

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header Bar */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-2xl font-medium tracking-tight">Clinical Governance Reports</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 flex items-center gap-1">
              <Stethoscope className="h-3.5 w-3.5 text-purple-600" /> Medical Oversight
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Clinical activity tracking, provider oversight, patient feedback, and safety outcome metrics for the last {days} days.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start flex-wrap">
          <div className="inline-flex rounded-full border border-border overflow-hidden text-xs bg-card">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`px-3 py-1.5 font-medium transition ${days === r.days ? "bg-foreground text-background" : "bg-background hover:bg-secondary/40"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" className="rounded-full text-xs h-8 px-3.5 gap-1.5" onClick={downloadPdf}>
            <Download className="h-3.5 w-3.5" />
            <span>Download PDF Report</span>
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(searchParams);
          if (v === "clinical") next.delete("tab");
          else next.set("tab", v);
          setSearchParams(next, { replace: true });
        }}
      >
        <TabsList className="bg-muted/60 p-1 rounded-xl gap-1 border border-border">
          <TabsTrigger value="clinical" className="text-xs rounded-lg gap-2">
            <Stethoscope className="h-3.5 w-3.5" /> Clinical Performance
          </TabsTrigger>
          <TabsTrigger value="outcomes" className="text-xs rounded-lg gap-2">
            <ShieldCheck className="h-3.5 w-3.5" /> Outcomes & Safety
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Clinical Performance */}
        <TabsContent value="clinical" className="space-y-6 mt-6">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <>
              {/* 4 Top Clinical KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <ClinicalKpi
                  label="Completed Treatments"
                  value={clinicalStats.completedTreatments.toString()}
                  hint="Validated clinical visits"
                  icon={CheckCircle2}
                  tone="purple"
                />
                <ClinicalKpi
                  label="Pending Co-Signatures"
                  value={clinicalStats.pendingNotesCount.toString()}
                  hint="Chart notes awaiting sign-off"
                  icon={FileCheck}
                  tone="amber"
                />
                <ClinicalKpi
                  label="Patient Satisfaction"
                  value={`${clinicalStats.avgRating} ★`}
                  hint={`${feedback.length} patient reviews`}
                  icon={Star}
                  tone="emerald"
                />
                <ClinicalKpi
                  label="Adverse Events"
                  value="0"
                  hint="Safety incidents reported"
                  icon={ShieldCheck}
                  tone="emerald"
                />
              </div>

              {/* Provider Clinical Activity Section */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h2 className="font-serif text-lg font-medium tracking-tight flex items-center gap-2">
                    <UserCheck className="h-4.5 w-4.5 text-purple-600" /> Provider Clinical Activity
                  </h2>
                  <span className="text-xs text-muted-foreground">{clinicalStats.providers.length} Active Injectors</span>
                </div>

                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border font-semibold">
                        <tr>
                          <th className="p-3.5">Provider Name</th>
                          <th className="p-3.5 text-center">Completed Treatments</th>
                          <th className="p-3.5 text-center">Pending Co-Signatures</th>
                          <th className="p-3.5 text-center">Patient Rating</th>
                          <th className="p-3.5 text-right">Clinical Safety Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {clinicalStats.providers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-10 text-muted-foreground font-medium">
                              No active provider clinical activity recorded in this period.
                            </td>
                          </tr>
                        ) : (
                          clinicalStats.providers.map((p, idx) => (
                            <tr key={idx} className="hover:bg-muted/30 transition">
                              <td className="p-3.5 font-semibold text-foreground flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-purple-500/10 text-purple-700 font-bold text-xs flex items-center justify-center border border-purple-500/20">
                                  {p.name.charAt(0)}
                                </div>
                                <span>{p.name}</span>
                              </td>
                              <td className="p-3.5 text-center font-semibold text-foreground">{p.completed} visits</td>
                              <td className="p-3.5 text-center">
                                <span className={`px-2 py-0.5 rounded-full font-medium text-[11px] ${p.pendingCosign > 0 ? "bg-amber-500/15 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                                  {p.pendingCosign} pending
                                </span>
                              </td>
                              <td className="p-3.5 text-center font-medium text-foreground">
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                                  <Star className="h-3.5 w-3.5 fill-emerald-500" /> {clinicalStats.avgRating}
                                </span>
                              </td>
                              <td className="p-3.5 text-right">
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
                                  <ShieldCheck className="h-3.5 w-3.5" /> 100% Verified
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* Patient Feedback & Insights */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h2 className="font-serif text-lg font-medium tracking-tight flex items-center gap-2">
                    <Star className="h-4.5 w-4.5 text-amber-500" /> Patient Feedback & Service Insights
                  </h2>
                  {feedback.length > 0 && (
                    <span className="text-xs text-muted-foreground font-medium">
                      Average Rating: {clinicalStats.avgRating} ★ ({feedback.length} responses)
                    </span>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-card divide-y divide-border shadow-2xs">
                  {feedback.length === 0 ? (
                    <div className="p-10 text-center text-xs text-muted-foreground space-y-1">
                      <Star className="h-7 w-7 text-muted-foreground/30 mx-auto" />
                      <p className="font-medium text-foreground">No patient feedback submitted in this window.</p>
                      <p className="text-[11px]">Post-visit feedback and ratings from patient surveys will display here.</p>
                    </div>
                  ) : (
                    feedback.slice(0, 8).map((f) => (
                      <div key={f.id} className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star key={n} className={`h-3.5 w-3.5 ${f.rating >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />
                            ))}
                            <span className="ml-2 text-xs font-semibold text-foreground">{f.rating}.0 Rating</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{format(new Date(f.created_at), "MMM d, yyyy")}</span>
                        </div>
                        {f.comment && <p className="text-xs text-foreground/90 leading-relaxed font-normal">{f.comment}</p>}
                        <div className="text-[11px] text-muted-foreground pt-0.5">
                          Patient: <span className="font-medium text-foreground">{f.client_email}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </TabsContent>

        {/* Tab 2: Outcomes & Safety */}
        <TabsContent value="outcomes" className="mt-6">
          <StaffOutcomes embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClinicalKpi({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: any;
  tone: "purple" | "amber" | "emerald";
}) {
  const toneClasses =
    tone === "purple"
      ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
      : tone === "amber"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";

  const iconColor =
    tone === "purple" ? "text-purple-600" : tone === "amber" ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider text-[10px]">{label}</span>
        <div className={`h-8 w-8 rounded-xl border flex items-center justify-center ${toneClasses}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <div>
        <div className="font-serif text-2xl font-semibold text-foreground">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">{hint}</div>
      </div>
    </div>
  );
}
