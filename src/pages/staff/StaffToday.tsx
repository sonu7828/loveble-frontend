import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Loader2, Clock, MapPin, UserCircle2, CreditCard, CheckCircle2, ChevronRight,
  MessageSquare, Plus, Check, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm";
import { fetchApptServiceNames, combinedServiceLabel } from "@/lib/apptServices";
import { SmsThread } from "@/components/messaging/SmsThread";
import { fetchIncompleteCharts } from "@/lib/incompleteCharts";
import { sendNoShowSms } from "@/lib/noShowSms";

type Appt = {
  id: string; status: string; start_at: string;
  client_first_name: string; client_last_name: string; client_email: string; client_phone: string | null;
  service_id: string; staff_id: string; location_id: string;
  checked_in_at: string | null;
  stripe_payment_method_id: string | null;
};

const CLINIC_TIME_ZONE = "America/Los_Angeles";

function clinicTodayBounds() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const clinicDate = `${get("year")}-${get("month")}-${get("day")}`;
  return {
    start: `${clinicDate}T00:00:00-07:00`,
    end: `${clinicDate}T23:59:59.999-07:00`,
  };
}

function formatClinicTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: CLINIC_TIME_ZONE,
  });
}

function formatClinicDate(date = new Date()) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: CLINIC_TIME_ZONE,
  });
}

const STATUS_PILL: Record<string, string> = {
  pending: "bg-warning-soft text-warning-soft-foreground",
  approved: "bg-success-soft text-success-soft-foreground",
  arrived: "bg-info-soft text-info-soft-foreground",
  completed: "bg-secondary text-muted-foreground",
  no_show: "bg-destructive-soft text-destructive-soft-foreground",
  cancelled: "bg-secondary text-muted-foreground",
  denied: "bg-destructive-soft text-destructive-soft-foreground",
};

