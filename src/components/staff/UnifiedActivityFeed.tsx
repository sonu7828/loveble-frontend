import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2, Filter, Calendar as CalIcon, User as UserIcon, FileText, ShieldCheck, Stethoscope, FileCheck2 } from "lucide-react";
import { Input } from "@/components/ui/input";

type Source = "appointment" | "phi" | "clinical" | "consent_validation";

interface UnifiedRow {
  id: string;
  source: Source;
  created_at: string;
  actor_user_id: string | null;
  actor_name: string | null;
  action: string;
  label: string;
  detail: string;
  target_email: string | null;
  link: string | null;
}

interface StaffOpt { user_id: string; full_name: string; }

const SOURCE_META: Record<Source, { label: string; icon: typeof FileText; tone: string }> = {
  appointment: { label: "Appointment", icon: FileText, tone: "bg-info-soft text-info-soft-foreground" },
  phi:         { label: "PHI access",  icon: ShieldCheck, tone: "bg-warning-soft text-warning-soft-foreground" },
  clinical:    { label: "Clinical",    icon: Stethoscope, tone: "bg-success-soft text-success-soft-foreground" },
  consent_validation: { label: "Consent check", icon: FileCheck2, tone: "bg-secondary text-muted-foreground" },
};

const APPT_LABEL: Record<string, string> = {
  created_by_staff: "Created appointment",
  created_by_client: "Client booked",
  approved: "Approved booking",
  denied: "Denied booking",
  cancelled_by_staff: "Cancelled appointment",
  cancelled_by_client: "Client cancelled",
  rescheduled_by_staff: "Rescheduled",
  rescheduled_by_client: "Client rescheduled",
  marked_completed: "Completed visit",
  marked_no_show: "Marked no-show",
  no_show_charged: "Charged no-show fee",
  services_edited: "Edited services",
};

const PHI_RESOURCE_LABEL: Record<string, string> = {
  chart_note: "chart note",
  gfe: "GFE",
  consent: "consent",
  clinical_photo: "clinical photo",
  client_id: "ID document",
  client_profile: "client chart",
  appointment: "appointment",
};

function startOfDayISO(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x.toISOString(); }
function endOfDayISO(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x.toISOString(); }

