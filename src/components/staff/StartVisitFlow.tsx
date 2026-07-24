import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  onReload: () => void;
  onSendPostOp: (opts?: { openPrintWindow?: boolean; resend?: boolean }) => Promise<void>;
};

type StepState = "done" | "current" | "pending" | "skipped";

export function StartVisitFlow({ appt, consentSummary, gfe, onReload, onSendPostOp }: Props) {
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

  const loadProgress = useCallback(async () => {
    setLoading(true);
    const email = (appt.client_email ?? "").toLowerCase();
    const [{ data: n }, { data: s }, { data: i }, { data: lf }] = await Promise.all([
      supabase
        .from("clinical_notes")
        .select("id, status, photo_pre_paths, photo_post_paths")
        .eq("appointment_id", appt.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sales")
        .select("id, status")
        .eq("appointment_id", appt.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("client_intake_submissions")
        .select("*")
        .eq("appointment_id", appt.id)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("client_intake_submissions")
        .select("*")
        .eq("client_email", email)
        .eq("submission_kind", "full")
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setNote(n ?? null);
    setSale(s ?? null);
    setIntake(i ?? null);
    setLastFull(lf ?? null);
    setLoading(false);
  }, [appt.id, appt.client_email]);

  useEffect(() => { loadProgress(); }, [loadProgress]);
  useEffect(() => {
    setIntakeSentAt(appt.intake_last_sent_at ?? appt.intake_sent_at ?? null);
  }, [appt.intake_last_sent_at, appt.intake_sent_at]);

  if (["cancelled", "denied", "no_show"].includes(appt.status)) return null;

  // Step states
  const checkedIn = ["arrived", "completed"].includes(appt.status) || !!appt.checked_in_at;
  const consentsDone = !consentSummary || consentSummary.total === 0 || consentSummary.pendingRequired === 0;
  const gfeDone = !!gfe;
  const chartSigned = note && ["signed", "cosigned", "locked"].includes(note.status);
  const chartDraft = note && note.status === "draft";
  const photoCount = ((note?.photo_pre_paths?.length) ?? 0) + ((note?.photo_post_paths?.length) ?? 0);
  const photosDone = photoCount > 0;
  const paid = sale?.status === "paid";
  const visitIntakeDone = !!intake?.submitted_at;
  const fullAgeDays = lastFull?.submitted_at
    ? differenceInDays(new Date(), new Date(lastFull.submitted_at))
    : null;
  const annualOverdue = fullAgeDays === null || fullAgeDays >= 365;
  const annualAssessmentDone = !!lastFull?.submitted_at && !annualOverdue;
  const intakeDone = annualAssessmentDone && visitIntakeDone;

  // Determine the active step (first incomplete required step)
  const order = ["checkin", "assessment", "consents", "gfe", "chart", "photos", "checkout"] as const;
  const completed: Record<typeof order[number], boolean> = {
    checkin: checkedIn,
    assessment: intakeDone,
    consents: consentsDone,
    gfe: gfeDone,
    chart: !!chartSigned,
    photos: photosDone,
    checkout: paid,
  };
  // Consents/chart/checkout are blocking; assessment/gfe/photos are recommended
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
      const { error } = await supabase
        .from("appointments")
        .update({ status: "arrived", checked_in_at: new Date().toISOString() })
        .eq("id", appt.id);
      if (error) { toast.error(error.message); return; }
      await supabase.from("appointment_audit_log").insert({
        appointment_id: appt.id, action: "checked_in",
        from_status: appt.status, to_status: "arrived" as any,
      });
      try {
        await supabase.functions.invoke("pos-create-or-get-sale", { body: { appointmentId: appt.id } });
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
      ? `/staff/clinical/notes/${note.id}`
      : `/staff/clinical/notes/new?appointment=${appt.id}`;
  const gfeHref = gfe
    ? `/staff/clinical/gfe/${gfe.id}`
    : `/staff/clinical/gfe/new?email=${encodeURIComponent(appt.client_email ?? "")}&first=${encodeURIComponent(appt.client_first_name ?? "")}&last=${encodeURIComponent(appt.client_last_name ?? "")}&appointment=${appt.id}`;

  const handleSendIntake = async () => {
    setSendingIntake(true);
    try {
      const { error } = await supabase.functions.invoke("send-intake-links", {
        body: { appointmentId: appt.id },
      });

      if (error) { toast.error(error.message ?? "Failed to send"); return; }
      toast.success("Assessment link sent");
      setIntakeSentAt(new Date().toISOString());
    } finally {
      setSendingIntake(false);
    }
  };

  // Staff override: when a patient completes their health history verbally in-clinic,
  // record an attestation row so the assessment step unblocks. The signer is the staff
  // member (verified in person), not the patient — preserves provenance for HIPAA.
  const handleMarkIntakeInPerson = async () => {
    const { confirmDialog } = await import("@/components/ui/confirm");
    const ok = await confirmDialog({
      title: "Mark assessment complete in person?",
      description: "Use only when you have verbally reviewed the patient's health history, medications, allergies, and pregnancy status with them in clinic. You are attesting on their behalf.",
      confirmLabel: "I verified · mark complete",
    });
    if (!ok) return;
    setMarkingIntakeInPerson(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      let staffName = u.user?.email ?? "Staff";
      if (u.user?.id) {
        const { data: sp } = await supabase.from("staff_profiles").select("full_name").eq("user_id", u.user.id).maybeSingle();
        if (sp?.full_name) staffName = sp.full_name;
      }
      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);
      const { data, error } = await supabase.from("client_intake_submissions").insert({
        appointment_id: appt.id,
        client_email: (appt.client_email ?? "").toLowerCase(),
        allergies: [],
        current_medications: [],
        medical_history: [],
        submission_kind: "checkin",
        has_changes: false,
        hipaa_acknowledged: true,
        truthful_acknowledged: true,
        signature_full_name: `${staffName} — verified in person`,
        signature_date: today,
        submitted_at: nowIso,
      }).select().maybeSingle();
      if (error) { toast.error(error.message); return; }
      setIntake(data);
      toast.success("Assessment marked complete (in person)");
    } finally {
      setMarkingIntakeInPerson(false);
    }
  };

  // Annual rule: a "full" client assessment is valid for 365 days. Anything in
  // between is the short pre-visit check-in. Surface BOTH so staff can tell at
  // a glance whether the patient is current on the annual.
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
      action: !checkedIn ? (
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
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setViewingIntake(lastFull)}>
            <Eye className="h-3.5 w-3.5 mr-1.5" />View annual
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
            className="rounded-full"
            disabled={!appt.public_token}
            onClick={() => {
              if (!appt.public_token) { toast.error("Missing appointment token"); return; }
              window.open(`/intake/${appt.public_token}`, "_blank", "noopener");
            }}
            title="Open the patient's intake form on this device — hand it to them to complete"
          >
            <ClipboardList className="h-3.5 w-3.5 mr-1.5" />Complete in person
          </Button>
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50"
            disabled={markingIntakeInPerson}
            onClick={handleMarkIntakeInPerson}
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
      action: (
        <Button asChild size="sm" variant={gfe ? "outline" : "default"} className="rounded-full">
          <Link to={gfeHref}>
            {gfe ? "View GFE" : "Conduct GFE"}
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Link>
        </Button>
      ),
    },
    {
      key: "chart",
      label: "Chart note",
      sublabel: chartSigned ? "Signed" : chartDraft ? "Draft in progress" : "Not started",
      icon: ClipboardPlus,
      action: !chartSigned ? (
        <Button asChild size="sm" className="rounded-full">
          <Link to={chartHref}>
            {chartDraft ? "Continue charting" : "Start charting"}
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Link>
        </Button>
      ) : null,
    },
    {
      key: "photos",
      label: "Photos",
      sublabel: photosDone ? `${photoCount} attached` : "Recommended for injectables & laser",
      icon: Camera,
      action: note && !photosDone ? (
        <Button asChild size="sm" variant="outline" className="rounded-full">
          <Link to={chartHref}>Add photos<ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
        </Button>
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

  const activeStepRef = useRef<HTMLLIElement | null>(null);
  const prevActiveStep = useRef<string | null>(null);
  useEffect(() => {
    if (loading) return;
    // Only auto-scroll when the active step actually advances, not on initial mount
    if (prevActiveStep.current && prevActiveStep.current !== activeStep) {
      activeStepRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    prevActiveStep.current = activeStep;
  }, [activeStep, loading]);

  const activeStepObj = steps.find(s => s.key === activeStep);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 mb-4">
      {appt.client_email && (
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
    </section>
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
