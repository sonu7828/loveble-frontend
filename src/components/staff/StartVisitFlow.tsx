import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { apiQuery, ApiClient } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  CheckCircle2, Circle, Loader2, ClipboardPlus, ShieldCheck, ShieldAlert,
  FileText, CreditCard, Camera, UserCheck, ArrowRight, ClipboardList, Send, Eye,
} from "lucide-react";
import { differenceInDays, format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ClientClinicalAlerts } from "@/components/clinical/ClientClinicalAlerts";


type Props = {
  appt: any;
  consentSummary: { total: number; signed: number; pendingRequired: number; pendingOptional: number } | null;
  gfe: { id: string; expires_at: string; signed_at: string } | null;
  isNpPortal?: boolean;
  onReload: () => void;
  onSendPostOp: (opts?: { openPrintWindow?: boolean; resend?: boolean }) => Promise<void>;
};

type StepState = "done" | "current" | "pending" | "skipped";

export function StartVisitFlow({ appt, consentSummary, gfe, isNpPortal, onReload, onSendPostOp }: Props) {
  const { user } = useAuth();
  const [note, setNote] = useState<{ id: string; status: string; photo_pre_paths: string[] | null; photo_post_paths: string[] | null } | null>(null);
  const [sale, setSale] = useState<{ id: string; status: string } | null>(null);
  const [intake, setIntake] = useState<any | null>(null);
  const [lastFull, setLastFull] = useState<any | null>(null);
  const [viewingIntake, setViewingIntake] = useState<any | null>(null);
  const [intakeSentAt, setIntakeSentAt] = useState<string | null>(appt.intake_last_sent_at ?? appt.intake_sent_at ?? null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [sendingIntake, setSendingIntake] = useState(false);
  const [markingIntakeInPerson, setMarkingIntakeInPerson] = useState(false);
  const [openInPersonModal, setOpenInPersonModal] = useState(false);
  const [openVerbalModal, setOpenVerbalModal] = useState(false);

  const loadProgress = useCallback(async () => {
    setLoading(true);
    const email = (appt.client_email ?? "").toLowerCase();
    const [{ data: nRes }, { data: s }, { data: i }, { data: lf }] = await Promise.all([
      apiQuery
        .from("clinical_notes")
        .select("id, status, photo_pre_paths, photo_post_paths")
        .eq("appointment_id", appt.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      apiQuery
        .from("sales")
        .select("id, status")
        .eq("appointment_id", appt.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      apiQuery
        .from("client_intake_submissions")
        .select("*")
        .eq("appointment_id", appt.id)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      apiQuery
        .from("client_intake_submissions")
        .select("*")
        .eq("client_email", email)
        .eq("submission_kind", "full")
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let finalNote = nRes ?? null;
    if (!finalNote) {
      try {
        const localList: any[] = JSON.parse(localStorage.getItem("rka_demo_clinical_notes") || localStorage.getItem("rka_demo_chart_notes") || "[]");
        const match = localList.find((cn: any) => cn.appointment_id === appt.id || cn.appointmentId === appt.id || (cn.client_email || "").toLowerCase() === email);
        if (match) finalNote = match;
      } catch {}
    }

    setNote(finalNote);
    setSale(s ?? null);
    setIntake(i ?? null);
    setLastFull(lf ?? null);
    setLoading(false);
  }, [appt.id, appt.client_email]);

  useEffect(() => { loadProgress(); }, [loadProgress]);
  useEffect(() => {
    setIntakeSentAt(appt.intake_last_sent_at ?? appt.intake_sent_at ?? null);
  }, [appt.intake_last_sent_at, appt.intake_sent_at]);

  useEffect(() => {
    window.addEventListener("rka_gfe_updated", loadProgress);
    window.addEventListener("rka_chart_note_updated", loadProgress);
    window.addEventListener("rka_appointment_updated", loadProgress);
    window.addEventListener("rka_demo_appointments_updated", loadProgress);
    return () => {
      window.removeEventListener("rka_gfe_updated", loadProgress);
      window.removeEventListener("rka_chart_note_updated", loadProgress);
      window.removeEventListener("rka_appointment_updated", loadProgress);
      window.removeEventListener("rka_demo_appointments_updated", loadProgress);
    };
  }, [loadProgress]);

  const activeStepRef = useRef<HTMLLIElement | null>(null);
  const prevActiveStep = useRef<string | null>(null);
  useEffect(() => {
    if (loading) return;
    if (prevActiveStep.current) {
      activeStepRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading]);

  if (["cancelled", "denied", "no_show"].includes(appt.status)) return null;

  // Step states
  const checkedIn = ["arrived", "completed"].includes(appt.status) || !!appt.checked_in_at;
  const consentsDone = !consentSummary || consentSummary.total === 0 || consentSummary.pendingRequired === 0;
  const gfeDone = !!gfe;
  const chartSigned = note && ["signed", "cosigned", "locked"].includes(note.status);
  const chartDraft = note && note.status === "draft";
  const chartDone = !!note;
  const photoCount = ((note?.photo_pre_paths?.length) ?? 0) + ((note?.photo_post_paths?.length) ?? 0);
  const photosDone = photoCount > 0;
  const paid = sale?.status === "paid";
  const visitIntakeDone = !!intake?.submitted_at;
  const fullAgeDays = lastFull?.submitted_at
    ? differenceInDays(new Date(), new Date(lastFull.submitted_at))
    : null;
  const annualOverdue = fullAgeDays !== null && fullAgeDays >= 365;
  const annualAssessmentDone = !!lastFull?.submitted_at && !annualOverdue;
  const intakeDone = visitIntakeDone || annualAssessmentDone;

  // Determine the active step (first incomplete required step)
  const order = ["checkin", "assessment", "consents", "gfe", "chart", "photos", "checkout"] as const;
  const completed: Record<typeof order[number], boolean> = {
    checkin: checkedIn,
    assessment: intakeDone,
    consents: consentsDone,
    gfe: gfeDone,
    chart: chartDone,
    photos: photosDone,
    checkout: paid,
  };
  const blocking: Record<typeof order[number], boolean> = {
    checkin: true, assessment: true, consents: true, gfe: false, chart: true, photos: false, checkout: true,
  };
  const activeStep = order.find(k => !completed[k]) ?? "checkout";

  const stateFor = (k: typeof order[number]): StepState =>
    completed[k] ? "done" : k === activeStep ? "current" : "pending";

  const handleCheckin = async () => {
    if (consentSummary && consentSummary.pendingRequired > 0) {
      toast.error(`${consentSummary.pendingRequired} required consent${consentSummary.pendingRequired === 1 ? "" : "s"} still unsigned.`);
      return;
    }
    setCheckingIn(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await apiQuery
        .from("appointments")
        .update({ status: "arrived", checked_in_at: nowIso })
        .eq("id", appt.id);
      if (error) { toast.error(error.message); return; }
      await apiQuery("appointment_audit_log").insert({
        appointment_id: appt.id, action: "checked_in",
        from_status: appt.status, to_status: "arrived" as any,
      });
      try {
        const local = JSON.parse(localStorage.getItem("rka_demo_appointments") || "[]");
        const updated = local.map((a: any) => (a.id === appt.id ? { ...a, status: "arrived", checked_in_at: nowIso } : a));
        localStorage.setItem("rka_demo_appointments", JSON.stringify(updated));
      } catch {}
      window.dispatchEvent(new Event("rka_demo_appointments_updated"));
      window.dispatchEvent(new Event("rka_appointment_updated"));
      window.dispatchEvent(new Event("rka_appointment_checkin"));
      try {
        await ApiClient.post("pos-create-or-get-sale", { body: { appointmentId: appt.id } });
      } catch (e) { console.error("pos draft create failed", e); }
      toast.success("Checked in");
      await onSendPostOp({ openPrintWindow: false });
      onReload();
      loadProgress();
    } finally {
      setCheckingIn(false);
    }
  };

  const progressPct = Math.round(
    (order.filter(k => completed[k]).length / order.length) * 100
  );

  const chartHref = chartDraft
    ? `/staff/clinical/notes/new?appointment=${appt.id}&draft=${note.id}`
    : note
      ? `/staff/clinical/notes/${note.id}?appointment=${appt.id}`
      : `/staff/clinical/notes/new?appointment=${appt.id}`;
  const gfeHref = gfe
    ? `/staff/clinical/gfe/${gfe.id}?appointment=${appt.id}`
    : `/staff/clinical/gfe/new?email=${encodeURIComponent(appt.client_email ?? "")}&first=${encodeURIComponent(appt.client_first_name ?? "")}&last=${encodeURIComponent(appt.client_last_name ?? "")}&appointment=${appt.id}`;

  const handleSendIntake = async () => {
    setSendingIntake(true);
    try {
      const { error } = await ApiClient.post("send-intake-links", {
        body: { appointmentId: appt.id },
      });

      if (error) { toast.error((error as any)?.message ?? (typeof error === "string" ? error : "Failed to send")); return; }
      toast.success("Assessment link sent");
      setIntakeSentAt(new Date().toISOString());
    } finally {
      setSendingIntake(false);
    }
  };

  const handleMarkIntakeInPerson = async (payload?: any) => {
    setMarkingIntakeInPerson(true);
    try {
      let staffName = user?.email ?? "Staff Member";
      if (user?.id) {
        const { data: sp } = await apiQuery("staff_profiles").select("full_name").eq("user_id", user.id).maybeSingle();
        if (sp?.full_name) staffName = sp.full_name;
      }
      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);
      const submissionObj = {
        appointment_id: appt.id,
        client_email: (appt.client_email ?? "").toLowerCase(),
        allergies: payload?.allergies ?? ["No known allergies"],
        current_medications: payload?.meds ?? ["None currently"],
        medical_history: payload?.history ?? ["None"],
        pregnancy_status: payload?.pregnancy ?? "Not applicable",
        submission_kind: "full",
        has_changes: false,
        hipaa_acknowledged: true,
        truthful_acknowledged: true,
        signature_full_name: payload?.sigName || `${staffName} — verified in person`,
        signature_date: today,
        submitted_at: nowIso,
      };

      const { data, error } = await apiQuery("client_intake_submissions").insert(submissionObj).select().maybeSingle();
      const newSub = data || { id: `local-intake-${Date.now()}`, ...submissionObj };

      try {
        const localList: any[] = JSON.parse(localStorage.getItem("rka_demo_intakes") || "[]");
        localList.unshift(newSub);
        localStorage.setItem("rka_demo_intakes", JSON.stringify(localList));
      } catch {}

      setIntake(newSub);
      setLastFull(newSub);

      try {
        await apiQuery("appointments").update({ intake_completed_at: nowIso }).eq("id", appt.id);
      } catch {}

      window.dispatchEvent(new Event("rka_intake_updated"));
      window.dispatchEvent(new Event("rka_appointment_updated"));

      toast.success(payload?.isVerbal ? "Verbal attestation saved & assessment completed!" : "Assessment verified & completed in clinic!");
      loadProgress();
      onReload();
    } catch (e: any) {
      toast.error(e?.message || "Failed to complete assessment");
    } finally {
      setMarkingIntakeInPerson(false);
      setOpenInPersonModal(false);
      setOpenVerbalModal(false);
    }
  };

  const annualLabel = lastFull?.submitted_at
    ? `Annual assessment ${annualOverdue ? "EXPIRED" : "on file"} (${format(new Date(lastFull.submitted_at), "MMM d, yyyy")})`
    : "No annual client assessment on file";
  const visitLabel = visitIntakeDone
    ? `This visit: ${intake?.submission_kind === "full" ? "full assessment" : "pre-visit check-in"} completed ${formatDistanceToNow(new Date(intake.submitted_at), { addSuffix: true })}`
    : intakeSentAt
      ? `This visit: link sent ${formatDistanceToNow(new Date(intakeSentAt), { addSuffix: true })} · awaiting patient`
      : "This visit: not sent yet";
  const assessmentSublabel = `${annualLabel} · ${visitLabel}`;

  const steps: { key: typeof order[number]; label: string; sublabel: string; icon: any; action: React.ReactNode }[] = [
    {
      key: "checkin",
      label: "Check in",
      sublabel: checkedIn ? "Patient arrived" : "Mark patient as arrived",
      icon: UserCheck,
      action: !checkedIn && !isNpPortal ? (
        <Button size="sm" className="rounded-full" disabled={checkingIn} onClick={handleCheckin}>
          {checkingIn ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
          Check in
        </Button>
      ) : null,
    },
    {
      key: "assessment",
      label: "Client assessment",
      sublabel: assessmentSublabel,
      icon: ClipboardList,
      action: intakeDone ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setViewingIntake(lastFull || intake)}>
            <Eye className="h-3.5 w-3.5 mr-1.5" />View assessment
          </Button>
          {intake && intake.id !== lastFull?.id && (
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setViewingIntake(intake)}>
              <Eye className="h-3.5 w-3.5 mr-1.5" />View check-in
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {visitIntakeDone && !annualAssessmentDone && (
            <span className="basis-full text-[11px] font-medium text-destructive">Annual client assessment still required — pre-visit check-in alone does not complete this step.</span>
          )}
          {visitIntakeDone && (
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setViewingIntake(intake)}>
              <Eye className="h-3.5 w-3.5 mr-1.5" />View check-in
            </Button>
          )}
          <Button size="sm" variant={intakeSentAt ? "outline" : "default"} className="rounded-full" disabled={sendingIntake} onClick={handleSendIntake}>
            {sendingIntake ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
            {intakeSentAt ? "Resend link" : "Send link"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full cursor-pointer"
            onClick={() => setOpenInPersonModal(true)}
            title="Open the in-clinic assessment modal on this device"
          >
            <ClipboardList className="h-3.5 w-3.5 mr-1.5" />Complete in person
          </Button>
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50"
            disabled={markingIntakeInPerson}
            onClick={() => setOpenVerbalModal(true)}
          >
            {markingIntakeInPerson ? "Saving…" : "or attest verbally for patient"}
          </button>
        </div>
      ),
    },
    {
      key: "consents",
      label: "Consents",
      sublabel: consentSummary && consentSummary.total > 0
        ? `${consentSummary.signed}/${consentSummary.total} signed${consentSummary.pendingRequired > 0 ? ` · ${consentSummary.pendingRequired} required pending` : ""}`
        : "None assigned",
      icon: FileText,
      action: !consentsDone ? (
        <span className="text-[11px] text-warning-soft-foreground">Use buttons below to send or sign in person</span>
      ) : null,
    },
    {
      key: "gfe",
      label: "GFE (NP)",
      sublabel: gfe ? `Active · ${differenceInDays(new Date(gfe.expires_at), new Date())}d left` : "Not on file (optional for non-Rx)",
      icon: gfe ? ShieldCheck : ShieldAlert,
      action: isNpPortal ? (
        <Button asChild size="sm" variant={gfe ? "outline" : "default"} className="rounded-full">
          <Link to={gfeHref}>
            {gfe ? "View GFE" : "Conduct GFE"}
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Link>
        </Button>
      ) : (
        <span className="text-[11px] text-muted-foreground italic font-normal">Read-only for Front Desk</span>
      ),
    },
    {
      key: "chart",
      label: "Chart note",
      sublabel: chartSigned ? "Signed" : chartDraft ? "Draft in progress" : "Not started",
      icon: ClipboardPlus,
      action: isNpPortal && !chartSigned ? (
        <Button asChild size="sm" className="rounded-full">
          <Link to={chartHref}>
            {chartDraft ? "Continue charting" : "Start charting"}
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Link>
        </Button>
      ) : !isNpPortal ? (
        <span className="text-[11px] text-muted-foreground italic font-normal">Read-only for Front Desk</span>
      ) : null,
    },
    {
      key: "photos",
      label: "Photos",
      sublabel: photosDone ? `${photoCount} attached` : "Recommended for injectables & laser",
      icon: Camera,
      action: isNpPortal && note && !photosDone ? (
        <Button asChild size="sm" variant="outline" className="rounded-full">
          <Link to={chartHref}>Add photos<ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
        </Button>
      ) : !isNpPortal ? (
        <span className="text-[11px] text-muted-foreground italic font-normal">Read-only for Front Desk</span>
      ) : null,
    },
    {
      key: "checkout",
      label: "Checkout",
      sublabel: paid ? "Paid" : sale ? `Sale ${sale.status}` : "Not started",
      icon: CreditCard,
      action: !paid ? (
        <Button asChild size="sm" className="rounded-full">
          <Link to={`/staff/checkout/${appt.id}`}>
            {sale ? "Resume checkout" : "Start checkout"}
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Link>
        </Button>
      ) : null,
    },
  ];

  const activeStepObj = steps.find(s => s.key === activeStep);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 mb-4">
      {isNpPortal && appt.client_email && (
        <div className="mb-4">
          <ClientClinicalAlerts clientEmail={appt.client_email} />
        </div>
      )}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="min-w-0">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Visit flow</h2>
          <p className="text-sm text-foreground mt-0.5 truncate">
            {paid ? "Visit complete" : `Next: ${activeStepObj?.label}`}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {!paid && activeStepObj?.action && (
            <div className="hidden sm:block">{activeStepObj.action}</div>
          )}
          <div
            className="text-right"
            title={
              paid
                ? "Visit complete"
                : `Remaining: ${order.filter(k => !completed[k]).map(k => ({ checkin: "Check in", assessment: "Assessment", consents: "Consents", gfe: "GFE", chart: "Chart note", photos: "Photos", checkout: "Checkout" } as const)[k]).join(" · ")}`
            }
          >
            <div className="text-[11px] text-muted-foreground">{progressPct}% complete</div>
            <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
              <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </div>



      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading visit progress…
        </div>
      ) : (
        <ol className="space-y-2">
          {steps.map((step, i) => {
            const state = stateFor(step.key);
            const Icon = step.icon;
            const ring =
              state === "done" ? "bg-success-soft text-success-soft-foreground ring-success/40" :
              state === "current" ? "bg-primary/10 text-primary ring-primary/30" :
              "bg-muted text-muted-foreground ring-border";
            return (
              <li
                key={step.key}
                ref={state === "current" ? activeStepRef : undefined}
                className={`flex flex-col gap-3 sm:flex-row sm:items-center rounded-xl px-3 py-2.5 border transition-colors ${
                  state === "current" ? "border-primary/40 bg-primary/5 ring-1 ring-primary/30" : "border-border bg-background/40"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ring-1 shrink-0 ${ring}`}>
                    {state === "done" ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-muted-foreground tabular-nums">{i + 1}.</span>
                      <span className="text-sm font-medium break-words">{step.label}</span>
                      {!blocking[step.key] && state !== "done" && (
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Optional</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground break-words sm:truncate">{step.sublabel}</div>
                  </div>
                </div>
                {step.action && <div className="w-full sm:w-auto sm:shrink-0 flex flex-wrap gap-2 sm:justify-end pl-11 sm:pl-0">{step.action}</div>}
                {state === "done" && !step.action && <Circle className="hidden" />}
              </li>

            );
          })}
        </ol>
      )}

      <IntakeViewerDialog open={!!viewingIntake} onOpenChange={(open) => !open && setViewingIntake(null)} intake={viewingIntake} />
      <InPersonAssessmentModal open={openInPersonModal} onOpenChange={setOpenInPersonModal} appt={appt} onSave={handleMarkIntakeInPerson} loading={markingIntakeInPerson} />
      <VerbalAttestationModal open={openVerbalModal} onOpenChange={setOpenVerbalModal} appt={appt} onSave={handleMarkIntakeInPerson} loading={markingIntakeInPerson} staffName={user?.email ?? "Staff Member"} />
    </section>
  );
}

function InPersonAssessmentModal({
  open,
  onOpenChange,
  appt,
  onSave,
  loading,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  appt: any;
  onSave: (payload: any) => void;
  loading: boolean;
}) {
  const [allergies, setAllergies] = useState<string[]>(["No known allergies"]);
  const [meds, setMeds] = useState<string[]>(["None currently"]);
  const [history, setHistory] = useState<string[]>(["None"]);
  const [pregnancy, setPregnancy] = useState("Not applicable");
  const [sigName, setSigName] = useState(`${appt?.client_first_name || ""} ${appt?.client_last_name || ""}`.trim() || "Patient");

  const toggleAllergy = (item: string) => {
    if (item === "No known allergies") {
      setAllergies(["No known allergies"]);
      return;
    }
    setAllergies((prev) => {
      const filtered = prev.filter((x) => x !== "No known allergies");
      return filtered.includes(item) ? filtered.filter((x) => x !== item) : [...filtered, item];
    });
  };

  const toggleMed = (item: string) => {
    if (item === "None currently") {
      setMeds(["None currently"]);
      return;
    }
    setMeds((prev) => {
      const filtered = prev.filter((x) => x !== "None currently");
      return filtered.includes(item) ? filtered.filter((x) => x !== item) : [...filtered, item];
    });
  };

  const toggleHistory = (item: string) => {
    if (item === "None") {
      setHistory(["None"]);
      return;
    }
    setHistory((prev) => {
      const filtered = prev.filter((x) => x !== "None");
      return filtered.includes(item) ? filtered.filter((x) => x !== item) : [...filtered, item];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ allergies, meds, history, pregnancy, sigName, isVerbal: false });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">In-Clinic Patient Assessment</DialogTitle>
          <DialogDescription className="text-xs">
            Review and complete medical history for <strong className="text-foreground">{appt?.client_first_name} {appt?.client_last_name}</strong> on this clinic device.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs mt-2">
          <div>
            <label className="font-semibold block mb-1">1. Allergies & Drug Sensitivities</label>
            <div className="flex flex-wrap gap-1.5">
              {["No known allergies", "Latex", "Lidocaine", "Penicillin", "Sulfa", "Iodine", "Hyaluronic acid"].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAllergy(a)}
                  className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition ${
                    allergies.includes(a)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  }`}
                >
                  {allergies.includes(a) ? "✓ " : ""}{a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1">2. Current Medications</label>
            <div className="flex flex-wrap gap-1.5">
              {["None currently", "Aspirin/NSAIDs", "Blood thinners", "Accutane", "GLP-1 (Ozempic/Wegovy)", "Steroids", "Hormones"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMed(m)}
                  className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition ${
                    meds.includes(m)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  }`}
                >
                  {meds.includes(m) ? "✓ " : ""}{m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1">3. Medical History & Conditions</label>
            <div className="flex flex-wrap gap-1.5">
              {["None", "Cold sores (HSV)", "Keloid scarring", "Autoimmune disease", "Diabetes", "Hypertension", "Active skin infection"].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => toggleHistory(h)}
                  className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition ${
                    history.includes(h)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  }`}
                >
                  {history.includes(h) ? "✓ " : ""}{h}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1">4. Pregnancy / Nursing Status</label>
            <select
              value={pregnancy}
              onChange={(e) => setPregnancy(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
            >
              <option value="Not applicable">Not applicable</option>
              <option value="Not pregnant">Not pregnant & not breastfeeding</option>
              <option value="Pregnant">Currently pregnant</option>
              <option value="Breastfeeding">Currently breastfeeding</option>
              <option value="Trying to conceive">Trying to conceive</option>
            </select>
          </div>

          <div>
            <label className="font-semibold block mb-1">Patient Signature / Full Name</label>
            <Input
              required
              value={sigName}
              onChange={(e) => setSigName(e.target.value)}
              placeholder="Full legal name"
              className="h-9 text-xs"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="gap-1.5">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save & Verify Assessment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VerbalAttestationModal({
  open,
  onOpenChange,
  appt,
  onSave,
  loading,
  staffName,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  appt: any;
  onSave: (payload: any) => void;
  loading: boolean;
  staffName: string;
}) {
  const [ackAllergies, setAckAllergies] = useState(true);
  const [ackMeds, setAckMeds] = useState(true);
  const [ackHistory, setAckHistory] = useState(true);
  const [ackPregnancy, setAckPregnancy] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      allergies: ["No known allergies (Verbal)"],
      meds: ["None reported (Verbal)"],
      history: ["Cleared verbally in clinic"],
      pregnancy: "Not applicable",
      sigName: `${staffName} — Verbal Attestation`,
      isVerbal: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">Verbal Clinical Health Attestation</DialogTitle>
          <DialogDescription className="text-xs">
            Attest that you have verbally reviewed medical history, medications, and contraindications with <strong className="text-foreground">{appt?.client_first_name} {appt?.client_last_name}</strong> in clinic.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs mt-2">
          <div className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-3">
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input type="checkbox" checked={ackAllergies} onChange={(e) => setAckAllergies(e.target.checked)} className="rounded" />
              <span>I verified allergies & drug sensitivities with patient</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input type="checkbox" checked={ackMeds} onChange={(e) => setAckMeds(e.target.checked)} className="rounded" />
              <span>I verified current medications & blood thinners</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input type="checkbox" checked={ackHistory} onChange={(e) => setAckHistory(e.target.checked)} className="rounded" />
              <span>I verified medical history & contraindications</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input type="checkbox" checked={ackPregnancy} onChange={(e) => setAckPregnancy(e.target.checked)} className="rounded" />
              <span>I verified pregnancy & breastfeeding status</span>
            </label>
          </div>

          <div className="text-[11px] text-muted-foreground bg-accent/30 p-2.5 rounded-lg border border-border">
            Attesting Staff: <strong className="text-foreground">{staffName}</strong> (Logged in user)
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || !ackAllergies || !ackMeds || !ackHistory || !ackPregnancy}
              className="gap-1.5"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Attest & Mark Complete
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  const display = Array.isArray(value)
    ? (value.length ? value.join(", ") : "—")
    : (value === true ? "Yes" : value === false ? "No" : (value ?? "—"));
  return (
    <div className="grid grid-cols-3 gap-3 py-1.5 border-b border-border/60 last:border-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="col-span-2 text-sm whitespace-pre-wrap">{String(display)}</div>
    </div>
  );
}

function IntakeViewerDialog({ open, onOpenChange, intake }: { open: boolean; onOpenChange: (b: boolean) => void; intake: any | null }) {
  if (!intake) return null;
  const isCheckin = intake.submission_kind === "checkin";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Client assessment {isCheckin ? "(pre-visit check-in)" : "(full health history)"}</DialogTitle>
          <DialogDescription>
            Submitted {intake.submitted_at ? format(new Date(intake.submitted_at), "PPP p") : "—"} · signed by {intake.signature_full_name ?? "—"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 text-sm">
          {isCheckin ? (
            <>
              <Row label="Anything changed?" value={intake.has_changes} />
              <Row label="Medication changes" value={intake.changes_meds} />
              <Row label="Allergy changes" value={intake.changes_allergies} />
              <Row label="History changes" value={intake.changes_history} />
              <Row label="Pregnancy status" value={intake.changes_pregnancy} />
              <Row label="Recent illness / event" value={intake.recent_illness_or_event} />
            </>
          ) : (
            <>
              <Row label="Allergies" value={[...(intake.allergies ?? []), intake.allergies_other].filter(Boolean)} />
              <Row label="Current medications" value={[...(intake.current_medications ?? []), intake.current_medications_other].filter(Boolean)} />
              <Row label="Medical history" value={[...(intake.medical_history ?? []), intake.medical_history_other].filter(Boolean)} />
              <Row label="Family history" value={intake.family_history} />
              <Row label="Social history" value={intake.social_history} />
              <Row label="Pregnancy status" value={intake.pregnancy_status} />
              <Row label="Skin type" value={intake.skin_type} />
              <Row label="Skin concerns" value={intake.skin_concerns} />
              <Row label="Sun exposure" value={intake.sun_exposure} />
              <Row label="Smoking" value={intake.smoking_status} />
              <Row label="Alcohol" value={intake.alcohol_use} />
              <Row label="Exercise" value={intake.exercise_frequency} />
              <Row label="Skincare products" value={intake.skincare_products} />
              <Row label="Prior cosmetic procedures" value={intake.prior_cosmetic_procedures} />
              <Row label="Primary care physician" value={intake.primary_care_physician} />
              <Row label="Emergency contact" value={[intake.emergency_contact_name, intake.emergency_contact_relation, intake.emergency_contact_phone].filter(Boolean).join(" · ")} />
              <Row label="Concerns" value={intake.concerns} />
              <Row label="Goals" value={intake.goals} />
              <Row label="Recent treatments" value={intake.recent_treatments} />
            </>
          )}
          <Row label="HIPAA acknowledged" value={intake.hipaa_acknowledged} />
          <Row label="Truthful acknowledged" value={intake.truthful_acknowledged} />
          <Row label="Signature" value={intake.signature_full_name} />
          <Row label="Signature date" value={intake.signature_date} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
