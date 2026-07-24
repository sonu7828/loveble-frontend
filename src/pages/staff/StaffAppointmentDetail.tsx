import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { ArrowLeft, Loader2, Mail, Phone, MapPin, Clock, User as UserIcon, FileText, CreditCard, Send, History, CalendarClock, XCircle, Pencil, CheckCircle2, MailCheck, Download, RefreshCw, ClipboardPlus, ShieldCheck, ShieldAlert, ChevronDown, ChevronRight, MessageSquare, UserX } from "lucide-react";
import { differenceInDays } from "date-fns";
import { ConsentsPanel } from "@/components/ConsentsPanel";
import { SmsCard } from "@/components/staff/SmsCard";
import { ChargeNoShowDialog } from "@/components/ChargeNoShowDialog";
import { sendNoShowSms } from "@/lib/noShowSms";
import { AssignConsentsDialog } from "@/components/AssignConsentsDialog";
import { SignConsentsInPersonDialog } from "@/components/SignConsentsInPersonDialog";
import { RescheduleDialog } from "@/components/RescheduleDialog";
import { EditServicesDialog } from "@/components/EditServicesDialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { confirmDialog, alertDialog } from "@/components/ui/confirm";
import { withUndo } from "@/lib/undoToast";
import { StartVisitFlow } from "@/components/staff/StartVisitFlow";
import { BookingGapBanner } from "@/components/clinical/BookingGapBanner";