export default function StaffToday() {
  const navigate = useNavigate();
  const { canSeeAll, staffId, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [meta, setMeta] = useState<Record<string, { service: string; staff: string; location: string }>>({});
  const [sales, setSales] = useState<Record<string, { id: string; status: string; total_cents: number }>>({});
  const [msgFor, setMsgFor] = useState<Appt | null>(null);
  const [incompleteCount, setIncompleteCount] = useState(0);
  const [intakePct, setIntakePct] = useState<number | null>(null);
  const [consentsMissing, setConsentsMissing] = useState(0);
  const [noCardCount, setNoCardCount] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const { start: dStart, end: dEnd } = clinicTodayBounds();
    let q = supabase.from("appointments").select("*")
      .gte("start_at", dStart).lte("start_at", dEnd)
      .not("status", "in", "(cancelled,denied)").order("start_at");
    if (!canSeeAll && staffId) q = q.eq("staff_id", staffId);
    const { data } = await q;
    const list = (data ?? []) as Appt[];
    setAppts(list);

    if (list.length) {
      const sids = [...new Set(list.map(a => a.service_id))];
      const stids = [...new Set(list.map(a => a.staff_id))];
      const lids = [...new Set(list.map(a => a.location_id))];
      const aids = list.map(a => a.id);
      const [{ data: svcs }, { data: stf }, { data: locs }, { data: sl }, apsvMap] = await Promise.all([
        supabase.from("services").select("id, name").in("id", sids),
        supabase.from("staff_profiles").select("id, full_name").in("id", stids),
        supabase.from("locations").select("id, name").in("id", lids),
        supabase.from("sales").select("id, status, total_cents, appointment_id, created_at")
          .in("appointment_id", aids)
          .order("created_at", { ascending: false }),
        fetchApptServiceNames(aids),
      ]);
      const svcMap = Object.fromEntries((svcs ?? []).map((s: any) => [s.id, s.name]));
      const stfMap = Object.fromEntries((stf ?? []).map((s: any) => [s.id, s.full_name]));
      const locMap = Object.fromEntries((locs ?? []).map((l: any) => [l.id, l.name]));
      const m: any = {};
      list.forEach(a => { m[a.id] = { service: combinedServiceLabel(a.id, apsvMap, svcMap[a.service_id] ?? "Service"), staff: stfMap[a.staff_id] ?? "—", location: locMap[a.location_id] ?? "—" }; });
      setMeta(m);
      const sm: any = {};
      // Prefer the most recent paid sale; otherwise the most recent draft/pending sale.
      // Previously this was last-write-wins per appointment, which let an older
      // draft overwrite a paid sale and triggered phantom "Resume checkout" CTAs.
      (sl ?? []).forEach((row: any) => {
        const existing = sm[row.appointment_id];
        if (!existing) { sm[row.appointment_id] = row; return; }
        if (existing.status === "paid") return; // keep paid winner
        if (row.status === "paid") { sm[row.appointment_id] = row; return; }
        // otherwise keep the newer one (already ordered desc)
      });
      setSales(sm);

      // KPI: today's revenue (paid sales only), today's missing-card count
      const revenue = (sl ?? []).reduce((sum: number, r: any) => sum + (r.status === "paid" ? (r.total_cents ?? 0) : 0), 0);
      setTodayRevenue(revenue);
      setNoCardCount(list.filter(a => !a.stripe_payment_method_id && !["completed", "no_show", "cancelled", "denied"].includes(a.status)).length);

      // KPI: intake completion % + consent missing count for today's appts
      const emails = [...new Set(list.map(a => (a.client_email ?? "").toLowerCase()).filter(Boolean))];
      const [{ data: intakes }, { count: missingConsentCount }] = await Promise.all([
        emails.length
          ? supabase.from("client_intake_submissions").select("client_email").in("client_email", emails)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("appointment_consents").select("appointment_id", { count: "exact", head: true })
          .in("appointment_id", aids).eq("signed", false),
      ]);
      const intakeEmails = new Set((intakes ?? []).map((r: any) => (r.client_email ?? "").toLowerCase()));
      setIntakePct(emails.length ? Math.round((emails.filter(e => intakeEmails.has(e)).length / emails.length) * 100) : null);
      setConsentsMissing(missingConsentCount ?? 0);
    } else {
      setTodayRevenue(0); setNoCardCount(0); setIntakePct(null); setConsentsMissing(0);
    }
    setLoading(false);
  }, [canSeeAll, staffId]);

  useEffect(() => { load(); }, [load]);

  // Count the same incomplete chart list that opens on Staff → Charts.
  useEffect(() => {
    (async () => {
      if (!staffId && !canSeeAll) return;
      try {
        const rows = await fetchIncompleteCharts({ canSeeAll, staffId });
        setIncompleteCount(rows.length);
      } catch (e) {
        console.error("[StaffToday] incomplete chart count failed:", e);
        setIncompleteCount(0);
      }
    })();
  }, [staffId, canSeeAll]);

  const checkIn = async (a: Appt): Promise<boolean> => {
    // Alert staff if no card on file — they should collect one before / at check-in
    if (!a.stripe_payment_method_id) {
      const ok = await confirmDialog({
        title: "No card on file",
        description: `${a.client_first_name} ${a.client_last_name} doesn't have a card on file. Please collect a card before performing any service (required for no-show / cancellation policy). Continue check-in anyway?`,
        confirmLabel: "Check in anyway",
        cancelLabel: "Cancel",
      });
      if (!ok) return false;
      toast.warning("Remember to add a card on file from the client chart.");
    }
    setWorking(a.id);
    const { error } = await supabase.from("appointments").update({
      status: "arrived",
      checked_in_at: new Date().toISOString(),
      checked_in_by: user?.id ?? null,
    }).eq("id", a.id);
    if (error) { toast.error(error.message); setWorking(null); return false; }
    await supabase.from("appointment_audit_log").insert({
      appointment_id: a.id, action: "checked_in",
      from_status: a.status as any, to_status: "arrived" as any, actor_user_id: user?.id ?? null,
    });
    toast.success(`${a.client_first_name} checked in`);
    setWorking(null);
    load();
    return true;
  };

  const markComplete = async (a: Appt) => {
    if (!(await confirmDialog({
      title: `Mark ${a.client_first_name}'s visit complete?`,
      description: "This sends the post-visit review email to the client.",
      confirmLabel: "Mark complete",
    }))) return;
    setWorking(a.id);
    const { data, error } = await supabase.functions.invoke("mark-appointment-complete", {
      body: { appointmentId: a.id },
    });
    setWorking(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Could not complete");
      return;
    }
    toast.success("Marked complete");
    load();
  };

  const markNoShow = async (a: Appt) => {
    const hasCard = !!a.stripe_payment_method_id;
    const ok = await confirmDialog({
      title: `Mark ${a.client_first_name} as no-show?`,
      description: hasCard
        ? "This will charge the $200 no-show fee to the card on file and mark the appointment no-show."
        : "No card on file — appointment will be marked no-show but no charge will be made.",
      confirmLabel: hasCard ? "Charge $200 & mark no-show" : "Mark no-show",
    });
    if (!ok) return;
    setWorking(a.id);
    try {
      if (hasCard) {
        const { data, error } = await supabase.functions.invoke("payments-charge-no-show", {
          body: { appointmentId: a.id, amountCents: 20000 },
        });
        if (error || (data as any)?.error) throw new Error((data as any)?.error ?? error?.message ?? "Charge failed");
        toast.success("Charged $200 — marked no-show");
      } else {
        const { error } = await supabase.from("appointments")
          .update({ status: "no_show", no_show_charged_at: new Date().toISOString() })
          .eq("id", a.id);
        if (error) throw new Error(error.message);
        toast.success("Marked no-show");
      }
      await supabase.from("appointment_audit_log").insert({
        appointment_id: a.id, action: "no_show" as any,
        from_status: a.status as any, to_status: "no_show" as any, actor_user_id: user?.id ?? null,
      });
      void sendNoShowSms(a.id, a.client_first_name);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setWorking(null);
    }
  };

  const groups = useMemo(() => {
    const arrived = appts.filter(a => a.status === "arrived");
    const upcoming = appts.filter(a => ["approved", "pending"].includes(a.status));
    const done = appts.filter(a => ["completed", "no_show"].includes(a.status));
    // "Next up" = first arrived (in the building), else next upcoming
    const nextUp = arrived[0] ?? upcoming[0] ?? null;
    return { arrived, upcoming, done, nextUp };
  }, [appts]);

  if (loading) return <div className="p-12 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading today…</div>;

  const Row = ({ a }: { a: Appt }) => {
    const s = sales[a.id];
    const paid = s?.status === "paid";
    const isDone = a.status === "completed" || a.status === "no_show";
    const noShowButton = !isDone ? (
      <Button
        size="sm"
        variant="destructive"
        className="rounded-full font-semibold shadow-sm"
        onClick={() => markNoShow(a)}
        disabled={working === a.id}
        title={a.stripe_payment_method_id ? "No call no show — charge $200" : "No call no show — no card on file"}
      >
        <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
        <span>No call no show</span>
      </Button>
    ) : null;
    return (
      <li className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-border bg-card">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link to={`/staff/appointments/${a.id}`} className="font-medium hover:underline">
              {a.client_first_name} {a.client_last_name}
            </Link>
            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_PILL[a.status] ?? "bg-secondary"}`}>{a.status}</span>
            {paid && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-success-soft text-success-soft-foreground">Paid</span>}
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatClinicTime(a.start_at)}</span>
            <span>{meta[a.id]?.service}</span>
            <span className="inline-flex items-center gap-1"><UserCircle2 className="h-3 w-3" />{meta[a.id]?.staff}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{meta[a.id]?.location}</span>
            {!a.stripe_payment_method_id && <span className="text-warning-soft-foreground">no card on file</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:flex-shrink-0 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => setMsgFor(a)}
            title="Message client"
          >
            <MessageSquare className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Message</span>
          </Button>
          {a.status !== "arrived" && !isDone && !paid && (
            <Button
              size="sm"
              className="rounded-full"
              disabled={working === a.id}
              onClick={async () => { const ok = await checkIn(a); if (ok) navigate(`/staff/checkout/${a.id}`); }}
              title="Check in and go straight to checkout"
            >
              <CheckCircle2 className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Check in &amp; check out</span>
              <span className="sm:hidden">In + out</span>
            </Button>
          )}
          {a.status !== "arrived" && !isDone && paid && (
            <Button size="sm" onClick={() => checkIn(a)} disabled={working === a.id} className="rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Check in</span>
            </Button>
          )}
          {a.status === "arrived" && !paid && !isDone && (
            <Button asChild size="sm" variant="default" className="rounded-full">
              <Link to={`/staff/checkout/${a.id}`}>
                <CreditCard className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Check out</span>
              </Link>
            </Button>
          )}
          {noShowButton}
          {!isDone && (
            paid ? (
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full"
                onClick={() => markComplete(a)}
                disabled={working === a.id}
                title="Mark complete & send review email"
              >
                <Check className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Complete</span>
              </Button>
            ) : (
              <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-warning-soft text-warning-soft-foreground border border-warning/30" title="Complete unlocks after payment is taken">
                Pay to complete
              </span>
            )
          )}
          <Button asChild size="sm" variant="ghost" className="rounded-full">
            <Link to={`/staff/appointments/${a.id}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </li>
    );
  };

  const Section = ({ title, items, empty }: { title: string; items: Appt[]; empty: string }) => (
    <section className="mb-8">
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{title} <span className="ml-1 text-foreground">({items.length})</span></h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{empty}</p>
      ) : (
        <ul className="space-y-2">{items.map(a => <Row key={a.id} a={a} />)}</ul>
      )}
    </section>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl font-medium mb-1">Today</h1>
          <p className="text-sm text-muted-foreground">{formatClinicDate()} · {appts.length} appointment{appts.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => navigate("/staff/messages")}>
            <MessageSquare className="h-4 w-4 mr-1.5" />Messages
          </Button>
          <Button className="rounded-full" onClick={() => navigate("/staff/appointments/new")}>
            <Plus className="h-4 w-4 mr-1.5" />New booking
          </Button>
        </div>
      </div>
      {appts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Kpi label="Appointments" value={appts.length} />
          <Kpi label="Revenue (paid)" value={`$${(todayRevenue / 100).toFixed(0)}`} />
          <Kpi label="Intake complete" value={intakePct === null ? "—" : `${intakePct}%`} tone={intakePct !== null && intakePct < 80 ? "warn" : undefined} />
          <Kpi label="Consents missing" value={consentsMissing} tone={consentsMissing > 0 ? "warn" : undefined} />
          <Kpi label="No card on file" value={noCardCount} tone={noCardCount > 0 ? "warn" : undefined} />
        </div>
      )}
      {incompleteCount > 0 && (
        <button
          type="button"
          onClick={() => navigate("/staff/clinical")}
          className="w-full mb-6 rounded-2xl border-2 border-warning/30 bg-warning-soft hover:bg-warning-soft transition p-4 flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-warning text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium text-warning-soft-foreground">
                {incompleteCount} incomplete chart{incompleteCount === 1 ? "" : "s"} need{incompleteCount === 1 ? "s" : ""} attention
              </div>
              <div className="text-xs text-warning-soft-foreground">
                Missing chart notes or unsigned consents from past appointments. Tap to review.
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-warning-soft-foreground shrink-0" />
        </button>
      )}
      {groups.nextUp && (() => {
        const a = groups.nextUp;
        const s = sales[a.id];
        const paid = s?.status === "paid";
        const inBuilding = a.status === "arrived";
        const isDone = a.status === "completed" || a.status === "no_show";
        return (
          <section className="mb-8 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/5 to-card p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-medium">
                {inBuilding ? "✦ In the building now" : "Next up"}
              </div>
              <div className="text-xs text-muted-foreground font-mono tabular-nums">
                {formatClinicTime(a.start_at)}
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <Link to={`/staff/appointments/${a.id}`} className="font-serif text-2xl hover:underline">
                  {a.client_first_name} {a.client_last_name}
                </Link>
                <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>{meta[a.id]?.service}</span>
                  <span className="inline-flex items-center gap-1"><UserCircle2 className="h-3 w-3" />{meta[a.id]?.staff}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{meta[a.id]?.location}</span>
                </div>
                {!a.stripe_payment_method_id && (
                  <div className="text-xs text-warning-soft-foreground mt-2">⚠ No card on file — collect one at check-in</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setMsgFor(a)}>
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />Message
                </Button>
                {!inBuilding && (
                  <Button size="sm" className="rounded-full" onClick={() => checkIn(a)} disabled={working === a.id}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Check in
                  </Button>
                )}
                {!paid && (
                  <Button asChild size="sm" className="rounded-full">
                    <Link to={`/staff/checkout/${a.id}`}>
                      <CreditCard className="h-3.5 w-3.5 mr-1.5" />Check out
                    </Link>
                  </Button>
                )}
                {!isDone && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-full font-semibold shadow-sm"
                    onClick={() => markNoShow(a)}
                    disabled={working === a.id}
                    title={a.stripe_payment_method_id ? "No call no show — charge $200" : "No call no show — no card on file"}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />No call no show
                  </Button>
                )}
                {paid && (
                  <Button size="sm" variant="secondary" className="rounded-full" onClick={() => markComplete(a)} disabled={working === a.id}>
                    <Check className="h-3.5 w-3.5 mr-1.5" />Complete
                  </Button>
                )}
              </div>
            </div>
          </section>
        );
      })()}
      <Section title="In the building" items={groups.arrived} empty="No one's checked in yet." />
      <Section title="Coming up" items={groups.upcoming} empty="No more appointments today." />
      <Section title="Done" items={groups.done} empty="Nothing finished yet." />

      <Sheet open={!!msgFor} onOpenChange={(o) => !o && setMsgFor(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          {msgFor && (
            <>
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle className="text-base">{msgFor.client_first_name} {msgFor.client_last_name}</SheetTitle>
                <SheetDescription className="text-xs">
                  {format(new Date(msgFor.start_at), "h:mm a")} · {meta[msgFor.id]?.service}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 min-h-0 overflow-hidden">
                <SmsThread
                  clientEmail={(msgFor.client_email ?? "").toLowerCase()}
                  viewerRole="staff"
                  appointmentId={msgFor.id}
                  compact
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "warn" }) {
  const toneClass = tone === "warn" ? "border-warning/30 bg-warning-soft" : "border-border bg-card";
  const valueClass = tone === "warn" ? "text-warning-soft-foreground" : "text-foreground";
  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-serif text-2xl mt-0.5 ${valueClass}`}>{value}</div>
    </div>
  );
}
