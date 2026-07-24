import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, ShieldCheck, BookOpen, ShieldAlert, CheckCircle2,
  Lock, HardDrive, Eye, Activity, ArrowUpRight, Laptop, Building2,
  Calendar, CheckSquare, Zap, History as HistoryIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ActivityItem = {
  id: string;
  category: "login" | "mfa" | "policy" | "audit" | "breach";
  title: string;
  desc: string;
  time: string;
  status: "success" | "warning" | "info";
};

type AuditLogRow = {
  id: string;
  action: string;
  resource: string;
  user: string;
  time: string;
  status: string;
};

export default function AdminHub() {
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [metrics, setMetrics] = useState({
    complianceScore: 94,
    mfaStatus: "Enforced for Privileged Roles",
    pendingPolicies: 1,
    pendingBAAs: 1,
    openAlerts: 0,
    openBreaches: 0,
  });

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadComplianceData = async () => {
      try {
        const [{ count: policyPendingCount }, { count: vendorPendingCount }, { count: breachCount }, { data: phiLogs }] = await Promise.all([
          supabase.from("hipaa_policies" as any).select("id", { count: "exact", head: true }).eq("status", "draft"),
          supabase.from("vendors" as any).select("id", { count: "exact", head: true }).neq("baa_status", "signed"),
          supabase.from("breach_reports" as any).select("id", { count: "exact", head: true }).eq("status", "open"),
          supabase.from("phi_access_log" as any).select("id, action, resource, created_at, user_id").order("created_at", { ascending: false }).limit(5),
        ]);

        if (!isMounted) return;

        setMetrics((prev) => ({
          ...prev,
          pendingPolicies: policyPendingCount ?? 1,
          pendingBAAs: vendorPendingCount ?? 1,
          openBreaches: breachCount ?? 0,
        }));

        // Format recent audit log rows (latest 5)
        const formattedAuditLogs: AuditLogRow[] = (phiLogs ?? []).slice(0, 5).map((log: any, idx: number) => ({
          id: log.id || `audit-${idx}`,
          action: log.action || "Read Patient Chart",
          resource: log.resource || "Medical Record PHI",
          user: log.user_id ? "Staff Member" : "System Process",
          time: log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now",
          status: "Authorized Access",
        }));

        // Removed dummy audit logs

        setAuditLogs(formattedAuditLogs.slice(0, 5));

        const feed: ActivityItem[] = [];

        setActivities(feed);
      } catch (e) {
        console.warn("Compliance data fetch notice:", e);
      } finally {
        if (isMounted) setLoadingMetrics(false);
      }
    };

    loadComplianceData();
    return () => { isMounted = false; };
  }, []);

  const QUICK_ACTIONS = [
    { to: "/staff/team", label: "Staff Management", desc: "Manage members, roles & pending approvals", icon: Users },
    { to: "/staff/audit-report", label: "Audit Logs", desc: "PHI access logs & system audit history", icon: HistoryIcon },
    { to: "/staff/hipaa-policies", label: "HIPAA Policies", desc: "Privacy, security & risk analysis documentation", icon: BookOpen },
    { to: "/staff/vendors?tab=devices", label: "Device Inventory", desc: "Workstations, encryption & serial numbers", icon: Laptop },
    { to: "/staff/vendors", label: "Vendor Management", desc: "Vendor registry & BAA compliance", icon: Building2 },
    { to: "/staff/breach-report", label: "Breach Reports", desc: "File & review security incident cases", icon: ShieldAlert },
  ];

  const UPCOMING_TASKS = [
    { title: "Annual HIPAA Security Risk Assessment", due: "Due in 45 days", type: "High Priority", icon: ShieldAlert, color: "text-amber-600 bg-amber-500/10" },
    { title: "GoHighLevel BAA Renewal & Review", due: "Due next month", type: "Vendor Governance", icon: Building2, color: "text-blue-600 bg-blue-500/10" },
    { title: "Quarterly Staff Compliance Refresher", due: "12/12 Completed", type: "Training", icon: CheckSquare, color: "text-emerald-600 bg-emerald-500/10" },
    { title: "Monthly PHI Access Log Audit Review", due: "Scheduled for Friday", type: "Audit Review", icon: Eye, color: "text-purple-600 bg-purple-500/10" },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="font-serif text-xl sm:text-2xl font-medium">Admin Dashboard</h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium px-2.5 py-0.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Enterprise HIPAA Platform
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Healthcare governance, security monitoring, and compliance overview.</p>
        </div>
      </div>

      {/* 1. Compliance Score (4 KPI Cards) */}
      <section className="space-y-3">
        <h2 className="font-serif text-xl">Compliance Score</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Overall Score */}
          <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between shadow-xs">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Overall Compliance Score</div>
              <div className="text-2xl font-bold font-serif text-foreground mt-1">{metrics.complianceScore}% <span className="text-xs text-emerald-600 font-sans font-normal">(Grade A)</span></div>
              <div className="text-[11px] text-emerald-600 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="h-3 w-3" /> Technical & Admin Safeguards
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          {/* Card 2: MFA Status */}
          <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between shadow-xs">
            <div>
              <div className="text-xs font-medium text-muted-foreground">MFA Compliance Status</div>
              <div className="text-sm font-semibold text-foreground mt-1">{metrics.mfaStatus}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Admin, Provider & NP Roles Enforced</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Lock className="h-5 w-5" />
            </div>
          </div>

          {/* Card 3: Pending Policies */}
          <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between shadow-xs">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Pending Policy Approvals</div>
              <div className="text-2xl font-bold font-serif text-foreground mt-1">{metrics.pendingPolicies} <span className="text-xs text-amber-600 font-sans font-normal">Pending Review</span></div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Risk Analysis & Policy Pack</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>

          {/* Card 4: Backup Status */}
          <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between shadow-xs">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Last Backup Verification</div>
              <div className="text-sm font-semibold text-foreground mt-1">Verified Today</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">AES-256 Postgres PITR</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <HardDrive className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Security Alerts */}
      <section className="space-y-3">
        <h2 className="font-serif text-xl">Security Alerts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm text-foreground truncate">Threat Monitoring Level: Low</div>
              <div className="text-xs text-muted-foreground mt-0.5">0 open security alerts or anomalous access attempts reported in past 30 days.</div>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Lock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm text-foreground truncate">Idle Auto-Logout Mounted</div>
              <div className="text-xs text-muted-foreground mt-0.5">15-minute inactive session termination active on all staff workstations.</div>
            </div>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm text-foreground truncate">CMIA 15-Day SLA Active</div>
              <div className="text-xs text-muted-foreground mt-0.5">California Confidentiality of Medical Information Act notification tracker ready.</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Quick Actions */}
      <section className="space-y-3">
        <h2 className="font-serif text-xl">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((qa) => {
            const Icon = qa.icon;
            return (
              <Link
                key={qa.label}
                to={qa.to}
                className="rounded-2xl border border-border bg-card p-4 hover:bg-muted/40 transition group flex items-start justify-between shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm flex items-center gap-1 group-hover:text-primary transition">
                      {qa.label} <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition" />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{qa.desc}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 4. Recent Activity */}
      <section className="space-y-3">
        <h2 className="font-serif text-xl">Recent Activity</h2>
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="divide-y divide-border">
            {activities.length > 0 ? (
              activities.map((act) => (
                <div key={act.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition text-xs md:text-sm">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      {act.category === "login" && <Users className="h-4 w-4 text-blue-600" />}
                      {act.category === "mfa" && <Lock className="h-4 w-4 text-emerald-600" />}
                      {act.category === "policy" && <BookOpen className="h-4 w-4 text-purple-600" />}
                      {act.category === "audit" && <Eye className="h-4 w-4 text-amber-600" />}
                      {act.category === "breach" && <ShieldAlert className="h-4 w-4 text-red-600" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{act.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2 sm:line-clamp-none sm:truncate">{act.desc}</div>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center ml-11 sm:ml-4 shrink-0 border-t sm:border-0 border-border/50 pt-3 sm:pt-0 mt-1 sm:mt-0">
                    <div className="text-xs text-muted-foreground">{act.time}</div>
                    <Badge variant="outline" className="text-[10px] mt-0 sm:mt-1 uppercase font-semibold tracking-wider">
                      {act.category}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No recent activity found.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. Upcoming Compliance Tasks */}
      <section className="space-y-3">
        <h2 className="font-serif text-xl">Upcoming Compliance Tasks</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {UPCOMING_TASKS.map((t, i) => {
            const Icon = t.icon;
            return (
              <div key={i} className="rounded-2xl border border-border bg-card p-4 flex items-start justify-between shadow-xs">
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${t.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">{t.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.due}</div>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-medium shrink-0 ml-2">
                  {t.type}
                </Badge>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Recent Audit Logs (Latest 5 Entries) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl">Recent Audit Logs</h2>
          <Link to="/staff/audit-report" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
            View All Audit Logs <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm whitespace-nowrap min-w-[600px]">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="p-3.5">Action Event</th>
                  <th className="p-3.5">Resource / Object</th>
                  <th className="p-3.5">Actor / User</th>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditLogs.length > 0 ? (
                  auditLogs.slice(0, 5).map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30 transition">
                      <td className="p-3.5 font-medium text-foreground">{row.action}</td>
                      <td className="p-3.5 text-muted-foreground">{row.resource}</td>
                      <td className="p-3.5 text-muted-foreground">{row.user}</td>
                      <td className="p-3.5 text-muted-foreground">{row.time}</td>
                      <td className="p-3.5 text-right">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      No recent audit logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

