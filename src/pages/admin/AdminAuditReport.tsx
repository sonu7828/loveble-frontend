import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";
import {
  Loader2, Download, FileText, ShieldCheck, Activity, Users,
  Calendar as CalendarIcon, Printer, AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Category = "phi" | "clinical" | "consent_signed" | "consent_email" | "appointment";

type UnifiedEvent = {
  id: string;
  when: string;
  category: Category;
  actor: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  client_email: string | null;
  detail: string;
};

const CATEGORY_LABEL: Record<Category, string> = {
  phi: "PHI Access",
  clinical: "Clinical Mutation",
  consent_signed: "Consent Signed",
  consent_email: "Consent Sent",
  appointment: "Appointment Change",
};

const CATEGORY_COLOR: Record<Category, string> = {
  phi: "bg-blue-100 text-blue-800",
  clinical: "bg-purple-100 text-purple-800",
  consent_signed: "bg-emerald-100 text-emerald-800",
  consent_email: "bg-amber-100 text-amber-800",
  appointment: "bg-slate-100 text-slate-800",
};

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadBlob = (content: string, filename: string, mime = "text/csv;charset=utf-8;") => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function AdminAuditReport() {
  const { isAdmin, loading: authLoading } = useAuth();

  const [from, setFrom] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [enabled, setEnabled] = useState<Record<Category, boolean>>({
    phi: true, clinical: true, consent_signed: true, consent_email: true, appointment: true,
  });
  const [clientFilter, setClientFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  const fromIso = useMemo(() => startOfDay(new Date(from + "T00:00:00")).toISOString(), [from]);
  const toIso = useMemo(() => endOfDay(new Date(to + "T00:00:00")).toISOString(), [to]);

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setPage(0);

    const clientQ = clientFilter.trim().toLowerCase();
    const results: UnifiedEvent[] = [];
    const actorIds = new Set<string>();

    // Fetch each category in parallel
    const promises: Promise<void>[] = [];

    if (enabled.phi) {
      promises.push((async () => {
        let q = supabase.from("phi_access_log").select("*")
          .gte("created_at", fromIso).lte("created_at", toIso)
          .order("created_at", { ascending: false }).limit(5000);
        if (clientQ) q = q.ilike("client_email", `%${clientQ}%`);
        const { data } = await q;
        for (const r of (data ?? []) as any[]) {
          if (r.actor_user_id) actorIds.add(r.actor_user_id);
          results.push({
            id: `phi_${r.id}`, when: r.created_at, category: "phi",
            actor: r.actor_name ?? r.actor_email ?? "Unknown",
            actor_id: r.actor_user_id,
            action: r.action ?? "view",
            resource_type: r.resource_type,
            resource_id: r.resource_id,
            client_email: r.client_email,
            detail: [r.route, r.break_glass_reason && `break-glass: ${r.break_glass_reason}`].filter(Boolean).join(" · "),
          });
        }
      })());
    }

    if (enabled.clinical) {
      promises.push((async () => {
        const { data } = await supabase.from("clinical_audit_log").select("*")
          .gte("created_at", fromIso).lte("created_at", toIso)
          .order("created_at", { ascending: false }).limit(5000);
        for (const r of (data ?? []) as any[]) {
          if (r.actor_user_id) actorIds.add(r.actor_user_id);
          results.push({
            id: `cln_${r.id}`, when: r.created_at, category: "clinical",
            actor: r.actor_name ?? "Unknown", actor_id: r.actor_user_id,
            action: r.action,
            resource_type: r.resource_type,
            resource_id: r.resource_id,
            client_email: null,
            detail: r.ip_address ? `ip ${r.ip_address}` : "",
          });
        }
      })());
    }

    if (enabled.consent_signed) {
      promises.push((async () => {
        let q = supabase.from("consent_signatures")
          .select("id, appointment_id, consent_form_id, client_email, signed_full_name, signed_at, decision, signing_mode, form_version")
          .gte("signed_at", fromIso).lte("signed_at", toIso)
          .order("signed_at", { ascending: false }).limit(5000);
        if (clientQ) q = q.ilike("client_email", `%${clientQ}%`);
        const { data } = await q;
        for (const r of (data ?? []) as any[]) {
          results.push({
            id: `cs_${r.id}`, when: r.signed_at, category: "consent_signed",
            actor: r.signed_full_name ?? r.client_email, actor_id: null,
            action: r.decision ?? "signed",
            resource_type: "consent_form",
            resource_id: r.consent_form_id,
            client_email: r.client_email,
            detail: [r.signing_mode, r.form_version && `v${r.form_version}`].filter(Boolean).join(" · "),
          });
        }
      })());
    }

    if (enabled.consent_email) {
      promises.push((async () => {
        let q = supabase.from("consent_email_log")
          .select("id, appointment_id, consent_form_id, recipient_email, template_name, source, status, reminder_number, created_at")
          .gte("created_at", fromIso).lte("created_at", toIso)
          .order("created_at", { ascending: false }).limit(5000);
        if (clientQ) q = q.ilike("recipient_email", `%${clientQ}%`);
        const { data } = await q;
        for (const r of (data ?? []) as any[]) {
          results.push({
            id: `ce_${r.id}`, when: r.created_at, category: "consent_email",
            actor: "System", actor_id: null,
            action: r.status ?? "sent",
            resource_type: r.template_name ?? "consent_email",
            resource_id: r.consent_form_id,
            client_email: r.recipient_email,
            detail: [r.source, r.reminder_number && `reminder #${r.reminder_number}`].filter(Boolean).join(" · "),
          });
        }
      })());
    }

    if (enabled.appointment) {
      promises.push((async () => {
        const { data } = await supabase.from("appointment_audit_log").select("*")
          .gte("created_at", fromIso).lte("created_at", toIso)
          .order("created_at", { ascending: false }).limit(5000);
        for (const r of (data ?? []) as any[]) {
          if (r.actor_user_id) actorIds.add(r.actor_user_id);
          results.push({
            id: `apt_${r.id}`, when: r.created_at, category: "appointment",
            actor: "Staff", actor_id: r.actor_user_id,
            action: r.action,
            resource_type: "appointment",
            resource_id: r.appointment_id,
            client_email: null,
            detail: [r.from_status && r.to_status && `${r.from_status} → ${r.to_status}`, r.notes].filter(Boolean).join(" · "),
          });
        }
      })());
    }

    await Promise.all(promises);

    // Resolve staff names
    const ids = Array.from(actorIds);
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data } = await supabase.from("staff_profiles")
        .select("user_id, full_name").in("user_id", ids);
      for (const s of (data ?? []) as any[]) names[s.user_id] = s.full_name;
    }
    // Fill in actor names for entries where we have actor_id but no readable actor
    const enriched = results.map((e) => {
      if (e.actor_id && names[e.actor_id]) return { ...e, actor: names[e.actor_id] };
      return e;
    });

    // Actor text filter (applied client-side across resolved names)
    const actorQ = actorFilter.trim().toLowerCase();
    const filtered = actorQ
      ? enriched.filter((e) => e.actor.toLowerCase().includes(actorQ))
      : enriched;

    filtered.sort((a, b) => (a.when < b.when ? 1 : -1));
    setStaffNames(names);
    setEvents(filtered);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const summary = useMemo(() => {
    const byCat: Record<Category, number> = {
      phi: 0, clinical: 0, consent_signed: 0, consent_email: 0, appointment: 0,
    };
    const actors = new Map<string, number>();
    const patients = new Set<string>();
    const perDay = new Map<string, number>();
    const days = eachDayOfInterval({ start: new Date(fromIso), end: new Date(toIso) });
    for (const d of days) perDay.set(format(d, "yyyy-MM-dd"), 0);

    let afterHours = 0;
    for (const e of events) {
      byCat[e.category]++;
      const key = format(new Date(e.when), "yyyy-MM-dd");
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
      actors.set(e.actor, (actors.get(e.actor) ?? 0) + 1);
      if (e.client_email) patients.add(e.client_email.toLowerCase());
      const h = new Date(e.when).getHours();
      if (h < 7 || h >= 21) afterHours++;
    }
    const topActors = Array.from(actors.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, count]) => ({ name, count }));
    return {
      total: events.length,
      byCat,
      uniquePatients: patients.size,
      uniqueActors: actors.size,
      topActors,
      perDay: Array.from(perDay.entries()).map(([date, count]) => ({ date, count })),
      afterHours,
    };
  }, [events, fromIso, toIso]);

  const exportCsv = () => {
    const header = ["timestamp", "category", "action", "actor", "resource_type", "resource_id", "client_email", "detail"];
    const rows = events.map((e) => [
      e.when, CATEGORY_LABEL[e.category], e.action, e.actor,
      e.resource_type, e.resource_id ?? "", e.client_email ?? "", e.detail,
    ].map(csvCell).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    downloadBlob(csv, `audit-report_${from}_to_${to}.csv`);
  };

  const printSummary = () => {
    window.print();
  };

  const pageEvents = events.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));

  if (authLoading) return <div className="flex justify-center py-32"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/staff/today" replace />;

  const maxDay = Math.max(1, ...summary.perDay.map((d) => d.count));

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 print:p-0 print:max-w-none">
      <header className="print:mb-4">
        <h1 className="font-serif text-3xl">Audit Report</h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3" />
          Review PHI access, consent activity, clinical mutations, and appointment changes by date range.
        </p>
      </header>

      {/* Filters */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <label className="text-xs space-y-1">
            <div className="text-muted-foreground flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> From</div>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to} />
          </label>
          <label className="text-xs space-y-1">
            <div className="text-muted-foreground flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> To</div>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from} />
          </label>
          <label className="text-xs space-y-1">
            <div className="text-muted-foreground">Patient email contains</div>
            <Input placeholder="jane@example.com" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} />
          </label>
          <label className="text-xs space-y-1">
            <div className="text-muted-foreground">Actor name contains</div>
            <Input placeholder="Jonni" value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-muted-foreground mr-2">Categories:</div>
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <label key={c} className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer ${enabled[c] ? "border-primary bg-primary/10" : "border-border bg-background"}`}>
              <input
                type="checkbox" className="mr-1.5 align-middle"
                checked={enabled[c]}
                onChange={(e) => setEnabled((s) => ({ ...s, [c]: e.target.checked }))}
              />
              {CATEGORY_LABEL[c]}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={load} disabled={loading} size="sm">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Activity className="h-3.5 w-3.5 mr-2" />}
            Run report
          </Button>
          <Button onClick={exportCsv} variant="outline" size="sm" disabled={events.length === 0}>
            <Download className="h-3.5 w-3.5 mr-2" /> Export CSV ({events.length})
          </Button>
          <Button onClick={printSummary} variant="outline" size="sm" disabled={events.length === 0}>
            <Printer className="h-3.5 w-3.5 mr-2" /> Print / Save PDF
          </Button>

          <div className="ml-auto flex gap-1.5">
            {[7, 30, 90, 365].map((d) => (
              <button
                key={d}
                onClick={() => { setFrom(format(subDays(new Date(), d), "yyyy-MM-dd")); setTo(format(new Date(), "yyyy-MM-dd")); }}
                className="text-[11px] px-2 py-1 rounded-full border border-border hover:bg-secondary"
              >Last {d}d</button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={<Activity className="h-4 w-4" />} label="Total events" value={summary.total} />
        <MetricCard icon={<Users className="h-4 w-4" />} label="Unique actors" value={summary.uniqueActors} />
        <MetricCard icon={<ShieldCheck className="h-4 w-4" />} label="Unique patients" value={summary.uniquePatients} />
        <MetricCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="After-hours events"
          value={summary.afterHours}
          tone={summary.afterHours > 0 ? "warn" : "ok"}
        />
      </div>

      {/* Breakdown by category */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Breakdown by category</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <div key={c} className="rounded-xl border border-border p-3">
              <div className={`text-[10px] uppercase tracking-wider inline-block px-2 py-0.5 rounded-full ${CATEGORY_COLOR[c]}`}>
                {CATEGORY_LABEL[c]}
              </div>
              <div className="text-2xl font-serif mt-2">{summary.byCat[c]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top actors + per-day sparkline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Top actors</div>
          {summary.topActors.length === 0 ? (
            <div className="text-sm text-muted-foreground">No activity in range.</div>
          ) : (
            <ol className="space-y-1.5">
              {summary.topActors.map((a) => (
                <li key={a.name} className="flex items-center justify-between text-sm">
                  <span className="truncate">{a.name}</span>
                  <span className="font-mono text-xs text-muted-foreground ml-2">{a.count}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Events per day</div>
          <div className="flex items-end gap-0.5 h-24">
            {summary.perDay.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.count}`}
                className="flex-1 bg-primary/70 hover:bg-primary rounded-t min-h-[2px]"
                style={{ height: `${(d.count / maxDay) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
            <span>{summary.perDay[0]?.date}</span>
            <span>{summary.perDay[summary.perDay.length - 1]?.date}</span>
          </div>
        </div>
      </div>

      {/* Events table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-medium flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> Events ({events.length})
          </div>
          <div className="text-xs text-muted-foreground">
            {from} → {to}
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No events in range. Try a wider date range or enable more categories.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40">
                  <tr>
                    <Th>When</Th>
                    <Th>Category</Th>
                    <Th>Action</Th>
                    <Th>Actor</Th>
                    <Th>Resource</Th>
                    <Th>Patient</Th>
                    <Th>Detail</Th>
                  </tr>
                </thead>
                <tbody>
                  {pageEvents.map((e) => (
                    <tr key={e.id} className="border-t border-border hover:bg-secondary/20">
                      <Td className="whitespace-nowrap font-mono">{format(new Date(e.when), "MMM d HH:mm")}</Td>
                      <Td>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${CATEGORY_COLOR[e.category]}`}>
                          {CATEGORY_LABEL[e.category]}
                        </span>
                      </Td>
                      <Td className="font-mono">{e.action}</Td>
                      <Td className="max-w-[160px] truncate">{e.actor}</Td>
                      <Td className="max-w-[160px] truncate">{e.resource_type}</Td>
                      <Td className="max-w-[180px] truncate">{e.client_email ?? "—"}</Td>
                      <Td className="max-w-[240px] truncate text-muted-foreground">{e.detail || "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground print:hidden">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="rounded-full border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-secondary">Previous</button>
              <span>Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="rounded-full border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-secondary">Next</button>
            </div>
          </>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-center print:mt-6">
        Report generated {format(new Date(), "PPpp")} · Radiantilyk Aesthetic · Confidential — HIPAA §164.308(a)(1)(ii)(D)
      </p>
    </div>
  );
}

function MetricCard({
  icon, label, value, tone = "default",
}: { icon: React.ReactNode; label: string; value: number; tone?: "default" | "ok" | "warn" }) {
  const toneCls = tone === "warn" ? "border-warning/40 bg-warning-soft" : "border-border bg-card";
  return (
    <div className={`rounded-2xl border p-4 ${toneCls}`}>
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-3xl font-serif mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

