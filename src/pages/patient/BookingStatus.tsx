import { useState, useEffect, useRef } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { apiQuery, authService, ApiClient } from "@/services/api";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { CheckCircle2, Clock, MapPin, XCircle, Loader2, CalendarIcon, FileText, FileCheck2, AlertCircle, PenLine, RotateCcw, Hourglass } from "lucide-react";

import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CalendarAndMap, RemindersPreview, PreVisitChecklist } from "@/components/BookingExtras";
import { SlotPicker } from "@/components/booking/SlotPicker";
import {
  CANCELLATION_NOTICE_HOURS, CLINIC_PHONE_DISPLAY, CLINIC_PHONE_TEL,
  CANCELLATION_POLICY_SHORT, CANCELLATION_POLICY_INVITE, WITHIN_WINDOW_WARNING,
} from "@/lib/cancellationPolicy";

const BookingStatus = () => {
  const { token } = useParams();
  const [params] = useSearchParams();
  const isNew = params.get("new") === "1";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const refetch = async () => {
    const tokenParam = params.get("token") || token;
    setLoading(true);
    setLoadError(null);

    if (!tokenParam) {
      setLoadError("Booking information unavailable.");
      setLoading(false);
      return;
    }

    try {
      let appt: any = null;
      try {
        const res = await ApiClient.get<any>(`/booking?token=${encodeURIComponent(tokenParam)}`);
        if (res.data) {
          appt = res.data.data || res.data;
        }
      } catch { }

      if (!appt) {
        // Token not found in system
        setLoading(false);
        setError("Booking token not found.");
        return;
      }

      if (appt) {
        const enriched = { ...appt };

        // Fallback location object
        const locName = enriched.locations?.name || enriched.location_name || "San Jose Clinic";
        const locAddr = enriched.locations?.address || enriched.location_address || "2100 Curtner Ave, Ste 1B";
        const locCity = enriched.locations?.city || enriched.location_city || "San Jose";
        const locState = enriched.locations?.state || "CA";
        const locZip = enriched.locations?.zip || "95124";
        enriched.locations = {
          name: locName,
          address: locAddr,
          city: locCity,
          state: locState,
          zip: locZip,
        };

        // Fallback provider object
        const staffName = enriched.staff_profiles?.full_name || enriched.staff_name || (enriched.staff_id === "any-available" ? "Any Available Provider" : "Girish");
        const staffTitle = enriched.staff_profiles?.title || enriched.staff_title || (enriched.staff_id === "any-available" ? "First available specialist" : "Provider");
        enriched.staff_profiles = {
          full_name: staffName,
          title: staffTitle,
        };

        // Fallback service object
        if (!enriched.services?.name && !enriched.services_list?.length) {
          const svcName = enriched.service_name || "Medical Consultation";
          enriched.services = { name: svcName };
        }
        if (!enriched.start_at) {
          enriched.start_at = new Date().toISOString();
        }

        setData(enriched);
        setLoading(false);
        return;
      }
      throw new Error("Appointment not found");
    } catch (e) {
      setLoadError((e as Error).message || "Could not load appointment");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refetch(); /* eslint-disable-next-line */ }, [token, params.get("token")]);

  // Live status updates: while the appointment is pending, refetch every 15s and
  // also subscribe to realtime changes so the page flips the moment staff approves/denies.
  const lastStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data?.id) return;
    lastStatusRef.current = data.status;
    let interval: number | undefined;
    if (data.status === "pending") {
      interval = window.setInterval(async () => {
        await refetch();
      }, 15000);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id, data?.status]);


  const canManage = data && ["pending", "approved", "confirmed"].includes(data.status);
  const canRebook = data && ["completed", "cancelled", "denied", "no_show"].includes(data.status);
  const hoursUntil = data ? (new Date(data.start_at).getTime() - Date.now()) / 3600000 : 0;
  const within48 = hoursUntil < 48;

  const rebookHref = data ? (() => {
    const params = new URLSearchParams({
      service: data.service_id ?? "",
      location: data.location_id ?? "",
      staff: data.staff_id ?? "",
      utm_source: "booking_status",
      utm_medium: "rebook_button",
    });
    return `/book?${params.toString()}`;
  })() : "/book";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-2xl">
        {loading && <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
        {!loading && (loadError || !data || data.error) && (
          <div className="text-center py-20">
            <p className="text-muted-foreground">
              {loadError ? `Could not load this appointment (${loadError}).` : "Appointment not found."}
            </p>
            {loadError && (
              <Button variant="outline" size="sm" className="mt-4 mr-2" onClick={refetch}>Try again</Button>
            )}
            <Link to="/book" className="text-primary text-sm mt-4 inline-block">Book a new appointment</Link>
          </div>
        )}
        {!loading && data && !data.error && (
          <div>
            {isNew && data.status === "pending" && (
              <div className="text-center mb-10 rounded-2xl border border-warning/30 bg-warning/5 p-6 sm:p-8">
                <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-warning/15 mb-4">
                  <Hourglass className="h-10 w-10 text-warning-foreground animate-pulse" />
                </div>
                <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl">Request received.</h1>
                <p className="text-muted-foreground mt-3 max-w-md mx-auto text-sm sm:text-base">
                  Your appointment request is <span className="text-foreground font-medium">awaiting approval</span> from our team.
                  We typically respond within a few hours during business hours.
                  This page updates automatically — feel free to keep it open, or check your email shortly.
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  Need it sooner? Call <a className="underline" href={CLINIC_PHONE_TEL}>{CLINIC_PHONE_DISPLAY}</a>.
                </p>
              </div>
            )}
            {isNew && (data.status === "approved" || data.status === "confirmed") && (
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-primary/10 mb-4">
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                </div>
                <h1 className="font-serif text-4xl md:text-5xl">You're booked.</h1>
                <p className="text-muted-foreground mt-3 max-w-md mx-auto">
                  Your appointment is <span className="text-foreground font-medium">confirmed</span>.
                  We'll send a reminder before your visit.
                </p>
              </div>
            )}
            {isNew && data.status === "denied" && (
              <div className="text-center mb-10 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 sm:p-8">
                <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-destructive/15 mb-4">
                  <XCircle className="h-10 w-10 text-destructive" />
                </div>
                <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl">Request declined.</h1>
                <p className="text-muted-foreground mt-3 max-w-md mx-auto text-sm sm:text-base">
                  We weren't able to confirm this appointment.
                  {data.denial_reason ? <> Reason: <span className="text-foreground">{data.denial_reason}</span></> : null}
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  Questions? Call <a className="underline" href={CLINIC_PHONE_TEL}>{CLINIC_PHONE_DISPLAY}</a> or book a different time.
                </p>
              </div>
            )}


            <div className="rounded-2xl bg-card border border-border p-6 sm:p-8 shadow-soft">
              <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                <h2 className="font-serif text-2xl">Appointment details</h2>
                <StatusBadge status={data.status} />
              </div>

              <dl className="space-y-4 text-sm">
                <Row label="Service">
                  {data.services_list && data.services_list.length > 0
                    ? data.services_list.map((s: any) => s.name).filter(Boolean).join(" + ")
                    : (data.services?.name || data.service_name || "Medical Consultation")}
                </Row>
                <Row label="Provider">
                  {data.staff_profiles?.full_name || data.staff_name || "Girish"}
                  <span className="text-muted-foreground"> · {data.staff_profiles?.title || data.staff_title || "Provider"}</span>
                </Row>
                <Row label="When">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    {data.start_at ? format(new Date(data.start_at), "EEEE, MMM d · h:mm a") : "Scheduled Time"}
                  </span>
                </Row>
                <Row label="Where">
                  <span className="flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary mt-0.5" />
                    <span>
                      {data.locations?.name || data.location_name || "San Jose Clinic"}
                      <br />
                      <span className="text-muted-foreground">
                        {[
                          data.locations?.address || data.location_address || "2100 Curtner Ave, Ste 1B",
                          data.locations?.city || data.location_city || "San Jose",
                          data.locations?.state || "CA",
                          data.locations?.zip || "95124"
                        ].filter(Boolean).join(", ")}
                      </span>
                    </span>
                  </span>
                </Row>
                <Row label="Name">{data.client_first_name || data.first_name} {data.client_last_name || data.last_name}</Row>
                {data.denial_reason && <Row label="Note">{data.denial_reason}</Row>}
              </dl>

              {canManage && (
                <div className="mt-8 pt-6 border-t border-border flex flex-wrap gap-2">
                  <Button variant="outline" className="rounded-full" disabled={within48} onClick={() => setShowReschedule(true)}>
                    <CalendarIcon className="h-4 w-4 mr-1.5" /> Reschedule
                  </Button>
                  <Button variant="ghost" className="rounded-full text-destructive hover:text-destructive" onClick={() => setShowCancel(true)}>
                    Cancel appointment
                  </Button>
                  {within48 && (
                    <p className="text-xs text-muted-foreground basis-full mt-1">
                      Within {CANCELLATION_NOTICE_HOURS} hours: please call{" "}
                      <a href={CLINIC_PHONE_TEL} className="underline">{CLINIC_PHONE_DISPLAY}</a> to reschedule.
                      {" "}{WITHIN_WINDOW_WARNING}
                    </p>
                  )}
                  {!within48 && (
                    <p className="text-[11px] text-muted-foreground basis-full mt-1">
                      {CANCELLATION_POLICY_SHORT}
                    </p>
                  )}
                </div>
              )}

              {canRebook && (
                <div className="mt-8 pt-6 border-t border-border">
                  <Button asChild className="rounded-full shadow-elegant">
                    <Link to={rebookHref}>
                      <RotateCcw className="h-4 w-4 mr-1.5" /> Book this again
                    </Link>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Same service, provider, and location — pre-filled. Just pick a new time.
                  </p>
                </div>
              )}

              {["pending", "approved"].includes(data.status) && data.locations && (
                <CalendarAndMap
                  title={`Radiantilyk Aesthetic — ${
                    data.services_list?.length
                      ? data.services_list.map((s: any) => s.name).filter(Boolean).join(" + ")
                      : data.services?.name ?? "Appointment"
                  }`}
                  startAt={data.start_at}
                  endAt={data.end_at}
                  locationLine={`${data.locations?.name} — ${data.locations?.address}, ${data.locations?.city}, ${data.locations?.state} ${data.locations?.zip}`}
                  details={`Provider: ${data.staff_profiles?.full_name ?? ""}\nManage: https://bookrka.com/booking/${token}\n${CANCELLATION_POLICY_INVITE}`}
                  mapsQuery={`${data.locations?.name}, ${data.locations?.address}, ${data.locations?.city}, ${data.locations?.state} ${data.locations?.zip}`}
                />
              )}
            </div>

            {["pending", "approved"].includes(data.status) && (
              <>
                <RemindersPreview />
                <PreVisitChecklist
                  serviceIds={(data.services_list?.length
                    ? data.services_list.map((s: any) => s.id)
                    : [data.service_id]).filter(Boolean)}
                  serviceNames={Object.fromEntries(
                    (data.services_list?.length
                      ? data.services_list
                      : [{ id: data.service_id, name: data.services?.name }]
                    ).filter((s: any) => s?.id).map((s: any) => [s.id, s.name])
                  )}
                />
              </>
            )}

            {/* Consent forms status — visible whenever any consents are assigned */}
            {data.consents && data.consents.length > 0 && (
              <ConsentsStatus
                consents={data.consents}
                summary={data.consents_summary}
                token={token!}
                canSign={["pending", "approved"].includes(data.status)}
              />
            )}

            <p className="text-xs text-muted-foreground text-center mt-6">
              Save this link or check your confirmation email to manage your appointment anytime.
            </p>

            {isNew && (
              <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center">
                <p className="text-sm">
                  <span className="font-medium">Save your details for next time.</span>
                  <br />
                  <span className="text-muted-foreground text-xs">Create an account to rebook in one click and view your consents.</span>
                </p>
                <Link to={`/account/auth?mode=signup`} className="inline-block mt-4 rounded-full bg-primary text-primary-foreground px-6 py-2 text-sm hover:opacity-90 transition">
                  Create account
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
      <SiteFooter />

      {data && (
        <>
          <PublicRescheduleDialog open={showReschedule} onOpenChange={setShowReschedule} appt={data} token={token!} onDone={refetch} />
          <PublicCancelDialog open={showCancel} onOpenChange={setShowCancel} token={token!} within48={within48} onDone={refetch} />
        </>
      )}
    </div>
  );
};

const PublicRescheduleDialog = ({ open, onOpenChange, appt, token, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; appt: any; token: string; onDone: () => void }) => {
  const [slot, setSlot] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) setSlot(""); }, [open]);

  // Use the full service set (multi-service appointments) so availability accounts for total duration.
  const apptServiceIds: string[] = (appt.services_list && appt.services_list.length > 0
    ? appt.services_list.map((s: any) => s.id)
    : [appt.service_id]).filter(Boolean);

  const submit = async () => {
    if (!slot) { toast.error("Pick a time"); return; }
    setBusy(true);
    const { data, error } = await ApiClient.post("public-reschedule-appointment", {
      body: { token, newStartAt: slot },
    });
    setBusy(false);
    if (error || data?.error) { toast.error(data?.error || error || "Could not reschedule"); return; }
    toast.success("Appointment rescheduled — confirmation email sent.");
    onOpenChange(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Reschedule appointment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Current: {format(new Date(appt.start_at), "EEE, MMM d · h:mm a")}</p>
          {/* Same calendar + slot-grid UX used by the public booking funnel. */}
          <SlotPicker
            serviceIds={apptServiceIds}
            staffId={appt.staff_id}
            locationId={appt.location_id}
            value={slot}
            onChange={setSlot}
            compact
            hideNextAvailable
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Back</Button>
          <Button onClick={submit} disabled={busy || !slot}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PublicCancelDialog = ({ open, onOpenChange, token, within48, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; token: string; within48: boolean; onDone: () => void }) => {
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const { data, error } = await ApiClient.post("public-cancel-appointment", { body: { token, reason } });
      if (error || data?.error) {
        toast.error(data?.error || error || "Could not cancel");
        return;
      }
      toast.success("Appointment cancelled.");
      onOpenChange(false);
      onDone();
      const { alertDialog } = await import("@/components/ui/confirm");
      await alertDialog({
        title: "Appointment cancelled",
        description: "You'll get a confirmation email shortly. We hope to see you again soon.",
        okLabel: "Done",
      });
      navigate("/");
    } catch (e: any) {
      toast.error(e?.message || "Could not cancel");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cancel appointment?</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          {within48 ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              {WITHIN_WINDOW_WARNING}
            </div>
          ) : (
            <p className="text-muted-foreground">You can cancel up to 48 hours before your appointment with no fee.</p>
          )}
          <div>
            <Label>Reason (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1.5" rows={3} placeholder="Let us know why" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Keep appointment</Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[100px_1fr] gap-4 items-baseline">
    <dt className="text-xs uppercase tracking-widest text-muted-foreground">{label}</dt>
    <dd>{children}</dd>
  </div>
);

interface ConsentItem {
  id: string;
  title: string;
  is_optional: boolean;
  is_universal: boolean;
  signed: boolean;
  procedures: string[];
}
interface ConsentSummary { total: number; signed: number; required_unsigned: number; optional_unsigned: number }

const ConsentsStatus = ({ consents, summary, token, canSign }: { consents: ConsentItem[]; summary: ConsentSummary; token: string; canSign: boolean }) => {
  const allSigned = summary.required_unsigned === 0 && summary.optional_unsigned === 0;
  const pendingRequired = summary.required_unsigned > 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-soft mt-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="font-serif text-xl">Consent forms</h2>
        </div>
        {allSigned ? (
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border bg-success/15 text-success border-success/30">
            <FileCheck2 className="h-3 w-3" />All signed
          </span>
        ) : pendingRequired ? (
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border bg-warning/15 text-warning-foreground border-warning/30">
            <AlertCircle className="h-3 w-3" />{summary.required_unsigned} awaiting signature
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border bg-muted text-muted-foreground border-border">
            {summary.optional_unsigned} optional pending
          </span>
        )}
      </div>

      {pendingRequired && canSign && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 sm:p-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm">
            Please sign the {summary.required_unsigned} required form{summary.required_unsigned > 1 ? "s" : ""} below before your visit.
          </p>
          <Button asChild size="sm" className="rounded-full self-start sm:self-auto">
            <Link to={`/consents/${token}`}><PenLine className="h-3.5 w-3.5 mr-1.5" />Sign now</Link>
          </Button>
        </div>
      )}

      <ul className="divide-y divide-border">
        {consents.map((c) => (
          <li key={c.id} className="py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                {c.signed
                  ? <FileCheck2 className="h-3.5 w-3.5 text-success shrink-0" />
                  : <AlertCircle className="h-3.5 w-3.5 text-warning-foreground shrink-0" />}
                <span className="truncate">{c.title}</span>
                {c.is_optional && (
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border rounded-full px-2 py-0.5">Optional</span>
                )}
              </div>
              {c.procedures.length > 0 && (
                <div className="text-[11px] text-muted-foreground mt-1 truncate">
                  {c.is_universal ? "Required for all procedures" : `For: ${c.procedures.join(", ")}`}
                </div>
              )}
            </div>
            <span className={`text-[11px] uppercase tracking-widest shrink-0 ${c.signed ? "text-success" : c.is_optional ? "text-muted-foreground" : "text-warning-foreground"}`}>
              {c.signed ? "Signed" : c.is_optional ? "Optional" : "Pending"}
            </span>
          </li>
        ))}
      </ul>

      {!allSigned && canSign && !pendingRequired && (
        <div className="mt-4">
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to={`/consents/${token}`}><PenLine className="h-3.5 w-3.5 mr-1.5" />Sign optional forms</Link>
          </Button>
        </div>
      )}
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    pending: { label: "Pending approval", cls: "bg-warning/15 text-warning-foreground border-warning/30", icon: Clock },
    approved: { label: "Confirmed", cls: "bg-success/15 text-success border-success/30", icon: CheckCircle2 },
    confirmed: { label: "Confirmed", cls: "bg-success/15 text-success border-success/30", icon: CheckCircle2 },
    denied: { label: "Declined", cls: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
    cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground border-border", icon: XCircle },
    completed: { label: "Completed", cls: "bg-success/15 text-success border-success/30", icon: CheckCircle2 },
    no_show: { label: "No-show", cls: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
  };
  const m = map[status] ?? map.pending;
  const Icon = m.icon;
  return <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border ${m.cls}`}><Icon className="h-3 w-3" />{m.label}</span>;
};

export default BookingStatus;
