import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { apiQuery, ApiClient } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { fetchApptServiceNames, combinedServiceLabel } from "@/lib/apptServices";
import { isTestPatient, purgeLocalTestPatients } from "@/lib/testPatientFilter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  Check, X, Loader2, MapPin, Clock, User as UserIcon, Mail, Phone,
  ChevronRight, Inbox as InboxIcon, Keyboard, History as HistoryIcon,
  CalendarCheck, Ban,
} from "lucide-react";
import { toast } from "sonner";

interface Appt {
  id: string;
  status: string;
  start_at: string;
  end_at: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  client_phone: string;
  client_notes: string | null;
  is_new_client: boolean | null;
  service_id: string;
  staff_id: string;
  location_id: string;
  created_at: string;
}

type TabType = "bookings" | "waitlist" | "history";

export default function StaffInbox() {
  const navigate = useNavigate();
  const { canSeeAll, staffId, isAdmin, isFrontDesk, isScheduler, isNP, isRNInjector, isMedicalDirector, isPrivacyOfficer } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get("tab");
  const activeTab: TabType =
    rawTab === "waitlist" ? "waitlist" :
    rawTab === "history" ? "history" : "bookings";

  // Role permission: Privacy Officer cannot manage
  const canManage = (isAdmin || isFrontDesk || isScheduler || isNP || isRNInjector || isMedicalDirector) && !isPrivacyOfficer;

  const [appts, setAppts] = useState<Appt[]>([]);
  const [activeWaitlist, setActiveWaitlist] = useState<any[]>([]);
  const [historyWaitlist, setHistoryWaitlist] = useState<any[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [meta, setMeta] = useState<Record<string, { service: string; staff: string; location: string }>>({});
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const [denyFor, setDenyFor] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const denyRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    purgeLocalTestPatients();
    let aq = apiQuery("appointments").select("*").eq("status", "pending").order("created_at", { ascending: true });
    if (!canSeeAll && staffId) aq = aq.eq("staff_id", staffId);

    const [a, wl, allSvc] = await Promise.all([
      aq,
      apiQuery("waitlist_entries").select("*").order("created_at", { ascending: false }),
      apiQuery("services").select("id, name"),
    ]);

    const fetchedAppts = ((a.data ?? []) as Appt[]).filter((x) => !isTestPatient(x));
    setAppts(fetchedAppts);

    const allWaitlist: any[] = wl.data ?? [];
    // Split by status: only "waiting" is active; everything else is history
    setActiveWaitlist(allWaitlist.filter(w => w.status === "waiting"));
    setHistoryWaitlist(allWaitlist.filter(w => w.status !== "waiting"));
    setAllServices(allSvc.data ?? []);

    const sids = [...new Set(fetchedAppts.map((x: any) => x.service_id).filter(Boolean))];
    const stids = [...new Set(fetchedAppts.map((x: any) => x.staff_id).filter(Boolean))];
    const lids = [...new Set(fetchedAppts.map((x: any) => x.location_id).filter(Boolean))];
    const apptIds = fetchedAppts.map((x: any) => x.id);

    const [s, st, l, apsvMap] = await Promise.all([
      sids.length ? apiQuery("services").select("id, name").in("id", sids) : Promise.resolve({ data: [] as any[] }),
      stids.length ? apiQuery("staff_profiles").select("id, full_name").in("id", stids) : Promise.resolve({ data: [] as any[] }),
      lids.length ? apiQuery("locations").select("id, name").in("id", lids) : Promise.resolve({ data: [] as any[] }),
      fetchApptServiceNames(apptIds),
    ]);

    const m: typeof meta = {};
    fetchedAppts.forEach((x: any) => {
      const fallback = s.data?.find((y: any) => y.id === x.service_id)?.name ?? "—";
      m[x.id] = {
        service: combinedServiceLabel(x.id, apsvMap, fallback),
        staff: st.data?.find((y: any) => y.id === x.staff_id)?.full_name ?? "Any provider",
        location: l.data?.find((y: any) => y.id === x.location_id)?.name ?? "Any location",
      };
    });
    setMeta(m);
    setLocations((l.data ?? []).map((x: any) => ({ id: x.id, name: x.name })));
    setLoading(false);
  }, [canSeeAll, staffId]);

  useEffect(() => { load(); }, [load]);

  const act = useCallback(async (id: string, action: "approve" | "deny", reason?: string) => {
    setBusyId(id);
    const targetStatus = action === "approve" ? "approved" : "denied";
    const updatePayload: any = { status: targetStatus };
    if (reason && action === "deny") updatePayload.cancellation_reason = reason;
    const { error } = await apiQuery("appointments").update(updatePayload).eq("id", id);
    setBusyId(null);
    if (error) { toast.error(error.message || "Could not update appointment"); return; }
    toast.success(action === "approve" ? "Appointment Approved!" : "Appointment Denied!");
    setDenyFor(null); setDenyReason("");
    setAppts(prev => prev.filter(x => x.id !== id));
    try {
      const local = JSON.parse(localStorage.getItem("rka_demo_appointments") || "[]");
      const updated = local.map((item: any) => (item.id === id ? { ...item, status: targetStatus } : item));
      localStorage.setItem("rka_demo_appointments", JSON.stringify(updated));
    } catch {}
    window.dispatchEvent(new Event("rka_demo_appointments_updated"));
    window.dispatchEvent(new Event("rka_appointment_updated"));
    if (action === "approve") window.dispatchEvent(new Event("rka_appointment_confirmed"));
    load();
  }, [load]);

  // Soft-remove: updates status → "removed" (record preserved for history)
  const removeWaitlistEntry = useCallback(async (id: string) => {
    setBusyId(id);
    const { error } = await apiQuery("waitlist_entries").update({ status: "removed" }).eq("id", id);
    setBusyId(null);
    if (error) { toast.error(error.message || "Could not update waitlist entry"); return; }
    toast.success("Removed from active waitlist — record kept in history.");
    load();
  }, [load]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeTab !== "bookings") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (appts.length === 0) return;
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, appts.length - 1)); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === "Enter") { const it: any = appts[focusIdx]; if (it) navigate(`/staff/appointments/${it.id}`); }
      else {
        const it = appts[focusIdx]; if (!it) return;
        if (e.key === "a") { e.preventDefault(); act(it.id, "approve"); }
        else if (e.key === "d") { e.preventDefault(); setDenyFor(it.id); setTimeout(() => denyRef.current?.focus(), 30); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [appts, focusIdx, act, navigate, activeTab]);

  const filteredAppts = locationFilter === "all" ? appts : appts.filter(a => a.location_id === locationFilter);

  const tabCls = (tab: TabType) =>
    `pb-2 text-sm font-medium border-b-2 transition ${
      activeTab === tab
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  const headerLabel =
    activeTab === "bookings" ? "Booking Requests" :
    activeTab === "waitlist" ? "Active Waitlist" : "Waitlist History";

  const headerCount =
    activeTab === "bookings"
      ? `${appts.length} Pending Booking${appts.length === 1 ? "" : "s"}`
      : activeTab === "waitlist"
      ? `${activeWaitlist.length} Active${activeWaitlist.length === 1 ? "" : ""}`
      : `${historyWaitlist.length} Historical Record${historyWaitlist.length === 1 ? "" : "s"}`;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-3xl">{headerLabel}</h1>
          {activeTab === "bookings" && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <Keyboard className="h-3 w-3" />
              <span><kbd className="px-1 rounded bg-secondary text-[10px]">j</kbd>/<kbd className="px-1 rounded bg-secondary text-[10px]">k</kbd> navigate · <kbd className="px-1 rounded bg-secondary text-[10px]">a</kbd> approve · <kbd className="px-1 rounded bg-secondary text-[10px]">d</kbd> deny · <kbd className="px-1 rounded bg-secondary text-[10px]">Enter</kbd> open</span>
            </p>
          )}
          {activeTab === "history" && (
            <p className="text-xs text-muted-foreground mt-1">
              Converted and removed waitlist records — kept permanently for audit.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-full px-3.5 py-1.5 text-xs font-semibold">
          <InboxIcon className="h-4 w-4" />
          <span>{headerCount}</span>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="flex gap-4 border-b border-border pb-px mb-6">
        <button onClick={() => setSearchParams({ tab: "bookings" })} className={tabCls("bookings")}>
          Booking Requests ({appts.length})
        </button>
        <button onClick={() => setSearchParams({ tab: "waitlist" })} className={tabCls("waitlist")}>
          Waitlist ({activeWaitlist.length})
        </button>
        <button onClick={() => setSearchParams({ tab: "history" })} className={tabCls("history")}>
          <span className="flex items-center gap-1.5">
            <HistoryIcon className="h-3.5 w-3.5" />
            History ({historyWaitlist.length})
          </span>
        </button>
      </div>

      {/* Location filter — bookings only */}
      {activeTab === "bookings" && locations.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <FilterPill active={locationFilter === "all"} onClick={() => setLocationFilter("all")}>All locations</FilterPill>
          {locations.map(l => (
            <FilterPill key={l.id} active={locationFilter === l.id} onClick={() => setLocationFilter(l.id)}>{l.name}</FilterPill>
          ))}
          {locationFilter !== "all" && (
            <FilterPill active={false} onClick={() => setLocationFilter("all")}>Clear ✕</FilterPill>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : activeTab === "bookings" ? (
        filteredAppts.length === 0 ? (
          <Empty text={locationFilter === "all" ? "No pending booking requests. Inbox zero ✨" : "No pending booking requests for this location."} />
        ) : (
          <ol className="space-y-3">
            {filteredAppts.map((a, i) => (
              <ApptRow
                key={a.id} a={a} m={meta[a.id]}
                focused={i === focusIdx}
                busy={busyId === a.id}
                denying={denyFor === a.id}
                denyReason={denyReason} setDenyReason={setDenyReason} denyRef={denyRef}
                onApprove={() => act(a.id, "approve")}
                onDenyClick={() => { setDenyFor(a.id); setTimeout(() => denyRef.current?.focus(), 30); }}
                onDenyConfirm={() => act(a.id, "deny", denyReason)}
                onDenyCancel={() => { setDenyFor(null); setDenyReason(""); }}
                onOpen={() => navigate(`/staff/appointments/${a.id}`)}
                onFocus={() => setFocusIdx(i)}
              />
            ))}
          </ol>
        )
      ) : activeTab === "waitlist" ? (
        <WaitlistTab
          entries={activeWaitlist}
          services={allServices}
          onRemove={removeWaitlistEntry}
          busyId={busyId}
          canManage={canManage}
        />
      ) : (
        <WaitlistHistoryTab
          entries={historyWaitlist}
          services={allServices}
        />
      )}
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────────────── */

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11px] border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:border-primary/40"}`}
    >
      {children}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">{text}</div>;
}

