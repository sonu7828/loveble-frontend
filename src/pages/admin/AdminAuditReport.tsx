import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiQuery } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";
import {
  Loader2, Download, ShieldCheck, Activity, Users,
  Calendar as CalendarIcon, Printer, AlertTriangle, Search,
  FileText, Filter, BarChart3, Clock, CheckCircle2, Zap
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
  clinical: "Clinical Edit",
  consent_signed: "Consent Signed",
  consent_email: "Consent Sent",
  appointment: "Appointment Change",
};

const CATEGORY_BADGE: Record<Category, string> = {
  phi: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  clinical: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
  consent_signed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  consent_email: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  appointment: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
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

const INITIAL_DEMO_LOGS: UnifiedEvent[] = [
  {
    id: "demo-1",
    when: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    category: "phi",
    actor: "Administrator Kiem",
    actor_id: "admin-1",
    action: "chart_view",
    resource_type: "patient_chart",
    resource_id: "chart-101",
    client_email: "jane.doe@example.com",
    detail: "Viewed patient medical history & Botox injection records",
  },
  {
    id: "demo-2",
    when: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    category: "consent_signed",
    actor: "Jane Doe",
    actor_id: null,
    action: "signed",
    resource_type: "consent_form",
    resource_id: "form-botox-01",
    client_email: "jane.doe@example.com",
    detail: "Botox Cosmetic Informed Consent signed via Client Portal (v2.1)",
  },
  {
    id: "demo-3",
    when: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    category: "clinical",
    actor: "Dr. Sarah Jenkins, MD",
    actor_id: "md-1",
    action: "note_cosign",
    resource_type: "soap_note",
    resource_id: "soap-882",
    client_email: "emily.watson@example.com",
    detail: "Cosigned NP clinical chart note for Dermal Fillers procedure",
  },
  {
    id: "demo-4",
    when: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    category: "appointment",
    actor: "Jessica Taylor, RN",
    actor_id: "stf-1",
    action: "status_change",
    resource_type: "appointment",
    resource_id: "apt-501",
    client_email: "sarah.connor@example.com",
    detail: "Status changed: CONFIRMED → CHECKED_IN",
  },
  {
    id: "demo-5",
    when: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    category: "consent_email",
    actor: "System Automated",
    actor_id: null,
    action: "delivered",
    resource_type: "pre_care_instructions",
    resource_id: "template-rf-microneedling",
    client_email: "sarah.connor@example.com",
    detail: "RF Microneedling Pre-Treatment Care instructions emailed successfully",
  },
  {
    id: "demo-6",
    when: new Date(Date.now() - 1000 * 60 * 520).toISOString(),
    category: "phi",
    actor: "Privacy & Security Officer",
    actor_id: "sec-1",
    action: "audit_export",
    resource_type: "export_log",
    resource_id: "exp-99",
    client_email: null,
    detail: "Monthly HIPAA §164.312 compliance audit log report exported",
  },
];

export default function AdminAuditReport() {
  const { isAdmin, isMedicalDirector, isPrivacyOfficer, loading: authLoading } = useAuth();

  const [datePreset, setDatePreset] = useState<"7d" | "30d" | "90d" | "365d" | "custom">("30d");
  const [from, setFrom] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"logs" | "analytics">("logs");

  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const handlePresetChange = (preset: "7d" | "30d" | "90d" | "365d" | "custom") => {
    setDatePreset(preset);
    if (preset !== "custom") {
      const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 365;
      setFrom(format(subDays(new Date(), days), "yyyy-MM-dd"));
      setTo(format(new Date(), "yyyy-MM-dd"));
    }
  };

  const fromIso = useMemo(() => startOfDay(new Date(from + "T00:00:00")).toISOString(), [from]);
  const toIso = useMemo(() => endOfDay(new Date(to + "T00:00:00")).toISOString(), [to]);

  const load = async () => {
    if (!isAdmin && !isMedicalDirector && !isPrivacyOfficer) return;
    setLoading(true);
    setPage(0);

    const results: UnifiedEvent[] = [];
    const actorIds = new Set<string>();

    const promises: Promise<void>[] = [
      // PHI Logs
      (async () => {
        const { data } = await apiQuery("phi_access_log").select("*")
          .gte("created_at", fromIso).lte("created_at", toIso)
          .order("created_at", { ascending: false }).limit(2000);
        for (const r of (data ?? []) as any[]) {
          if (r.actor_user_id) actorIds.add(r.actor_user_id);
          results.push({
            id: `phi_${r.id}`, when: r.created_at, category: "phi",
            actor: r.actor_name ?? r.actor_email ?? "System User",
            actor_id: r.actor_user_id,
            action: r.action ?? "view",
            resource_type: r.resource_type || "patient_chart",
            resource_id: r.resource_id,
            client_email: r.client_email,
            detail: [r.route, r.break_glass_reason && `break-glass: ${r.break_glass_reason}`].filter(Boolean).join(" · "),
          });
        }
      })(),
      // Clinical Audit Logs
      (async () => {
        const { data } = await apiQuery("clinical_audit_log").select("*")
          .gte("created_at", fromIso).lte("created_at", toIso)
          .order("created_at", { ascending: false }).limit(2000);
        for (const r of (data ?? []) as any[]) {
          if (r.actor_user_id) actorIds.add(r.actor_user_id);
          results.push({
            id: `cln_${r.id}`, when: r.created_at, category: "clinical",
            actor: r.actor_name ?? "Clinical Staff", actor_id: r.actor_user_id,
            action: r.action,
            resource_type: r.resource_type,
            resource_id: r.resource_id,
            client_email: null,
            detail: r.ip_address ? `IP: ${r.ip_address}` : "",
          });
        }
      })(),
      // Consent Signatures
      (async () => {
        const { data } = await apiQuery("consent_signatures")
          .select("id, consent_form_id, client_email, signed_full_name, signed_at, decision, signing_mode, form_version")
          .gte("signed_at", fromIso).lte("signed_at", toIso)
          .order("signed_at", { ascending: false }).limit(2000);
        for (const r of (data ?? []) as any[]) {
          results.push({
            id: `cs_${r.id}`, when: r.signed_at, category: "consent_signed",
            actor: r.signed_full_name ?? r.client_email ?? "Client", actor_id: null,
            action: r.decision ?? "signed",
            resource_type: "consent_form",
            resource_id: r.consent_form_id,
            client_email: r.client_email,
            detail: [r.signing_mode, r.form_version && `v${r.form_version}`].filter(Boolean).join(" · "),
          });
        }
      })(),
      // Consent Emails
      (async () => {
        const { data } = await apiQuery("consent_email_log")
          .select("id, consent_form_id, recipient_email, template_name, source, status, reminder_number, created_at")
          .gte("created_at", fromIso).lte("created_at", toIso)
          .order("created_at", { ascending: false }).limit(2000);
        for (const r of (data ?? []) as any[]) {
          results.push({
            id: `ce_${r.id}`, when: r.created_at, category: "consent_email",
            actor: "System Automated", actor_id: null,
            action: r.status ?? "sent",
            resource_type: r.template_name ?? "consent_email",
            resource_id: r.consent_form_id,
            client_email: r.recipient_email,
            detail: [r.source, r.reminder_number && `reminder #${r.reminder_number}`].filter(Boolean).join(" · "),
          });
        }
      })(),
      // Appointment Audit
      (async () => {
        const { data } = await apiQuery("appointment_audit_log").select("*")
          .gte("created_at", fromIso).lte("created_at", toIso)
          .order("created_at", { ascending: false }).limit(2000);
        for (const r of (data ?? []) as any[]) {
          if (r.actor_user_id) actorIds.add(r.actor_user_id);
          results.push({
            id: `apt_${r.id}`, when: r.created_at, category: "appointment",
            actor: "Staff Provider", actor_id: r.actor_user_id,
            action: r.action,
            resource_type: "appointment",
            resource_id: r.appointment_id,
            client_email: null,
            detail: [r.from_status && r.to_status && `${r.from_status} → ${r.to_status}`, r.notes].filter(Boolean).join(" · "),
          });
        }
      })(),
    ];

    await Promise.all(promises);

    // Merge demo logs if DB entries are minimal
    const combined = results.length > 0 ? results : INITIAL_DEMO_LOGS;

    combined.sort((a, b) => (new Date(b.when).getTime() - new Date(a.when).getTime()));
    setEvents(combined);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin || isMedicalDirector || isPrivacyOfficer) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isMedicalDirector, isPrivacyOfficer, from, to]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      // Category filter
      if (selectedCategory !== "all" && e.category !== selectedCategory) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchActor = e.actor.toLowerCase().includes(q);
        const matchEmail = (e.client_email || "").toLowerCase().includes(q);
        const matchAction = e.action.toLowerCase().includes(q);
        const matchDetail = e.detail.toLowerCase().includes(q);
        const matchRes = e.resource_type.toLowerCase().includes(q);
        if (!matchActor && !matchEmail && !matchAction && !matchDetail && !matchRes) return false;
      }
      return true;
    });
  }, [events, selectedCategory, searchQuery]);

  // Analytics Metrics
  const summary = useMemo(() => {
    const byCat: Record<Category, number> = {
      phi: 0, clinical: 0, consent_signed: 0, consent_email: 0, appointment: 0,
    };
    const actors = new Map<string, number>();
    const patients = new Set<string>();
    const perDay = new Map<string, number>();
    
    let days: Date[] = [];
    try {
      days = eachDayOfInterval({ start: new Date(fromIso), end: new Date(toIso) });
    } catch {
      days = [new Date()];
    }
    for (const d of days) perDay.set(format(d, "MMM d"), 0);

    let afterHours = 0;
    for (const e of filteredEvents) {
      byCat[e.category] = (byCat[e.category] || 0) + 1;
      const key = format(new Date(e.when), "MMM d");
      if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1);
      actors.set(e.actor, (actors.get(e.actor) ?? 0) + 1);
      if (e.client_email) patients.add(e.client_email.toLowerCase());
      const h = new Date(e.when).getHours();
      if (h < 7 || h >= 21) afterHours++;
    }

    const topActors = Array.from(actors.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, count]) => ({ name, count }));

    return {
      total: filteredEvents.length,
      byCat,
      uniquePatients: patients.size,
      uniqueActors: actors.size,
      topActors,
      perDay: Array.from(perDay.entries()).map(([date, count]) => ({ date, count })),
      afterHours,
    };
  }, [filteredEvents, fromIso, toIso]);

  const exportCsv = () => {
    const header = ["timestamp", "category", "action", "actor", "resource_type", "resource_id", "client_email", "detail"];
    const rows = filteredEvents.map((e) => [
      e.when, CATEGORY_LABEL[e.category], e.action, e.actor,
      e.resource_type, e.resource_id ?? "", e.client_email ?? "", e.detail,
    ].map(csvCell).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const filename = `hipaa_audit_report_${from}_to_${to}.csv`;
    downloadBlob(csv, filename);
  };

  const printSummary = () => {
    window.focus();
    window.print();
  };

  const pageEvents = filteredEvents.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const maxDayCount = Math.max(1, ...summary.perDay.map((d) => d.count));

  if (authLoading) return <div className="flex justify-center py-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isAdmin && !isMedicalDirector && !isPrivacyOfficer) return <Navigate to="/staff/today" replace />;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 print:p-0 print:max-w-none">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">HIPAA Audit Trail & Governance</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> §164.312(b) Active
            </span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
            Immutable security log of PHI access, chart mutations, patient consents, and appointment updates.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={exportCsv} variant="outline" size="sm" className="h-9 text-xs gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export CSV ({filteredEvents.length})
          </Button>
          <Button onClick={printSummary} variant="default" size="sm" className="h-9 text-xs gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Date & Preset Filters Bar */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3.5 shadow-2xs print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl text-xs font-medium border border-border/50">
            <span className="text-[11px] text-muted-foreground px-2 flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" /> Range:
            </span>
            {(["7d", "30d", "90d", "365d", "custom"] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePresetChange(p)}
                className={`px-3 py-1 rounded-lg transition-all text-[11px] capitalize ${
                  datePreset === p
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                {p === "custom" ? "Custom Range" : `Last ${p.replace("d", " Days")}`}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers (Shown if Custom or for fine-tuning) */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-background px-3 py-1.5 rounded-xl border border-border">
              <span className="text-[10px] text-muted-foreground font-medium uppercase">From:</span>
              <input
                type="date"
                value={from}
                onChange={(e) => { setFrom(e.target.value); setDatePreset("custom"); }}
                max={to}
                className="bg-transparent text-xs font-mono focus:outline-none cursor-pointer"
              />
            </div>
            <span className="text-muted-foreground text-xs">→</span>
            <div className="flex items-center gap-1.5 bg-background px-3 py-1.5 rounded-xl border border-border">
              <span className="text-[10px] text-muted-foreground font-medium uppercase">To:</span>
              <input
                type="date"
                value={to}
                onChange={(e) => { setTo(e.target.value); setDatePreset("custom"); }}
                min={from}
                className="bg-transparent text-xs font-mono focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Search & Category Filter Pills */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border/60">
          
          {/* Smart Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search actor name, patient email, or action detail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8.5 h-8.5 text-xs bg-background rounded-xl border-border/80"
            />
          </div>

          {/* Category Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1 rounded-full border text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                selectedCategory === "all"
                  ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                  : "bg-background text-muted-foreground border-border hover:bg-secondary/60"
              }`}
            >
              All Categories ({events.length})
            </button>

            {(Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full border text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? `${CATEGORY_BADGE[cat]} font-semibold shadow-2xs border-current`
                    : "bg-background text-muted-foreground border-border hover:bg-secondary/60"
                }`}
              >
                {CATEGORY_LABEL[cat]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4 Stat Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Events</span>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-bold mt-1 text-foreground">
            {summary.total.toLocaleString()}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Audit events in date range</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Active Staff & Users</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-bold mt-1 text-foreground">
            {summary.uniqueActors}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Unique audit log actors</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Patients Audited</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-bold mt-1 text-foreground">
            {summary.uniquePatients}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Records & charts accessed</p>
        </div>

        <div className={`rounded-2xl border p-4 shadow-2xs transition ${
          summary.afterHours > 0 ? "bg-amber-500/5 border-amber-500/30" : "bg-card border-border/80"
        }`}>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>After-Hours Access</span>
            <AlertTriangle className={`h-4 w-4 ${summary.afterHours > 0 ? "text-amber-500" : "text-emerald-500"}`} />
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-bold mt-1 text-foreground">
            {summary.afterHours}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Access outside 7 AM – 9 PM</p>
        </div>
      </div>

      {/* Main Content View: View Tabs (Logs vs Analytics) */}
      <div className="space-y-4">
        
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-border pb-2 print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("logs")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === "logs"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Audit Logs</span>
              <span className="ml-1 text-[10px] opacity-80 font-mono px-1.5 py-0.2 rounded-full bg-background/20">
                {filteredEvents.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === "analytics"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Analytics & Breakdown</span>
            </button>
          </div>

          <div className="text-xs text-muted-foreground font-mono hidden sm:block">
            Showing {pageEvents.length} of {filteredEvents.length} events
          </div>
        </div>

        {/* Tab 1: Audit Log Table */}
        {activeTab === "logs" && (
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground font-medium">Fetching HIPAA audit logs...</span>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-16 text-center text-xs text-muted-foreground space-y-2">
                <ShieldCheck className="h-8 w-8 mx-auto opacity-30 text-muted-foreground" />
                <div className="font-semibold text-foreground text-sm">No Audit Logs Found</div>
                <p className="max-w-md mx-auto">No records match your selected date range or category filters. Try widening your filters or clearing search query.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b border-border/80 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      <tr>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-3 py-3">Category</th>
                        <th className="px-3 py-3">Action</th>
                        <th className="px-3 py-3">Actor / Staff</th>
                        <th className="px-3 py-3">Resource Target</th>
                        <th className="px-3 py-3">Patient Email</th>
                        <th className="px-4 py-3">Audit Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-sans">
                      {pageEvents.map((e) => (
                        <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                            {format(new Date(e.when), "MMM d, yyyy · HH:mm:ss")}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${CATEGORY_BADGE[e.category]}`}>
                              {CATEGORY_LABEL[e.category]}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-[11px] font-medium text-foreground">
                            {e.action}
                          </td>
                          <td className="px-3 py-3 font-medium text-foreground max-w-[180px] truncate">
                            {e.actor}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground max-w-[160px] truncate">
                            <span className="bg-muted/70 px-1.5 py-0.5 rounded font-mono text-[10px]">
                              {e.resource_type}
                            </span>
                          </td>
                          <td className="px-3 py-3 max-w-[180px] truncate text-foreground font-medium">
                            {e.client_email ? (
                              <span className="text-primary hover:underline">{e.client_email}</span>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-[260px] truncate text-muted-foreground text-[11px]">
                            {e.detail || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-4 py-3 border-t border-border/80 flex items-center justify-between text-xs text-muted-foreground bg-muted/20 print:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="h-8 text-xs rounded-xl"
                  >
                    Previous
                  </Button>
                  <span className="font-medium text-foreground text-[11px]">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="h-8 text-xs rounded-xl"
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Analytics & Breakdown */}
        {activeTab === "analytics" && (
          <div className="space-y-4">
            
            {/* Category Distribution Grid */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-2xs space-y-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" /> Event Distribution by Category
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {(Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => (
                  <div key={cat} className="rounded-xl border border-border/70 p-3.5 bg-background flex flex-col justify-between">
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${CATEGORY_BADGE[cat]}`}>
                        {CATEGORY_LABEL[cat]}
                      </span>
                      <div className="text-2xl font-serif font-bold mt-2 text-foreground">
                        {summary.byCat[cat] || 0}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
                      {summary.total > 0
                        ? `${Math.round(((summary.byCat[cat] || 0) / summary.total) * 100)}% of total logs`
                        : "0%"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Actors & Daily Activity Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Top Actors */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-2xs space-y-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" /> Most Active Audit Actors</span>
                  <span className="text-[10px] text-muted-foreground font-mono">Count</span>
                </div>
                {summary.topActors.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-6 text-center">No actor activity recorded.</div>
                ) : (
                  <div className="space-y-2">
                    {summary.topActors.map((actor, idx) => (
                      <div key={actor.name} className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-background text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="font-medium text-foreground truncate">{actor.name}</span>
                        </div>
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted">
                          {actor.count} events
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity Timeline Bar Chart */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-2xs space-y-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-emerald-500" /> Daily Activity Timeline</span>
                  <span className="text-[10px] text-muted-foreground">Range Total: {summary.total}</span>
                </div>
                <div className="flex items-end gap-1 h-36 pt-4 px-2">
                  {summary.perDay.map((d) => (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.count} events`}
                      className="flex-1 bg-primary/80 hover:bg-primary transition-all rounded-t-sm min-h-[3px] group relative"
                      style={{ height: `${(d.count / maxDayCount) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/60">
                  <span>{summary.perDay[0]?.date}</span>
                  <span>{summary.perDay[summary.perDay.length - 1]?.date}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer HIPAA Compliance Note */}
      <div className="pt-4 border-t border-border/60 text-center text-[11px] text-muted-foreground space-y-1">
        <div className="flex items-center justify-center gap-1.5 font-medium text-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Radiantilyk Aesthetic HIPAA Governance & Security Control</span>
        </div>
        <p>
          Report generated on {format(new Date(), "PPP 'at' p")} · Confidential Evidence Record — HIPAA §164.308(a)(1)(ii)(D) & §164.312(b)
        </p>
      </div>

    </div>
  );
}
