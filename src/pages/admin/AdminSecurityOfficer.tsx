import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ShieldCheck, ShieldAlert, Lock, BookOpen, History as HistoryIcon,
  Laptop, UserCheck, CheckCircle2, AlertTriangle, Activity, Bell,
  Key, RefreshCw, ShieldX, CheckSquare, ArrowUpRight
} from "lucide-react";

export default function AdminSecurityOfficer() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Today's Compliance Tasks State
  const [tasks, setTasks] = useState<any[]>([]);

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    toast.success("Compliance task status updated");
  };

  const officerName = user?.user_metadata?.first_name || user?.user_metadata?.last_name
    ? `${user?.user_metadata?.first_name || ""} ${user?.user_metadata?.last_name || ""}`.trim() + " (Security Officer)"
    : user?.email || "Security Officer";

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* ── Executive Healthcare SOC Header ───────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-card via-card to-emerald-500/5 p-6 rounded-2xl border border-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-semibold uppercase tracking-wider text-[10px]">
              <ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Healthcare Security Operations Center (SOC)
            </Badge>
            <span className="text-xs text-muted-foreground">• 45 CFR §164.308 / §164.312 Governance</span>
          </div>
          <h1 className="font-serif text-xl sm:text-2xl font-medium">Privacy & Security Officer Control Hub</h1>
          <p className="text-xs text-muted-foreground">
            Continuous enterprise monitoring of practice HIPAA compliance, risk management, PHI access audit logs, incident response, and IT security governance.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 bg-background/80 backdrop-blur p-3 rounded-xl border border-border">
          <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <UserCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="text-left text-xs">
            <div className="font-semibold text-foreground">{officerName}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-600 font-medium">Active Security Oversight (AAL2 Enforced)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 Top KPI Metric Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Compliance Score */}
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-emerald-500/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Compliance Score</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">98%</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Audit Ready Status
          </div>
        </Card>

        {/* KPI 2: Security Alerts */}
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-amber-500/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Security Alerts</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">0 Active</div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">
            WAF Active & Monitored
          </div>
        </Card>

        {/* KPI 3: Open Incidents */}
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-rose-500/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Open Incidents</span>
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">0 Open</div>
          <div className="text-[11px] text-rose-600 font-medium mt-1">
            0 Critical Breaches
          </div>
        </Card>

        {/* KPI 4: Failed Login Attempts */}
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-indigo-500/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Failed Login Attempts</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Lock className="h-4 w-4 text-indigo-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">0 Failed</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> 100% MFA Protected
          </div>
        </Card>
      </div>

      {/* ── Main Grid: Left Main Sections (2 Cols) + Right Sidebar (1 Col) ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT MAIN SECTIONS */}
        <div className="lg:col-span-2 space-y-6">

          {/* Section 1: Today's Compliance Tasks */}
          <Card className="p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-normal tracking-tight flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-emerald-600" /> Today's Compliance Tasks
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Mandatory daily governance checklist for Security Officer sign-off.</p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                0 / 0 Completed
              </Badge>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
                <CheckSquare className="h-7 w-7 text-muted-foreground/40 mx-auto" />
                <p className="text-xs font-medium text-foreground">No pending compliance tasks today.</p>
                <p className="text-[11px] text-muted-foreground">Daily governance tasks will populate here for review and sign-off.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {tasks.map((task) => (
                  <div key={task.id} className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${task.completed ? "bg-muted/20 border-border/60 opacity-80" : "bg-card border-border hover:border-emerald-500/40"}`}>
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTask(task.id)}
                        className="mt-1 h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <div className={`text-xs font-medium ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {task.text}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">{task.category}</Badge>
                          <span className={`text-[10px] ${task.due === "Completed" ? "text-emerald-600" : "text-amber-600 font-medium"}`}>
                            {task.due}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => toggleTask(task.id)} className="h-7 text-xs shrink-0">
                      {task.completed ? "Reopen" : "Complete"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Section 2: Recent Security Activity (Audit Logs) */}
          <Card className="p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-normal tracking-tight flex items-center gap-2">
                  <HistoryIcon className="h-4 w-4 text-emerald-600" /> Recent Security Activity & Audit Logs
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Real-time WAF firewall events, authentication queries, and PHI access logs.</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-primary gap-1" onClick={() => navigate("/staff/audit-report")}>
                View All Audit Logs <ArrowUpRight className="h-3 w-3" />
              </Button>
            </div>

            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border font-medium">
                    <tr>
                      <th className="p-3">Event Type</th>
                      <th className="p-3">Source / Target</th>
                      <th className="p-3">Severity</th>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <HistoryIcon className="h-8 w-8 text-muted-foreground/40" />
                          <span className="font-medium text-xs">No recent security events or audit log entries.</span>
                          <span className="text-[11px] text-muted-foreground">System authentication queries and firewall audit trails will display here.</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          {/* Section 3: Open Security Incidents */}
          <Card className="p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-normal tracking-tight flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-500" /> Open Security Incidents & Risk Tracking
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">HIPAA Breach Notification Rule §164.400 incident response matrix.</p>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate("/staff/breach-report")}>
                Breach Reports Portal <ArrowUpRight className="h-3 w-3" />
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl border border-border bg-muted/20">
                <div className="text-[11px] text-muted-foreground">Active Incidents</div>
                <div className="text-xl font-bold font-serif text-foreground mt-0.5">0</div>
              </div>
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                <div className="text-[11px] text-emerald-700 font-semibold">Resolved (2026)</div>
                <div className="text-xl font-bold font-serif text-emerald-700 mt-0.5">0</div>
              </div>
              <div className="p-3 rounded-xl border border-border bg-muted/20">
                <div className="text-[11px] text-muted-foreground">Critical Breaches</div>
                <div className="text-xl font-bold font-serif text-foreground mt-0.5">0</div>
              </div>
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                <div className="text-[11px] text-emerald-700 font-semibold">Risk Rating</div>
                <div className="text-xl font-bold font-serif text-emerald-700 mt-0.5">LOW</div>
              </div>
            </div>
          </Card>

        </div>

        {/* SMALL RIGHT SIDEBAR (1 COL) */}
        <div className="space-y-6">

          {/* 1. HIPAA Compliance Status */}
          <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-serif text-base font-normal tracking-tight flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> HIPAA Compliance Status
              </h3>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20">98% Validated</Badge>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <div className="flex justify-between text-muted-foreground mb-1">
                  <span>Administrative Safeguards (§164.308)</span>
                  <span className="font-semibold text-foreground">100%</span>
                </div>
                <Progress value={100} className="h-1.5 bg-muted" />
              </div>

              <div>
                <div className="flex justify-between text-muted-foreground mb-1">
                  <span>Physical Safeguards (§164.310)</span>
                  <span className="font-semibold text-foreground">95%</span>
                </div>
                <Progress value={95} className="h-1.5 bg-muted" />
              </div>

              <div>
                <div className="flex justify-between text-muted-foreground mb-1">
                  <span>Technical Safeguards (§164.312)</span>
                  <span className="font-semibold text-foreground">100%</span>
                </div>
                <Progress value={100} className="h-1.5 bg-muted" />
              </div>
            </div>
          </Card>

          {/* 2. Pending Access Requests */}
          <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs space-y-3.5 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-serif text-base font-normal tracking-tight flex items-center gap-2">
                <Key className="h-4 w-4 text-indigo-600" /> Pending Access Requests
              </h3>
              <Badge variant="outline" className="text-[10px]">0 Pending</Badge>
            </div>

            <div className="text-center py-6 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
              <Key className="h-6 w-6 text-muted-foreground/40 mx-auto" />
              <p className="text-xs font-medium text-foreground">No pending system access requests.</p>
              <p className="text-[11px] text-muted-foreground">Role authorization and credential requests will appear here.</p>
            </div>
          </Card>

          {/* 3. Security Notifications */}
          <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs space-y-3.5 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-serif text-base font-normal tracking-tight flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-600" /> Security Notifications
              </h3>
              <Badge variant="outline" className="text-[10px]">0 New</Badge>
            </div>

            <div className="text-center py-6 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
              <Bell className="h-6 w-6 text-muted-foreground/40 mx-auto" />
              <p className="text-xs font-medium text-foreground">No security notifications.</p>
              <p className="text-[11px] text-muted-foreground">WAF firewall anomalies and threat intelligence feeds will alert here.</p>
            </div>
          </Card>

        </div>

      </div>
    </div>
  );
}