export function UnifiedActivityFeed() {
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [staffFilter, setStaffFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<Source | "">("");
  const [search, setSearch] = useState("");

  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10);
  }, []);
  const defaultTo = useMemo(() => today.toISOString().slice(0, 10), [today]);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("staff_profiles").select("user_id, full_name").not("user_id", "is", null).order("full_name");
      setStaff((data ?? []) as StaffOpt[]);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const fromISO = startOfDayISO(new Date(from));
      const toISO = endOfDayISO(new Date(to));

      const appointmentsQ = supabase
        .from("appointment_audit_log")
        .select("id, appointment_id, actor_user_id, action, from_status, to_status, notes, created_at")
        .gte("created_at", fromISO).lte("created_at", toISO)
        .order("created_at", { ascending: false })
        .limit(500);

      const phiQ = supabase
        .from("phi_access_log")
        .select("id, actor_user_id, actor_name, resource_type, resource_id, client_email, action, route, created_at")
        .gte("created_at", fromISO).lte("created_at", toISO)
        .order("created_at", { ascending: false })
        .limit(500);

      const clinicalQ = supabase
        .from("clinical_audit_log")
        .select("id, actor_user_id, actor_name, resource_type, resource_id, action, metadata, created_at")
        .gte("created_at", fromISO).lte("created_at", toISO)
        .order("created_at", { ascending: false })
        .limit(500);

      const consentQ = supabase
        .from("consent_validation_log")
        .select("id, appointment_id, client_email, missing_form_ids, source, created_at")
        .gte("created_at", fromISO).lte("created_at", toISO)
        .order("created_at", { ascending: false })
        .limit(300);

      const [apptRes, phiRes, clinRes, conRes] = await Promise.all([appointmentsQ, phiQ, clinicalQ, consentQ]);
      if (cancelled) return;

      // Resolve actor names + appointment client names in batch
      const actorIds = new Set<string>();
      const apptIds = new Set<string>();
      for (const r of apptRes.data ?? []) { if (r.actor_user_id) actorIds.add(r.actor_user_id); apptIds.add(r.appointment_id); }
      for (const r of clinRes.data ?? []) { if (r.actor_user_id) actorIds.add(r.actor_user_id); }
      for (const r of conRes.data ?? []) { apptIds.add(r.appointment_id); }

      const [{ data: staffData }, { data: apptData }] = await Promise.all([
        actorIds.size
          ? supabase.from("staff_profiles").select("user_id, full_name").in("user_id", [...actorIds])
          : Promise.resolve({ data: [] as any[] }),
        apptIds.size
          ? supabase.from("appointments").select("id, client_first_name, client_last_name, client_email").in("id", [...apptIds])
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const nameByUser: Record<string, string> = {};
      for (const s of (staffData ?? []) as any[]) nameByUser[s.user_id] = s.full_name;
      const apptByIdMap: Record<string, { name: string; email: string }> = {};
      for (const a of (apptData ?? []) as any[]) {
        apptByIdMap[a.id] = { name: `${a.client_first_name ?? ""} ${a.client_last_name ?? ""}`.trim(), email: a.client_email };
      }

      const merged: UnifiedRow[] = [];

      for (const r of (apptRes.data ?? []) as any[]) {
        const a = apptByIdMap[r.appointment_id];
        merged.push({
          id: `appt-${r.id}`,
          source: "appointment",
          created_at: r.created_at,
          actor_user_id: r.actor_user_id,
          actor_name: r.actor_user_id ? (nameByUser[r.actor_user_id] ?? "Staff") : "Client / system",
          action: r.action,
          label: APPT_LABEL[r.action] ?? r.action,
          detail: a ? `${a.name}${r.from_status && r.to_status ? ` · ${r.from_status} → ${r.to_status}` : ""}` : "Appointment removed",
          target_email: a?.email ?? null,
          link: `/staff/appointments/${r.appointment_id}`,
        });
      }
      for (const r of (phiRes.data ?? []) as any[]) {
        merged.push({
          id: `phi-${r.id}`,
          source: "phi",
          created_at: r.created_at,
          actor_user_id: r.actor_user_id,
          actor_name: r.actor_name ?? (r.actor_user_id ? nameByUser[r.actor_user_id] : null) ?? "Staff",
          action: r.action,
          label: `Viewed ${PHI_RESOURCE_LABEL[r.resource_type] ?? r.resource_type}`,
          detail: r.client_email,
          target_email: r.client_email,
          link: r.route,
        });
      }
      for (const r of (clinRes.data ?? []) as any[]) {
        merged.push({
          id: `clin-${r.id}`,
          source: "clinical",
          created_at: r.created_at,
          actor_user_id: r.actor_user_id,
          actor_name: r.actor_name ?? (r.actor_user_id ? nameByUser[r.actor_user_id] : null) ?? "Staff",
          action: r.action,
          label: `${r.action} ${r.resource_type}`,
          detail: (r.metadata?.op ? `op: ${r.metadata.op}` : "") || "",
          target_email: null,
          link: null,
        });
      }
      for (const r of (conRes.data ?? []) as any[]) {
        const a = apptByIdMap[r.appointment_id];
        const missing = Array.isArray(r.missing_form_ids) ? r.missing_form_ids.length : 0;
        merged.push({
          id: `con-${r.id}`,
          source: "consent_validation",
          created_at: r.created_at,
          actor_user_id: null,
          actor_name: r.source ?? "system",
          action: missing > 0 ? "missing_consents" : "ok",
          label: missing > 0 ? `${missing} consent${missing === 1 ? "" : "s"} missing` : "Consents satisfied",
          detail: a?.name ?? r.client_email ?? "",
          target_email: r.client_email,
          link: `/staff/appointments/${r.appointment_id}`,
        });
      }

      merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setRows(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [from, to]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (sourceFilter && r.source !== sourceFilter) return false;
      if (staffFilter && r.actor_user_id !== staffFilter) return false;
      if (q) {
        const hay = `${r.actor_name ?? ""} ${r.label} ${r.detail} ${r.target_email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, sourceFilter, staffFilter, search]);

  const byActor = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      const k = r.actor_name ?? "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-secondary/40 border border-border p-3 text-xs text-muted-foreground">
        Unified feed across appointment changes, PHI access, clinical edits, and consent checks. Use to answer "what did <em>X</em> do today?"
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] items-center">
        <Input placeholder="Search name, client, action…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex items-center gap-1.5 text-xs">
          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}
            className="rounded-full border border-border bg-background text-xs px-3 py-2">
            <option value="">All staff</option>
            {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as any)}
            className="rounded-full border border-border bg-background text-xs px-3 py-2">
            <option value="">All sources</option>
            {(Object.keys(SOURCE_META) as Source[]).map((k) => <option key={k} value={k}>{SOURCE_META[k].label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <CalIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-full border border-border bg-background text-xs px-3 py-2" />
          <span className="text-muted-foreground">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-full border border-border bg-background text-xs px-3 py-2" />
        </div>
      </div>

      {byActor.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {byActor.map(([name, n]) => (
            <span key={name} className="text-[11px] rounded-full bg-secondary px-2 py-1">
              {name} <span className="text-muted-foreground">· {n}</span>
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
          No activity in this range.
        </div>
      ) : (
        <ol className="space-y-2">
          {filtered.slice(0, 300).map((r) => {
            const meta = SOURCE_META[r.source];
            const Icon = meta.icon;
            const inner = (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.tone}`}>
                      <Icon className="h-3 w-3" /> {meta.label}
                    </span>
                    <span className="text-xs font-medium">{r.label}</span>
                  </div>
                  <div className="text-sm mt-1 truncate">
                    <span className="font-medium">{r.actor_name ?? "—"}</span>
                    {r.detail && <span className="text-muted-foreground"> · {r.detail}</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    <span title={format(new Date(r.created_at), "PPpp")}>
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            );
            return (
              <li key={r.id}>
                {r.link && r.link.startsWith("/") ? <Link to={r.link}>{inner}</Link> : inner}
              </li>
            );
          })}
        </ol>
      )}

      {filtered.length > 300 && (
        <div className="text-center text-xs text-muted-foreground">
          Showing first 300 of {filtered.length} events. Narrow the date range or filter to see more.
        </div>
      )}
    </div>
  );
}