export default function StaffAppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appt, setAppt] = useState<any>(null);
  const [meta, setMeta] = useState<any>({});
  const [consentSummary, setConsentSummary] = useState<{ total: number; signed: number; pendingRequired: number; pendingOptional: number } | null>(null);
  const [consentsOpen, setConsentsOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [audit, setAudit] = useState<any[]>([]);
  const [emailLog, setEmailLog] = useState<any[]>([]);
  const [emailLogLoading, setEmailLogLoading] = useState(false);
  const [emailLogError, setEmailLogError] = useState<string | null>(null);
  const [emailLogOpen, setEmailLogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [signInPersonOpen, setSignInPersonOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [editServicesOpen, setEditServicesOpen] = useState(false);
  const [resendingConsents, setResendingConsents] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [gfe, setGfe] = useState<{ id: string; expires_at: string; signed_at: string } | null>(null);

  const resendConsents = async () => {
    if (!id) return;
    setResendingConsents(true);
    try {
      const { data: rows, error } = await supabase
        .from("appointment_consents")
        .select("consent_form_id, signed, consent_forms!inner(is_optional, is_active, version)")
        .eq("appointment_id", id);
      if (error) throw error;
      const unsignedRequired = (rows ?? []).filter(
        (r: any) => !r.signed && r.consent_forms?.is_active && !r.consent_forms?.is_optional,
      );
      if (unsignedRequired.length === 0) {
        toast.message("All required consent forms are already signed.");
        return;
      }
      const consentFormIds = unsignedRequired.map((r: any) => r.consent_form_id);
      const { data, error: invErr } = await supabase.functions.invoke("assign-consent-forms", {
        body: { appointmentId: id, consentFormIds },
      });
      if (invErr || data?.error) {
        toast.error(data?.error || invErr?.message || "Could not resend");
        return;
      }
      toast.success(`Resent signing link for ${consentFormIds.length} form${consentFormIds.length > 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not resend consent forms");
    } finally {
      setResendingConsents(false);
    }
  };

  const downloadConsentPdf = async () => {
    if (!appt) return;
    setDownloadingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-consent-pdf", {
        body: { appointmentId: appt.id },
      });
      if (error || data?.error || !data?.url) {
        toast.error(data?.error || error?.message || "Could not generate PDF");
        return;
      }
      void import("@/lib/phiAudit").then(({ logPhiAccess }) =>
        logPhiAccess({ resourceType: "consent", resourceId: appt.id, clientEmail: appt.client_email, action: "download" })
      );
      window.open(data.url, "_blank", "noopener,noreferrer");
      setAppt((prev: any) => (prev ? { ...prev, consent_pdf_url: data.url } : prev));
    } catch (e: any) {
      toast.error(e?.message || "Could not generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: a } = await supabase.from("appointments").select("*").eq("id", id).maybeSingle();
    if (!a) { setLoading(false); return; }
    setAppt(a);
    if (a.client_email) {
      const { data: gfeData } = await supabase
        .from("gfe_records")
        .select("id, expires_at, signed_at")
        .ilike("client_email", a.client_email)
        .gt("expires_at", new Date().toISOString())
        .order("signed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setGfe(gfeData ?? null);
    }
    const [{ data: s }, { data: st }, { data: l }, { data: hist }, { data: apsv }, { data: consentRows }] = await Promise.all([
      supabase.from("services").select("name, duration_minutes").eq("id", a.service_id).maybeSingle(),
      supabase.from("staff_profiles").select("full_name, title, email").eq("id", a.staff_id).maybeSingle(),
      supabase.from("locations").select("name, address, city, state").eq("id", a.location_id).maybeSingle(),
      supabase.from("appointment_audit_log").select("*").eq("appointment_id", id).order("created_at", { ascending: false }),
      supabase.from("appointment_services").select("display_order, duration_minutes, service_id").eq("appointment_id", id).order("display_order", { ascending: true }),
      supabase
        .from("appointment_consents")
        .select("consent_form_id, signed, consent_forms!inner(is_active, is_optional, version)")
        .eq("appointment_id", id),
    ]);

    let staffInfo = st;
    if (!staffInfo) {
      const unified = await fetchUnifiedStaffMembers();
      const found = unified.find(u => u.id === a.staff_id || u.full_name.toLowerCase().includes((a.staff_id || "").toLowerCase()));
      if (found) {
        staffInfo = { full_name: found.full_name, title: found.title, email: found.email };
      } else {
        staffInfo = { full_name: "Staff Provider", title: "Provider", email: null };
      }
    }

    const svcIds = [...new Set((apsv ?? []).map((r: any) => r.service_id))];
    const svcNameMap: Record<string, { name: string; duration_minutes: number }> = {};
    if (svcIds.length) {
      const { data: svcRows } = await supabase.from("services").select("id, name, duration_minutes").in("id", svcIds);
      (svcRows ?? []).forEach((sv: any) => { svcNameMap[sv.id] = { name: sv.name, duration_minutes: sv.duration_minutes }; });
    }
    const allServices = (apsv ?? []).map((r: any) => ({
      id: r.service_id,
      name: svcNameMap[r.service_id]?.name ?? "Service",
      duration_minutes: r.duration_minutes ?? svcNameMap[r.service_id]?.duration_minutes ?? 0,
    }));
    setMeta({ service: s, staff: staffInfo, location: l, allServices });
    setAudit(hist ?? []);

    // Cross-check with consent_signatures to avoid relying solely on the signed flag,
    // including prior valid signatures that auto-satisfy this appointment.
    const activeRows = (consentRows ?? []).filter((r: any) => r.consent_forms?.is_active);
    let signaturesByForm = new Set<string>();
    if (activeRows.length) {
      const { data: sigs } = await supabase
        .from("consent_signatures")
        .select("consent_form_id, decision, form_version, expires_at")
        .eq("client_email", String(a.client_email ?? "").toLowerCase())
        .in("consent_form_id", activeRows.map((r: any) => r.consent_form_id));
      const nowMs = Date.now();
      const versionByForm = new Map(activeRows.map((r: any) => [r.consent_form_id, r.consent_forms?.version]));
      signaturesByForm = new Set(
        (sigs ?? [])
          .filter((s: any) =>
            s.decision === "consent" &&
            s.form_version === versionByForm.get(s.consent_form_id) &&
            (!s.expires_at || new Date(s.expires_at).getTime() > nowMs)
          )
          .map((s: any) => s.consent_form_id),
      );
    }
    const total = activeRows.length;
    const signedCount = activeRows.filter((r: any) => r.signed || signaturesByForm.has((r as any).consent_form_id)).length;
    const pendingRequired = activeRows.filter((r: any) => !r.signed && !signaturesByForm.has((r as any).consent_form_id) && !r.consent_forms?.is_optional).length;
    const pendingOptional = activeRows.filter((r: any) => !r.signed && !signaturesByForm.has((r as any).consent_form_id) && r.consent_forms?.is_optional).length;
    setConsentSummary({ total, signed: signedCount, pendingRequired, pendingOptional });

    setLoading(false);
  }, [id]);

  // Lazy-loaded email audit log. Fetched only when the accordion opens — this
  // avoids a ~200-row email_send_log scan on every appointment page load.
  const [emailLogFetched, setEmailLogFetched] = useState(false);
  const loadEmailLog = useCallback(async () => {
    if (!appt) return;
    setEmailLogLoading(true);
    setEmailLogError(null);
    try {
      const recipientSeeds = [appt.client_email, meta?.staff?.email, user?.email].filter(Boolean) as string[];
      const recipients = Array.from(new Set(recipientSeeds.flatMap((e) => [e, String(e).toLowerCase()])));
      if (recipients.length === 0) {
        setEmailLog([]);
      } else {
        const since = new Date(new Date(appt.created_at).getTime() - 5 * 60_000).toISOString();
        const appointmentEmailTemplates = [
          "staff-booking-notification",
          "booking-received",
          "booking-approved",
          "booking-denied",
          "booking-cancelled",
          "consultation-approved",
          "consultation-denied",
          "consent-assignment",
          "consent-receipt",
          "post-visit-review",
          "staff-calendar-update",
          "staff-cancellation-notification",
        ];
        const { data: logs, error: logError } = await supabase
          .from("email_send_log")
          .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
          .in("recipient_email", recipients)
          .in("template_name", appointmentEmailTemplates)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(200);
        if (logError) throw logError;
        const latest = new Map<string, any>();
        for (const row of logs ?? []) {
          const key = row.message_id || row.id;
          if (!latest.has(key)) latest.set(key, row);
        }
        setEmailLog(Array.from(latest.values()));
      }
      setEmailLogFetched(true);
    } catch (error) {
      setEmailLog([]);
      setEmailLogError(error instanceof Error ? error.message : "Email notification log could not be loaded.");
    } finally {
      setEmailLogLoading(false);
    }
  }, [appt, meta?.staff?.email, user?.email]);

  useEffect(() => { load(); }, [load]);

  const resyncCal = async () => {
    const { data, error } = await supabase.functions.invoke("google-calendar-sync", { body: { appointmentId: id } });
    if (error || data?.error) { toast.error(data?.error || error?.message || "Calendar sync failed"); return; }
    if (data?.skipped) { toast.message("Calendar not connected"); return; }
    toast.success("Synced to Google Calendar");
    load();
  };

  const cancelAppt = async () => {
    if (!appt) return;
    if (!(await confirmDialog({
      title: "Cancel this appointment?",
      description: "No fee will be charged — staff cancellations waive the $200 no-show fee. The client and calendar will be notified.",
      confirmLabel: "Yes, cancel appointment",
      cancelLabel: "Keep it",
      destructive: true,
    }))) return;
    const prevStatus = appt.status;
    // Optimistic UI
    setAppt({ ...appt, status: "cancelled" });
    const t = toast.loading("Cancelling appointment…");
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appt.id);
      if (error) throw error;
      await supabase.from("appointment_audit_log").insert({
        appointment_id: appt.id,
        action: "cancelled_by_staff",
        from_status: prevStatus,
        to_status: "cancelled",
      });
      // Fire-and-forget side effects — never let them blank the page
      supabase.functions.invoke("google-calendar-sync", {
        body: { appointmentId: appt.id, action: "delete" },
      }).catch(() => {});
      supabase.functions.invoke("process-waitlist-fill", {
        body: { appointmentId: appt.id },
      }).catch(() => {});
      supabase.functions.invoke("notify-cancellation", {
        body: { appointmentId: appt.id, cancelledBy: "staff" },
      }).catch(() => {});
      if (appt.client_email) {
        supabase.functions.invoke("ghl-sync-contact", {
          body: { email: appt.client_email, tags: ["rkabook", "appointment-cancelled"] },
        }).catch(() => {});
      }
      toast.dismiss(t);
      toast.success("Appointment cancelled", {
        description: "The client has been notified and the calendar event removed.",
      });
      try { await load(); } catch { /* keep optimistic state, don't blank */ }
      await alertDialog({
        title: "Appointment cancelled",
        description: "The client has been notified and the calendar event was removed.",
        okLabel: "Done",
      });
    } catch (e: any) {
      // Revert optimistic UI and surface a real error — do NOT leave a blank page
      setAppt((a: any) => (a ? { ...a, status: prevStatus } : a));
      toast.dismiss(t);
      toast.error(e?.message || "Could not cancel appointment. Please try again.");
    }
  };

  const markNoShowWithoutCharge = async () => {
    if (!appt) return;
    const prevStatus = appt.status;
    setAppt({ ...appt, status: "no_show" });
    withUndo({
      label: "Marked no-show (no charge)",
      onUndo: () => setAppt((a: any) => a ? { ...a, status: prevStatus } : a),
      commit: async () => {
        const { error } = await supabase
          .from("appointments")
          .update({ status: "no_show" })
          .eq("id", appt.id);
        if (error) throw error;
        await supabase.from("appointment_audit_log").insert({
          appointment_id: appt.id,
          action: "marked_no_show",
          from_status: prevStatus,
          to_status: "no_show",
          actor_user_id: user?.id ?? null,
        });
        void sendNoShowSms(appt.id, appt.client_first_name);
        load();
      },
    });
  };

  const markNoShow = async () => {
    if (!appt) return;
    const hasCard = !!appt.stripe_payment_method_id;
    // Always open the dialog so staff can choose: charge $200, charge a custom
    // amount, or mark no-show without charging at all.
    if (hasCard) {
      setChargeOpen(true);
      return;
    }
    // No card → undoable mark without charging.
    await markNoShowWithoutCharge();
  };



  const sendPostOp = async ({ openPrintWindow, resend }: { openPrintWindow?: boolean; resend?: boolean } = {}) => {
    if (!appt) return;
    const t = toast.loading(resend ? "Resending post-op instructions…" : "Sending post-op instructions…");
    const { data: po, error: poErr } = await supabase.functions.invoke("send-post-op-instructions", { body: { appointmentId: appt.id, force: !!resend } });
    toast.dismiss(t);
    if (poErr || po?.error) {
      toast.error(po?.error || poErr?.message || "Could not send post-op email");
      return;
    }
    toast.success(resend ? "Post-op instructions resent to client" : "Post-op instructions emailed to client");
    if (openPrintWindow) {
      const blocks = (po?.blocks ?? []) as { name: string; title: string; body: string }[];
      const html = blocks.map((b) => `<h2 style="font-family:Georgia,serif;font-size:20px;margin:24px 0 8px">${b.name}</h2><pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:13px;line-height:1.55;margin:0">${b.body.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</pre>`).join("<hr style='margin:24px 0;border:0;border-top:1px solid #e5ddd4'/>");
      const w = window.open("", "_blank", "width=820,height=720");
      if (w) { w.document.write(`<!doctype html><html><head><title>Post-Op Instructions</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 20px;color:#2c241f}button{padding:8px 16px;background:#2c241f;color:#faf6f1;border:0;cursor:pointer;font:inherit;margin-bottom:16px}</style></head><body><button onclick="window.print()">Print</button>${html}</body></html>`); w.document.close(); }
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!appt) return <div className="p-8 text-center text-muted-foreground">Appointment not found.</div>;

  const statusColor =
    appt.status === "pending" ? "bg-warning-soft text-warning-soft-foreground" :
    appt.status === "approved" ? "bg-success-soft text-success-soft-foreground" :
    appt.status === "arrived" ? "bg-info-soft text-info-soft-foreground" :
    appt.status === "denied" ? "bg-destructive-soft text-destructive-soft-foreground" :
    appt.status === "no_show" ? "bg-destructive-soft text-destructive-soft-foreground" :
    "bg-secondary text-muted-foreground";

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-3 w-3" /> Back
      </button>

      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-serif text-3xl">
              {meta?.allServices && meta.allServices.length > 0
                ? meta.allServices.map((sv: any) => sv.name).join(" + ")
                : (meta?.service?.name ?? "Appointment")}
            </h1>
            <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full ${statusColor}`}>{appt.status}</span>
            {consentSummary && consentSummary.total > 0 && (
              consentSummary.pendingRequired > 0 ? (
                <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-warning-soft text-warning-soft-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />Awaiting {consentSummary.pendingRequired} consent{consentSummary.pendingRequired > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-success-soft text-success-soft-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />Consents {consentSummary.signed}/{consentSummary.total}
                </span>
              )
            )}
          </div>
          {meta?.allServices && meta.allServices.length > 1 && (
            <div className="text-xs text-muted-foreground mb-2">
              {meta.allServices.length} services · {meta.allServices.reduce((sum: number, sv: any) => sum + (sv.duration_minutes || 0), 0)} min total
            </div>
          )}
          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-5 gap-y-1">
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{format(new Date(appt.start_at), "EEE, MMM d, yyyy · h:mm a")}</span>
            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{meta?.location?.name}</span>
            <span className="flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5" />{meta?.staff?.full_name}</span>
          </div>
        </div>
      </div>

      {/* Safety gaps: GFE & unsigned consents */}
      {appt.client_email && (
        <div className="mb-4">
          <BookingGapBanner
            appointmentId={appt.id}
            clientEmail={appt.client_email}
            serviceCategory={meta?.service?.category ?? meta?.allServices?.[0]?.category ?? null}
          />
        </div>
      )}

      {/* Client */}
      <section className="rounded-2xl border border-border bg-card p-6 mb-4">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Client</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="text-lg font-medium">{appt.client_first_name} {appt.client_last_name}
              {appt.is_new_client && <span className="text-[10px] text-primary ml-2 uppercase tracking-wider">New</span>}
            </div>
            <a href={`mailto:${appt.client_email}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mt-1"><Mail className="h-3.5 w-3.5" />{appt.client_email}</a>
            <a href={`tel:${appt.client_phone}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mt-1"><Phone className="h-3.5 w-3.5" />{appt.client_phone}</a>
            {appt.client_dob && <div className="text-xs text-muted-foreground mt-1">DOB: {format(parseLocalDate(appt.client_dob) ?? new Date(appt.client_dob), "MMM d, yyyy")}</div>}
          </div>
          {appt.client_notes && (
            <div className="text-sm text-muted-foreground bg-secondary/40 rounded-lg p-3">{appt.client_notes}</div>
          )}
        </div>
      </section>

      <StartVisitFlow
        appt={appt}
        consentSummary={consentSummary}
        gfe={gfe}
        onReload={load}
        onSendPostOp={sendPostOp}
      />

      {/* Actions */}
      <section className="rounded-2xl border border-border bg-card p-6 mb-4">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Actions</h2>
        <div className="flex flex-wrap gap-2">
          {!["cancelled", "denied", "no_show", "completed"].includes(appt.status) && (
            <Button onClick={() => setEditServicesOpen(true)} size="sm" variant="outline" className="rounded-full">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit services
            </Button>
          )}
          {!["cancelled", "denied", "no_show", "completed"].includes(appt.status) && (
            <Button onClick={() => setRescheduleOpen(true)} size="sm" variant="outline" className="rounded-full">
              <CalendarClock className="h-3.5 w-3.5 mr-1.5" />Reschedule
            </Button>
          )}
          {!["cancelled", "denied", "no_show", "completed"].includes(appt.status) && (
            <Button onClick={cancelAppt} size="sm" variant="outline" className="rounded-full text-destructive hover:text-destructive">
              <XCircle className="h-3.5 w-3.5 mr-1.5" />Cancel appointment
            </Button>
          )}
          {["approved", "pending"].includes(appt.status) && (
            <Button
              size="sm"
              className="rounded-full"
              onClick={async () => {
                // Block check-in if mandatory consents are still missing
                if (consentSummary && consentSummary.pendingRequired > 0) {
                  toast.error(
                    `${consentSummary.pendingRequired} required consent${consentSummary.pendingRequired === 1 ? "" : "s"} still unsigned. Use "Sign in person" or "Resend consent forms" first.`,
                  );
                  return;
                }
                const { error } = await supabase
                  .from("appointments")
                  .update({ status: "arrived", checked_in_at: new Date().toISOString() })
                  .eq("id", appt.id);
                if (error) { toast.error(error.message); return; }
                await supabase.from("appointment_audit_log").insert({
                  appointment_id: appt.id, action: "checked_in",
                  from_status: appt.status, to_status: "arrived" as any,
                });
                // Pre-create draft sale so checkout opens with services loaded
                try {
                  await supabase.functions.invoke("pos-create-or-get-sale", {
                    body: { appointmentId: appt.id },
                  });
                } catch (e) { console.error("pos draft create failed", e); }
                toast.success("Checked in — checkout is ready");
                await sendPostOp({ openPrintWindow: true });
                load();
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Check in
            </Button>
          )}
          {["arrived", "completed"].includes(appt.status) && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={async () => { await sendPostOp({ openPrintWindow: false, resend: true }); load(); }}
            >
              <MailCheck className="h-3.5 w-3.5 mr-1.5" />Resend post-op
            </Button>
          )}
          {["approved", "pending", "arrived"].includes(appt.status) && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={async () => {
                if (!(await confirmDialog({
                  title: "Mark this appointment as completed?",
                  description: "A thank-you and review request will be emailed to the client.",
                  confirmLabel: "Mark completed",
                }))) return;
                const t = toast.loading("Completing…");
                const { data, error } = await supabase.functions.invoke("mark-appointment-complete", { body: { appointmentId: appt.id } });
                toast.dismiss(t);
                if (error || data?.error) { toast.error(data?.error || error?.message || "Could not complete"); return; }
                toast.success(data?.reviewSent ? "Completed — review email sent" : "Completed (no review URL set for this location)");
                load();
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Mark completed
            </Button>
          )}
          {!["cancelled", "denied"].includes(appt.status) && (
            <Button asChild size="sm" variant={gfe ? "outline" : "default"} className="rounded-full">
              {gfe ? (
                <Link to={`/staff/clinical/gfe/${gfe.id}`}>
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                  GFE active · {differenceInDays(new Date(gfe.expires_at), new Date())}d left
                </Link>
              ) : (
                <Link to={`/staff/clinical/gfe/new?email=${encodeURIComponent(appt.client_email ?? "")}&first=${encodeURIComponent(appt.client_first_name ?? "")}&last=${encodeURIComponent(appt.client_last_name ?? "")}&appointment=${appt.id}`}>
                  <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                  Conduct GFE (NP)
                </Link>
              )}
            </Button>
          )}
          {!["cancelled", "denied"].includes(appt.status) && (
            <Button asChild size="sm" className="rounded-full">
              <Link to={`/staff/clinical/notes/new?appointment=${appt.id}`}>
                <ClipboardPlus className="h-3.5 w-3.5 mr-1.5" />Start charting
              </Link>
            </Button>
          )}
          {!["cancelled", "denied"].includes(appt.status) && (
            <Button asChild size="sm" className="rounded-full">
              <Link to={`/staff/checkout/${appt.id}`}>
                <CreditCard className="h-3.5 w-3.5 mr-1.5" />Check out
              </Link>
            </Button>
          )}
          {!["cancelled", "denied", "completed", "no_show"].includes(appt.status) && (
            <Button size="sm" variant="destructive" className="rounded-full" onClick={markNoShow}>
              <UserX className="h-3.5 w-3.5 mr-1.5" />No call/no show
            </Button>
          )}
          {!appt.no_show_charge_id &&
            appt.status !== "pending" &&
            appt.status !== "denied" &&
            appt.status !== "cancelled" &&
            appt.status !== "completed" &&
            (appt.status === "no_show" || new Date(appt.start_at).getTime() < Date.now()) && (
              <Button onClick={() => setChargeOpen(true)} size="sm" variant="destructive" className="rounded-full">
                <CreditCard className="h-3.5 w-3.5 mr-1.5" />Charge no-show fee
              </Button>
            )}
          <Button onClick={() => setAssignOpen(true)} size="sm" variant="outline" className="rounded-full">
            <Send className="h-3.5 w-3.5 mr-1.5" />Send consent forms
          </Button>
          <Button onClick={resendConsents} size="sm" variant="outline" className="rounded-full" disabled={resendingConsents}>
            {resendingConsents ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Resend consent forms
          </Button>
          <Button onClick={() => setSignInPersonOpen(true)} size="sm" variant="outline" className="rounded-full">
            <FileText className="h-3.5 w-3.5 mr-1.5" />Sign in person
          </Button>
          <Button onClick={downloadConsentPdf} size="sm" variant="outline" className="rounded-full" disabled={downloadingPdf}>
            {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
            Download consent PDF
          </Button>
          {appt.status === "approved" && (
            <Button onClick={resyncCal} size="sm" variant="outline" className="rounded-full">
              {appt.google_event_owner_id ? "Re-sync to Google Calendar" : "Sync to Google Calendar"}
            </Button>
          )}
        </div>
        {appt.no_show_charge_id && (
          <p className="text-xs text-muted-foreground mt-3">
            $200 no-show fee charged{appt.no_show_charged_at ? ` on ${format(new Date(appt.no_show_charged_at), "MMM d, yyyy")}` : ""}.
          </p>
        )}
        {appt.stripe_payment_method_id ? (
          <p className="text-[11px] text-muted-foreground mt-2">Card on file.</p>
        ) : (
          <p className="text-[11px] text-muted-foreground mt-2">No card on file — manual entry will be required.</p>
        )}
      </section>

      {/* Consents — collapsed by default */}
      <section className="rounded-2xl border border-border bg-card mb-4">
        <button
          type="button"
          onClick={() => setConsentsOpen(o => !o)}
          className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-muted/30 rounded-2xl transition-colors"
        >
          <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileText className="h-3 w-3" />Consents
            {consentSummary && consentSummary.total > 0 && (
              <span className="text-[10px] normal-case tracking-normal text-muted-foreground/70">
                ({consentSummary.signed}/{consentSummary.total}{consentSummary.pendingRequired > 0 ? ` · ${consentSummary.pendingRequired} pending` : ""})
              </span>
            )}
          </span>
          {consentsOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {consentsOpen && (
          <div className="px-6 pb-5 pt-1">
            <ConsentsPanel appointmentId={appt.id} initialPdfUrl={appt.consent_pdf_url} />
          </div>
        )}
      </section>

      {/* SMS — collapsed by default */}
      <section className="rounded-2xl border border-border bg-card mb-4">
        <button
          type="button"
          onClick={() => setSmsOpen(o => !o)}
          className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-muted/30 rounded-2xl transition-colors"
        >
          <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <MessageSquare className="h-3 w-3" />SMS
          </span>
          {smsOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {smsOpen && (
          <div className="px-6 pb-5 pt-1">
            <SmsCard appointmentId={appt.id} optedIn={!!appt.sms_opt_in} phone={appt.client_phone} clientEmail={appt.client_email} />
          </div>
        )}
      </section>


      {/* Email notifications (admin only) — collapsed by default */}
      {user && (
        <section className="rounded-2xl border border-border bg-card mb-4">
          <button
            type="button"
            onClick={() => {
              setEmailLogOpen(o => !o);
              if (!emailLogOpen && !emailLogFetched && !emailLogLoading) loadEmailLog();
            }}
            className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-muted/30 rounded-2xl transition-colors"
          >
            <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MailCheck className="h-3 w-3" />Email notifications
              {!emailLogLoading && !emailLogError && (
                <span className="text-[10px] normal-case tracking-normal text-muted-foreground/70">
                  ({emailLog.length}{emailLog.length > 0 ? ` · ${emailLog.filter(e => e.status === "sent").length} sent` : ""})
                </span>
              )}
            </span>
            {emailLogOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {emailLogOpen && (
            <div className="px-6 pb-5 pt-1">
              {emailLogLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading…</div>
              ) : emailLogError ? (
                <p className="text-xs text-destructive">{emailLogError}</p>
              ) : emailLog.length === 0 ? (
                <p className="text-xs text-muted-foreground">No notification emails matched this booking yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {emailLog.map((e) => {
                    const badge =
                      e.status === "sent" ? "bg-success-soft text-success-soft-foreground" :
                      e.status === "pending" ? "bg-warning-soft text-warning-soft-foreground" :
                      e.status === "suppressed" ? "bg-warning-soft text-warning-soft-foreground" :
                      "bg-destructive-soft text-destructive-soft-foreground";
                    return (
                      <li key={e.id} className="flex items-center gap-2 py-1.5 text-xs">
                        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${badge}`}>{e.status}</span>
                        <span className="font-medium truncate flex-1">{e.template_name}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{format(new Date(e.created_at), "MMM d · h:mm a")}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {/* Audit */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2"><History className="h-3 w-3" />History</h2>
        {audit.length === 0 ? (
          <p className="text-xs text-muted-foreground">No history yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {audit.map((h) => (
              <li key={h.id} className="flex items-start gap-3 border-l-2 border-border pl-3">
                <div className="flex-1">
                  <div className="text-sm capitalize">{h.action.replace(/_/g, " ")}{h.from_status && h.to_status ? `: ${h.from_status} → ${h.to_status}` : ""}</div>
                  {h.notes && <div className="text-xs text-muted-foreground mt-0.5">{h.notes}</div>}
                </div>
                <div className="text-[11px] text-muted-foreground">{format(new Date(h.created_at), "MMM d · h:mm a")}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ChargeNoShowDialog
        open={chargeOpen} onOpenChange={setChargeOpen}
        appointmentId={appt.id}
        clientName={`${appt.client_first_name} ${appt.client_last_name}`}
        hasCardOnFile={!!appt.stripe_payment_method_id}
        onCharged={() => { void sendNoShowSms(appt.id, appt.client_first_name); load(); }}
        onSkipCharge={markNoShowWithoutCharge}
      />
      <AssignConsentsDialog
        open={assignOpen} onOpenChange={setAssignOpen}
        appointmentId={appt.id} clientEmail={appt.client_email}
        onAssigned={load}
      />
      <SignConsentsInPersonDialog
        open={signInPersonOpen} onOpenChange={setSignInPersonOpen}
        appointmentId={appt.id}
        onSigned={load}
      />
      <RescheduleDialog
        open={rescheduleOpen} onOpenChange={setRescheduleOpen}
        appointmentId={appt.id}
        serviceId={appt.service_id}
        serviceIds={meta?.allServices?.length ? meta.allServices.map((s: any) => s.id) : [appt.service_id]}
        staffId={appt.staff_id}
        locationId={appt.location_id}
        currentStartAt={appt.start_at}
        onRescheduled={load}
      />
      <EditServicesDialog
        open={editServicesOpen} onOpenChange={setEditServicesOpen}
        appointmentId={appt.id}
        staffId={appt.staff_id}
        locationId={appt.location_id}
        startAt={appt.start_at}
        currentServiceId={appt.service_id}
        onSaved={load}
      />
    </div>
  );
}
