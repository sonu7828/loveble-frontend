import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { Loader2, History, ChevronRight, Filter, ShieldCheck, Activity, Download, AlertTriangle, ShieldAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { UnifiedActivityFeed } from "@/components/staff/UnifiedActivityFeed";

interface Entry {
  id: string;
  appointment_id: string;
  actor_user_id: string | null;
  action: string;
  from_status: string | null;
  to_status: string | null;
  notes: string | null;
  created_at: string;
}

interface PhiEntry {
  id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  resource_type: string;
  resource_id: string | null;
  client_email: string;
  action: string;
  route: string | null;
  break_glass_reason: string | null;
  created_at: string;
}

const PAGE = 50;

const ACTION_LABEL: Record<string, string> = {
  created_by_staff: "Created (staff)",
  created_by_client: "Created (client)",
  approved: "Approved",
  denied: "Denied",
  cancelled_by_staff: "Cancelled (staff)",
  cancelled_by_client: "Cancelled (client)",
  rescheduled_by_staff: "Rescheduled (staff)",
  rescheduled_by_client: "Rescheduled (client)",
  marked_completed: "Completed",
  marked_no_show: "Marked no-show",
  no_show_charged: "No-show charged",
  services_edited: "Services edited",
};

const ACTION_TONE: Record<string, string> = {
  approved: "bg-success-soft text-success-soft-foreground",
  marked_completed: "bg-success-soft text-success-soft-foreground",
  denied: "bg-destructive-soft text-destructive-soft-foreground",
  cancelled_by_staff: "bg-destructive-soft text-destructive-soft-foreground",
  cancelled_by_client: "bg-destructive-soft text-destructive-soft-foreground",
  marked_no_show: "bg-destructive-soft text-destructive-soft-foreground",
  no_show_charged: "bg-destructive-soft text-destructive-soft-foreground",
  rescheduled_by_staff: "bg-warning-soft text-warning-soft-foreground",
  rescheduled_by_client: "bg-warning-soft text-warning-soft-foreground",
};

const RESOURCE_LABEL: Record<string, string> = {
  chart_note: "Chart note",
  gfe: "GFE",
  consent: "Consent",
  clinical_photo: "Clinical photo",
  client_id: "ID document",
  client_profile: "Client chart",
  appointment: "Appointment",
};

export default function AdminAudit() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [appts, setAppts] = useState<Record<string, { client_first_name: string; client_last_name: string; start_at: string }>>({});
  const [actors, setActors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // PHI access tab
  const [phi, setPhi] = useState<PhiEntry[]>([]);
  const [phiLoading, setPhiLoading] = useState(false);
  const [phiPage, setPhiPage] = useState(0);
  const [phiHasMore, setPhiHasMore] = useState(false);
  const [phiClientFilter, setPhiClientFilter] = useState("");
  const [phiResourceFilter, setPhiResourceFilter] = useState<string>("");
  const [phiDays, setPhiDays] = useState<number>(30);
  const [phiAnomalies, setPhiAnomalies] = useState<{ highVolumeActors: { id: string; name: string; count: number }[]; afterHours: number }>({ highVolumeActors: [], afterHours: 0 });

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("appointment_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE);
      if (actionFilter) q = q.eq("action", actionFilter);
      const { data: ent } = await q;
      const list = (ent ?? []) as Entry[];
      setHasMore(list.length > PAGE);
      const sliced = list.slice(0, PAGE);
      setEntries(sliced);

      const apptIds = [...new Set(sliced.map((e) => e.appointment_id))];
      const actorIds = [...new Set(sliced.map((e) => e.actor_user_id).filter(Boolean) as string[])];
      const [{ data: aData }, { data: stData }] = await Promise.all([
        apptIds.length
          ? supabase.from("appointments").select("id, client_first_name, client_last_name, start_at").in("id", apptIds)
          : Promise.resolve({ data: [] as any[] }),
        actorIds.length
          ? supabase.from("staff_profiles").select("user_id, full_name").in("user_id", actorIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const am: typeof appts = {};
      for (const a of aData ?? []) am[(a as any).id] = a as any;
      setAppts(am);
      const sm: Record<string, string> = {};
      for (const s of (stData ?? []) as any[]) sm[s.user_id] = s.full_name;
      setActors(sm);
      setLoading(false);
    })();
  }, [isAdmin, actionFilter, page]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setPhiLoading(true);
      const since = subDays(new Date(), phiDays).toISOString();
      let q = supabase
        .from("phi_access_log")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .range(phiPage * PAGE, phiPage * PAGE + PAGE);
      if (phiClientFilter.trim()) q = q.ilike("client_email", `%${phiClientFilter.trim().toLowerCase()}%`);
      if (phiResourceFilter) q = q.eq("resource_type", phiResourceFilter);
      const { data } = await q;
      const list = (data ?? []) as PhiEntry[];
      setPhiHasMore(list.length > PAGE);
      setPhi(list.slice(0, PAGE));

      // Anomaly detection — sampled over the same window (capped 5000 for perf)
      const { data: window } = await supabase
        .from("phi_access_log")
        .select("actor_user_id, actor_name, client_email, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      const distinctByActor = new Map<string, { name: string; clients: Set<string> }>();
      let afterHours = 0;
      for (const r of (window ?? []) as any[]) {
        if (r.actor_user_id) {
          const cur = distinctByActor.get(r.actor_user_id) ?? { name: r.actor_name ?? "Staff", clients: new Set() };
          cur.clients.add((r.client_email ?? "").toLowerCase());
          distinctByActor.set(r.actor_user_id, cur);
        }
        const h = new Date(r.created_at).getHours();
        if (h < 7 || h >= 21) afterHours++;
      }
      const highVolumeActors = Array.from(distinctByActor.entries())
        .map(([id, v]) => ({ id, name: v.name, count: v.clients.size }))
        .filter((x) => x.count >= 50)
        .sort((a, b) => b.count - a.count);
      setPhiAnomalies({ highVolumeActors, afterHours });

      setPhiLoading(false);
    })();
  }, [isAdmin, phiPage, phiClientFilter, phiResourceFilter, phiDays]);

  const exportPhiCsv = async () => {
    const since = subDays(new Date(), phiDays).toISOString();
    let q = supabase
      .from("phi_access_log")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10000);
    if (phiClientFilter.trim()) q = q.ilike("client_email", `%${phiClientFilter.trim().toLowerCase()}%`);
    if (phiResourceFilter) q = q.eq("resource_type", phiResourceFilter);
    const { data } = await q;
    const rows = (data ?? []) as PhiEntry[];
    const header = ["timestamp", "actor_name", "actor_email", "action", "resource_type", "resource_id", "client_email", "route", "break_glass_reason"];
    const csv = [
      header.join(","),
      ...rows.map((r) => [
        r.created_at,
        csvCell(r.actor_name),
        csvCell(r.actor_email),
        r.action,
        r.resource_type,
        r.resource_id ?? "",
        csvCell(r.client_email),
        csvCell(r.route),
        csvCell(r.break_glass_reason),
      ].join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phi-access-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allActions = useMemo(() => Object.keys(ACTION_LABEL), []);
  const allResources = useMemo(() => Object.keys(RESOURCE_LABEL), []);

  if (authLoading) return <div className="flex justify-center py-32"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/staff/today" replace />;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Activity log</h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <History className="h-3 w-3" /> Appointment changes and PHI access — for HIPAA review
        </p>
      </header>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5"><Activity className="h-3 w-3" /> All activity</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="phi" className="gap-1.5"><ShieldCheck className="h-3 w-3" /> PHI access</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="pt-4">
          <UnifiedActivityFeed />
        </TabsContent>

        <TabsContent value="appointments" className="space-y-4 pt-4">
          <div className="flex items-center gap-2 justify-end">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
              className="rounded-full border border-border bg-background text-xs px-3 py-2"
            >
              <option value="">All actions</option>
              {allActions.map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
              No activity to show.
            </div>
          ) : (
            <ol className="space-y-2">
              {entries.map((e) => {
                const a = appts[e.appointment_id];
                const actorName = e.actor_user_id ? (actors[e.actor_user_id] ?? "Staff") : "Client / system";
                const tone = ACTION_TONE[e.action] ?? "bg-secondary text-muted-foreground";
                const label = ACTION_LABEL[e.action] ?? e.action;
                return (
                  <li key={e.id}>
                    <Link
                      to={`/staff/appointments/${e.appointment_id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition px-4 py-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${tone}`}>{label}</span>
                          {e.from_status && e.to_status && (
                            <span className="text-[10px] text-muted-foreground font-mono">{e.from_status} → {e.to_status}</span>
                          )}
                        </div>
                        <div className="text-sm mt-1 truncate">
                          {a ? (
                            <>
                              <span className="font-medium">{a.client_first_name} {a.client_last_name}</span>
                              <span className="text-muted-foreground"> · {format(new Date(a.start_at), "MMM d, h:mm a")}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground italic">Appointment removed</span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          by {actorName} · <span title={format(new Date(e.created_at), "PPpp")}>{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</span>
                          {e.notes && <span> · {e.notes}</span>}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-full border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-secondary/40">Previous</button>
            <span>Page {page + 1}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={!hasMore} className="rounded-full border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-secondary/40">Next</button>
          </div>
        </TabsContent>

        <TabsContent value="phi" className="space-y-4 pt-4">
          <div className="rounded-xl bg-secondary/40 border border-border p-3 text-xs text-muted-foreground flex items-start gap-2">
            <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>
              Every time a staff member opens a chart, GFE, consent, photo, or ID document, it is recorded here.
              Required by HIPAA §164.312(b). Export the CSV for your annual audit or breach-response file.
            </div>
          </div>

          {(phiAnomalies.highVolumeActors.length > 0 || phiAnomalies.afterHours > 0) && (
            <div className="rounded-xl border border-warning/40 bg-warning-soft p-3 space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider text-warning-soft-foreground flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-3 w-3" /> Anomaly review · last {phiDays}d
              </div>
              {phiAnomalies.highVolumeActors.map((a) => (
                <div key={a.id} className="text-xs">
                  <span className="font-medium">{a.name}</span>{" "}
                  <span className="text-muted-foreground">accessed {a.count} distinct patient records — review for break-glass justification.</span>
                </div>
              ))}
              {phiAnomalies.afterHours > 0 && (
                <div className="text-xs">
                  <span className="font-medium">{phiAnomalies.afterHours}</span>{" "}
                  <span className="text-muted-foreground">after-hours accesses (before 7am / after 9pm).</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Filter by patient email…"
              value={phiClientFilter}
              onChange={(e) => { setPhiClientFilter(e.target.value); setPhiPage(0); }}
              className="max-w-xs"
            />
            <select
              value={phiResourceFilter}
              onChange={(e) => { setPhiResourceFilter(e.target.value); setPhiPage(0); }}
              className="rounded-full border border-border bg-background text-xs px-3 py-2"
            >
              <option value="">All resource types</option>
              {allResources.map((r) => <option key={r} value={r}>{RESOURCE_LABEL[r]}</option>)}
            </select>
            <select
              value={phiDays}
              onChange={(e) => { setPhiDays(Number(e.target.value)); setPhiPage(0); }}
              className="rounded-full border border-border bg-background text-xs px-3 py-2"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last 365 days</option>
            </select>
            <button
              onClick={exportPhiCsv}
              className="ml-auto text-xs px-3 py-2 rounded-full border border-border hover:bg-secondary flex items-center gap-1.5"
            >
              <Download className="h-3 w-3" /> Export CSV
            </button>
          </div>

          {phiLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : phi.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
              No PHI access events.
            </div>
          ) : (
            <ol className="space-y-2">
              {phi.map((e) => {
                const isBreakGlass = !!e.break_glass_reason;
                const h = new Date(e.created_at).getHours();
                const afterHours = h < 7 || h >= 21;
                return (
                  <li
                    key={e.id}
                    className={`rounded-xl border px-4 py-3 ${
                      isBreakGlass ? "border-warning/50 bg-warning-soft" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {RESOURCE_LABEL[e.resource_type] ?? e.resource_type}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-success-soft text-success-soft-foreground">{e.action}</span>
                      {isBreakGlass && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning text-warning-foreground flex items-center gap-1">
                          <ShieldAlert className="h-2.5 w-2.5" /> Break-glass
                        </span>
                      )}
                      {afterHours && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">After-hours</span>
                      )}
                    </div>
                    <div className="text-sm mt-1 truncate">
                      <span className="font-medium">{e.actor_name ?? e.actor_email ?? "Unknown staff"}</span>
                      <span className="text-muted-foreground"> opened </span>
                      <Link
                        to={`/staff/clinical/clients/${encodeURIComponent(e.client_email)}`}
                        className="font-medium hover:underline"
                      >
                        {e.client_email}
                      </Link>
                    </div>
                    {isBreakGlass && (
                      <div className="text-[11px] mt-1 text-warning-soft-foreground italic">Reason: {e.break_glass_reason}</div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      <span title={format(new Date(e.created_at), "PPpp")}>{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</span>
                      {e.route && <span> · {e.route}</span>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <button onClick={() => setPhiPage((p) => Math.max(0, p - 1))} disabled={phiPage === 0} className="rounded-full border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-secondary/40">Previous</button>
            <span>Page {phiPage + 1}</span>
            <button onClick={() => setPhiPage((p) => p + 1)} disabled={!phiHasMore} className="rounded-full border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-secondary/40">Next</button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function csvCell(v: string | null | undefined): string {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

