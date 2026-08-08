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
        const localList: any[] = JSON.parse(localStorage.getItem("rka_demo_appointments") || "[]");
        appt = localList.find((item: any) =>
          item.bookingToken === tokenParam ||
          item.booking_token === tokenParam ||
          item.token === tokenParam ||
          item.id === tokenParam
        );
      } catch { }

      // Query API/DB if not found in localStorage or to fetch latest appointment status
      try {
        const dbRes: any = await apiQuery("appointments")
          .select("*, locations(*), staff_profiles(*), services(*)")
          .or(`id.eq.${tokenParam},booking_token.eq.${tokenParam}`);
        
        if (dbRes && dbRes.data) {
          const dbItem = Array.isArray(dbRes.data) ? dbRes.data[0] : dbRes.data;
          if (dbItem) {
            appt = appt ? { ...appt, ...dbItem } : dbItem;
          }
        }
      } catch { }

      // Fallback to searching all DB appointments
      if (!appt) {
        try {
          const allRes: any = await apiQuery("appointments").select("*");
          if (allRes && allRes.data && Array.isArray(allRes.data)) {
            appt = allRes.data.find((item: any) =>
              item.bookingToken === tokenParam ||
              item.booking_token === tokenParam ||
              item.token === tokenParam ||
              item.id === tokenParam
            );
          }
        } catch { }
      }

      if (!appt) {
        setLoading(false);
        setLoadError("Booking token not found.");
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
        let rawStaffName = enriched.staff_profiles?.full_name || enriched.staff_name;
        if (!rawStaffName || rawStaffName === "Girish") {
          rawStaffName = enriched.staff_id === "any-available" ? "Any Available Provider" : "Nurse Practitioner";
        }
        let rawStaffTitle = enriched.staff_profiles?.title || enriched.staff_title;
        if (!rawStaffTitle || rawStaffTitle === "Provider") {
          rawStaffTitle = rawStaffName.includes("Nurse") ? "Nurse Practitioner" : "Nurse Practitioner";
        }
        enriched.staff_profiles = {
          full_name: rawStaffName,
          title: rawStaffTitle,
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
      <main className="flex-1 container mx-auto px-4 md:px-6 py-4 max-w-5xl space-y-3">
        {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
        {!loading && (loadError || !data || data.error) && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-xs">
              {loadError ? `Could not load this appointment (${loadError}).` : "Appointment not found."}
            </p>
            {loadError && (
              <Button variant="outline" size="sm" className="mt-3 text-xs h-7" onClick={refetch}>Try again</Button>
            )}
            <Link to="/book" className="text-primary text-xs mt-3 inline-block">Book a new appointment</Link>
          </div>
        )}
        {!loading && data && !data.error && (
          <div className="space-y-3">
            {/* Ultra-compact Horizontal Header Banner */}
            {isNew && data.status === "pending" && (
              <div className="rounded-xl border border-warning/30 bg-gradient-to-r from-warning/10 via-warning/5 to-card p-3 sm:p-4 flex items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-warning/20 shrink-0">
                    <Hourglass className="h-4 w-4 text-warning-foreground animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">Request received.</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/20 text-warning-foreground font-semibold uppercase tracking-wider">Awaiting Approval</span>
                    </div>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      Your request is awaiting approval from our team. This page updates automatically.
                    </p>
                  </div>
                </div>
                <a className="text-[11px] font-semibold underline text-foreground hover:text-primary shrink-0" href={CLINIC_PHONE_TEL}>
                  Call {CLINIC_PHONE_DISPLAY}
                </a>
              </div>
            )}
            {isNew && (data.status === "approved" || data.status === "confirmed") && (
              <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-card p-3 sm:p-4 flex items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/20 shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground text-sm">You're booked!</span>
                    <p className="text-muted-foreground text-[11px] mt-0.5">Your appointment is confirmed. Pre-visit reminder will be sent via email.</p>
                  </div>
                </div>
              </div>
            )}
            {isNew && data.status === "denied" && (
              <div className="rounded-xl border border-destructive/30 bg-gradient-to-r from-destructive/10 via-destructive/5 to-card p-3 sm:p-4 flex items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-destructive/20 shrink-0">
                    <XCircle className="h-4 w-4 text-destructive" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground text-sm">Request declined.</span>
                    <p className="text-muted-foreground text-[11px] mt-0.5">We could not confirm this appointment slot.</p>
                  </div>
                </div>
                <a className="text-[11px] font-semibold underline text-foreground hover:text-primary shrink-0" href={CLINIC_PHONE_TEL}>
                  Call {CLINIC_PHONE_DISPLAY}
                </a>
              </div>
            )}

            {/* Ultra-compact Horizontal Details Card */}
            <div className="rounded-2xl bg-card border border-border p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-lg font-medium">Appointment Details</h2>
                  <span className="text-[10px] text-muted-foreground font-mono">#{token}</span>
                </div>
                <StatusBadge status={data.status} />
              </div>

              {(() => {
                const clientFullName = [
                  data.client_first_name || data.patient?.firstName || data.first_name,
                  data.client_last_name || data.patient?.lastName || data.last_name
                ].filter(Boolean).join(" ") || data.client_name || data.clientName || data.name || data.patient?.name || "Valued Client";

                const totalCents = data.total_amount_cents ||
                  (Array.isArray(data.services_list) && data.services_list.length > 0
                    ? data.services_list.reduce((sum: number, s: any) => sum + (s.price_cents ?? s.priceCents ?? (s.price ? Math.round(s.price * 100) : 15000)), 0)
                    : data.services?.price_cents ?? data.services?.priceCents ?? 15000);

                const formattedTotal = `$${(totalCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                return (
                  <div className="space-y-3">
                    {/* High Density Single Horizontal Row Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                      {/* 1. Service */}
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">SERVICE</span>
                        <p className="font-semibold text-foreground leading-tight line-clamp-2" title={data.services_list?.map((s: any) => s.name).join(" + ")}>
                          {data.services_list && data.services_list.length > 0
                            ? data.services_list.map((s: any) => s.name).filter(Boolean).join(" + ")
                            : (data.services?.name || data.service_name || "Medical Consultation")}
                        </p>
                      </div>

                      {/* 2. Provider */}
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">PROVIDER</span>
                        <p className="font-semibold text-foreground leading-tight truncate">
                          {data.staff_profiles?.full_name && data.staff_profiles.full_name !== "Girish"
                            ? data.staff_profiles.full_name
                            : data.staff_name && data.staff_name !== "Girish"
                              ? data.staff_name
                              : "Nurse Practitioner"}
                        </p>
                      </div>

                      {/* 3. Date & Time */}
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">WHEN</span>
                        <p className="font-semibold text-foreground leading-tight flex items-center gap-1 truncate">
                          <Clock className="h-3 w-3 text-primary shrink-0" />
                          <span>{data.start_at ? format(new Date(data.start_at), "EEE, MMM d · h:mm a") : "Scheduled"}</span>
                        </p>
                      </div>

                      {/* 4. Location */}
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">WHERE</span>
                        <p className="font-semibold text-foreground leading-tight truncate">
                          {data.locations?.name || data.location_name || "San Jose Clinic"}
                        </p>
                      </div>

                      {/* 5. Patient Name */}
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">NAME</span>
                        <p className="font-semibold text-foreground leading-tight truncate">{clientFullName}</p>
                      </div>

                      {/* 6. Total Amount */}
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-primary">TOTAL AMOUNT</span>
                        <p className="text-base font-bold font-serif text-primary leading-tight">{formattedTotal}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {canManage && (
                <div className="pt-2.5 border-t border-border flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg px-3" disabled={within48} onClick={() => setShowReschedule(true)}>
                      <CalendarIcon className="h-3 w-3 mr-1" /> Reschedule
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setShowCancel(true)}>
                      Cancel appointment
                    </Button>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Free changes up to 48h before appointment.</span>
                </div>
              )}

              {canRebook && (
                <div className="pt-3 border-t border-border flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-xs font-medium text-foreground">Want to book this appointment again?</p>
                    <p className="text-[11px] text-muted-foreground">Same service, provider, and location — pre-filled for fast checkout.</p>
                  </div>
                  <Button asChild className="rounded-xl text-xs h-8 shadow-2xs">
                    <Link to={rebookHref}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Book this again
                    </Link>
                  </Button>
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
              <div className="mt-4 rounded-xl border border-border bg-card p-4 text-center text-xs">
                <p>
                  <span className="font-medium">Save your details for next time.</span>
                  <span className="text-muted-foreground ml-1">Create an account to rebook in one click.</span>
                </p>
                <Link to={`/account/auth?mode=signup`} className="inline-block mt-2 rounded-full bg-primary text-primary-foreground px-4 py-1 text-xs hover:opacity-90 transition">
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