/* ── Booking Request Row ──────────────────────────────────────── */

function ApptRow(props: {
  a: Appt; m?: any; focused: boolean; busy: boolean; denying: boolean;
  denyReason: string; setDenyReason: (s: string) => void; denyRef: React.RefObject<HTMLInputElement>;
  onApprove: () => void; onDenyClick: () => void; onDenyConfirm: () => void; onDenyCancel: () => void;
  onOpen: () => void; onFocus: () => void;
}) {
  const { a, m, focused, busy, denying } = props;
  return (
    <li onMouseEnter={props.onFocus}>
      <div className={`rounded-2xl border bg-card p-5 transition ${focused ? "border-primary/60 shadow-sm" : "border-border hover:border-primary/30"}`}>
        <div className="flex items-start justify-between gap-4 cursor-pointer" onClick={props.onOpen}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-serif text-lg">
              {m?.service ?? "Service"}
              {a.is_new_client && <span className="text-[10px] text-primary border border-primary/40 rounded-full px-1.5 py-0.5">NEW</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(a.start_at), "EEE, MMM d · h:mm a")}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m?.location}</span>
              <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />{m?.staff}</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-sm border-t border-border pt-4 mt-4">
          <div>
            <div className="font-medium">{a.client_first_name} {a.client_last_name}</div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Mail className="h-3 w-3" /><a href={`mailto:${a.client_email}`} className="hover:text-foreground">{a.client_email}</a></div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Phone className="h-3 w-3" /><a href={`tel:${a.client_phone}`} className="hover:text-foreground">{a.client_phone}</a></div>
          </div>
          {a.client_notes && <div className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3">{a.client_notes}</div>}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          {!denying ? (
            <div className="flex gap-2">
              <Button onClick={props.onApprove} disabled={busy} size="sm" className="rounded-full">
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Approve <span className="opacity-50 text-[10px] ml-1">a</span></>}
              </Button>
              <Button onClick={props.onDenyClick} disabled={busy} size="sm" variant="outline" className="rounded-full">
                <X className="h-3.5 w-3.5 mr-1" />Deny <span className="opacity-50 text-[10px] ml-1">d</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="text-xs font-medium text-muted-foreground">Select or type a reason for declining:</div>
              <div className="flex flex-wrap gap-1.5">
                {["Provider unavailable", "Service prerequisite not met", "Schedule conflict", "Patient requested cancellation"].map((preset) => (
                  <button key={preset} type="button" onClick={() => props.setDenyReason(preset)}
                    className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-muted/30 hover:bg-primary/10 hover:border-primary/30 transition">
                    {preset}
                  </button>
                ))}
              </div>
              <input ref={props.denyRef} value={props.denyReason} onChange={(e) => props.setDenyReason(e.target.value)} placeholder="Decline reason (optional note to client)"
                className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 mt-1" />
              <div className="flex gap-2">
                <Button onClick={props.onDenyConfirm} disabled={busy} size="sm" variant="destructive" className="rounded-full">Confirm decline</Button>
                <Button onClick={props.onDenyCancel} disabled={busy} size="sm" variant="ghost" className="rounded-full">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/* ── Status badge helper ──────────────────────────────────────── */

function WaitlistStatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  if (s === "booked")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/40 bg-emerald-500/10 rounded-full px-2 py-0.5 uppercase">
        <CalendarCheck className="h-3 w-3" /> Booked
      </span>
    );
  if (s === "removed")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground border border-border bg-secondary/40 rounded-full px-2 py-0.5 uppercase">
        <Ban className="h-3 w-3" /> Removed
      </span>
    );
  return (
    <span className="text-[10px] text-primary border border-primary/40 rounded-full px-2 py-0.5 uppercase">
      {status}
    </span>
  );
}

/* ── Active Waitlist Tab ──────────────────────────────────────── */

function WaitlistTab(props: {
  entries: any[];
  services: any[];
  onRemove: (id: string) => void;
  busyId: string | null;
  canManage: boolean;
}) {
  const { entries, services, onRemove, busyId, canManage } = props;

  if (entries.length === 0) {
    return <Empty text="Active waitlist is empty. Converted or removed entries appear in the History tab." />;
  }

  return (
    <ol className="space-y-3">
      {entries.map((w) => {
        const svcName = services.find(s => s.id === w.service_id)?.name ?? "Any service";
        return (
          <li key={w.id}>
            <div className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/30">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-serif text-lg">
                    {svcName}
                    <WaitlistStatusBadge status={w.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Preferred: {w.preferred_days || "Any time"}</span>
                    {w.created_at && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Submitted: {format(new Date(w.created_at), "MMM d, yyyy h:mm a")}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm border-t border-border pt-4 mt-4">
                <div>
                  <div className="font-medium">{w.client_first_name} {w.client_last_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Mail className="h-3 w-3" /><a href={`mailto:${w.client_email}`} className="hover:text-foreground">{w.client_email}</a></div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Phone className="h-3 w-3" /><a href={`tel:${w.client_phone}`} className="hover:text-foreground">{w.client_phone}</a></div>
                </div>
                {w.notes && <div className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3">{w.notes}</div>}
              </div>

              <div className="mt-4 pt-4 border-t border-border flex gap-2">
                {canManage && (
                  <Button asChild size="sm" className="rounded-full shadow-xs">
                    <Link to={`/staff/appointments/new?firstName=${encodeURIComponent(w.client_first_name || "")}&lastName=${encodeURIComponent(w.client_last_name || "")}&email=${encodeURIComponent(w.client_email || "")}&phone=${encodeURIComponent(w.client_phone || "")}&serviceId=${w.service_id || ""}&notes=${encodeURIComponent(w.notes || "")}&waitlistId=${w.id}`}>
                      Book Appointment
                    </Link>
                  </Button>
                )}
                <Button
                  onClick={() => onRemove(w.id)}
                  disabled={busyId === w.id || !canManage}
                  size="sm"
                  variant="outline"
                  className="rounded-full border-destructive/30 hover:border-destructive hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                >
                  {busyId === w.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Remove from Waitlist
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Waitlist History Tab ─────────────────────────────────────── */

function WaitlistHistoryTab(props: { entries: any[]; services: any[] }) {
  const { entries, services } = props;

  if (entries.length === 0) {
    return <Empty text="No waitlist history yet. Converted and removed entries will appear here." />;
  }

  return (
    <ol className="space-y-3">
      {entries.map((w) => {
        const svcName = services.find(s => s.id === w.service_id)?.name ?? "Any service";
        return (
          <li key={w.id}>
            <div className="rounded-2xl border border-border bg-card/60 p-5 opacity-90">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-serif text-lg">
                    {svcName}
                    <WaitlistStatusBadge status={w.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Preferred: {w.preferred_days || "Any time"}</span>
                    {w.created_at && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Submitted: {format(new Date(w.created_at), "MMM d, yyyy h:mm a")}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm border-t border-border pt-4 mt-4">
                <div>
                  <div className="font-medium">{w.client_first_name} {w.client_last_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Mail className="h-3 w-3" /><a href={`mailto:${w.client_email}`} className="hover:text-foreground">{w.client_email}</a></div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Phone className="h-3 w-3" /><a href={`tel:${w.client_phone}`} className="hover:text-foreground">{w.client_phone}</a></div>
                </div>
                {w.notes && <div className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3">{w.notes}</div>}
              </div>

              {w.status === "booked" && (
                <div className="mt-3 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CalendarCheck className="h-3.5 w-3.5" />
                  This patient was successfully converted to an appointment.
                </div>
              )}
              {w.status === "removed" && (
                <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
                  <Ban className="h-3.5 w-3.5" />
                  This entry was removed from the active waitlist by staff.
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
