import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ShieldCheck, ShieldAlert, Lock, BookOpen, History as HistoryIcon,
  Laptop, Building2, UserCheck, CheckCircle2, AlertTriangle, FileText,
  Activity, Bell, Server, Database, Key, Eye, Clock, Calendar, CheckSquare,
  AlertCircle, ArrowUpRight, Search, RefreshCw, Layers, ShieldX
} from "lucide-react";

import AdminHipaaPolicies from "@/pages/admin/AdminHipaaPolicies";
import AdminVendors from "@/pages/admin/AdminVendors";
import StaffBreachReport from "@/pages/staff/StaffBreachReport";

export default function AdminSecurityOfficer() {
  const { isPrivacyOfficer, user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // Today's Compliance Tasks State
  const [tasks, setTasks] = useState([
    { id: 1, text: "Review updated Workstation & Device Disposal Policy v4.0", due: "Due Today", completed: false, category: "Policy" },
    { id: 2, text: "Verify signed BAA renewal for Lovable Cloud Database Host", due: "Completed", completed: true, category: "Vendor BAA" },
    { id: 3, text: "Audit 2 new staff members pending annual HIPAA Security Awareness training", due: "Overdue (2 Days)", completed: false, category: "Training" },
    { id: 4, text: "Conduct monthly PHI chart access log audit (§164.312)", due: "Completed", completed: true, category: "Audit" },
    { id: 5, text: "Validate automated PostgreSQL snapshot & 0 data loss restore test log", due: "Completed", completed: true, category: "Backup" },
  ]);

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    toast.success("Compliance task status updated");
  };

  const officerName = user?.user_metadata?.first_name || user?.user_metadata?.last_name
    ? `${user?.user_metadata?.first_name || ""} ${user?.user_metadata?.last_name || ""}`.trim() + " (Privacy & Security Officer)"
    : user?.email
    ? `${user.email} (Privacy & Security Officer)`
    : "Dr. Kiem (Privacy & Security Officer)";

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

      {/* ── Main SOC Navigation Tabs ──────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto bg-muted/60 p-1 rounded-xl gap-1 border border-border">
          <TabsTrigger value="overview" className="gap-2 text-xs rounded-lg">
            <Activity className="h-3.5 w-3.5" /> Security Monitoring Overview
          </TabsTrigger>
          <TabsTrigger value="policies" className="gap-2 text-xs rounded-lg">
            <BookOpen className="h-3.5 w-3.5" /> HIPAA Policy Approvals
          </TabsTrigger>
          <TabsTrigger value="incidents" className="gap-2 text-xs rounded-lg">
            <ShieldAlert className="h-3.5 w-3.5" /> Incident & Breach Response
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2 text-xs rounded-lg">
            <Laptop className="h-3.5 w-3.5" /> Device & Vendor Compliance
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: SECURITY MONITORING OVERVIEW (SOC DASHBOARD HOME)
           ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="mt-6 space-y-6">

          {/* 1. Security Overview KPI Cards Grid (6 Cards) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <Card className="p-3.5 border-border bg-card shadow-xs hover:border-emerald-500/40 transition">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Compliance Score</span>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-serif font-semibold text-foreground">94%</div>
              <div className="text-[10px] text-emerald-600 mt-1 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Audit Ready Status
              </div>
            </Card>

            <Card className="p-3.5 border-border bg-card shadow-xs hover:border-amber-500/40 transition">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Security Alerts</span>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-serif font-semibold text-foreground">2 Active</div>
              <div className="text-[10px] text-amber-600 mt-1 font-medium">1 High / 1 Low Priority</div>
            </Card>

            <Card className="p-3.5 border-border bg-card shadow-xs hover:border-sky-500/40 transition">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Open Incidents</span>
                <ShieldAlert className="h-4 w-4 text-sky-500" />
              </div>
              <div className="text-2xl font-serif font-semibold text-foreground">1 Active</div>
              <div className="text-[10px] text-sky-600 mt-1 font-medium">0 Critical Breaches</div>
            </Card>

            <Card className="p-3.5 border-border bg-card shadow-xs hover:border-indigo-500/40 transition">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Failed Logins</span>
                <Lock className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-serif font-semibold text-foreground">0 Critical</div>
              <div className="text-[10px] text-emerald-600 mt-1 font-medium">100% MFA Protected</div>
            </Card>

            <Card className="p-3.5 border-border bg-card shadow-xs hover:border-primary/40 transition">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Policy Reviews</span>
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-serif font-semibold text-foreground">1 Pending</div>
              <div className="text-[10px] text-muted-foreground mt-1 font-medium">7 Approved Policies</div>
            </Card>

            <Card className="p-3.5 border-border bg-card shadow-xs hover:border-emerald-500/40 transition">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Device Security</span>
                <Laptop className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-serif font-semibold text-foreground">100%</div>
              <div className="text-[10px] text-emerald-600 mt-1 font-medium">FDE BitLocker/FileVault</div>
            </Card>
          </div>

          {/* 2 Grid Columns: Left Column (Tasks, Alerts Feed, Incident Summary) & Right Column (Notifications, Audit, Risk, DR) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left Column (Span 2) */}
            <div className="lg:col-span-2 space-y-6">

              {/* 2. Today's Compliance Tasks */}
              <Card className="p-5 border-border bg-card shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="font-serif text-lg font-medium flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-primary" /> Today's Compliance & Security Tasks
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Mandatory daily governance items for Privacy & Security Officer sign-off.</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{tasks.filter(t => t.completed).length} / {tasks.length} Completed</Badge>
                </div>

                <div className="space-y-2.5">
                  {tasks.map((task) => (
                    <div key={task.id} className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${task.completed ? "bg-muted/20 border-border/60 opacity-80" : "bg-card border-border hover:border-primary/40"}`}>
                      <div className="flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleTask(task.id)}
                          className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className={`text-xs font-medium ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {task.text}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">{task.category}</Badge>
                            <span className={`text-[10px] ${task.due.includes("Overdue") ? "text-rose-500 font-semibold" : task.due === "Completed" ? "text-emerald-600" : "text-amber-600"}`}>
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
              </Card>

              {/* 3. Recent Security Alerts Feed (Detailed Security Table) */}
              <Card className="p-5 border-border bg-card shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="font-serif text-lg font-medium flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-amber-500" /> Recent Security Alerts & Threat Intelligence
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Real-time WAF firewall events, authentication anomalies, and encryption logs.</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toast.info("Security Feed Refreshing...")}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                  </Button>
                </div>

                <div className="rounded-xl border border-border overflow-hidden bg-card">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                      <tr>
                        <th className="p-3">Alert Type</th>
                        <th className="p-3">Target / Source</th>
                        <th className="p-3">Severity</th>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr className="hover:bg-muted/30 transition">
                        <td className="p-3 font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <ShieldX className="h-3.5 w-3.5 text-rose-500" />
                            <span>Unrecognized IP Access Attempt</span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">192.168.1.105 (WAF Blocked)</td>
                        <td className="p-3"><Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30 text-[10px]" variant="outline">High</Badge></td>
                        <td className="p-3 text-muted-foreground">12 mins ago</td>
                        <td className="p-3 text-right text-emerald-600 font-medium">Blocked</td>
                      </tr>
                      <tr className="hover:bg-muted/30 transition">
                        <td className="p-3 font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5 text-amber-500" />
                            <span>MFA Challenge Retry Limit</span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">user_staff_04@gmail.com</td>
                        <td className="p-3"><Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px]" variant="outline">Medium</Badge></td>
                        <td className="p-3 text-muted-foreground">42 mins ago</td>
                        <td className="p-3 text-right text-amber-600 font-medium">Verified</td>
                      </tr>
                      <tr className="hover:bg-muted/30 transition">
                        <td className="p-3 font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <Eye className="h-3.5 w-3.5 text-sky-500" />
                            <span>After-Hours PHI Access Query</span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">Dr. Kiem (Chart #1042)</td>
                        <td className="p-3"><Badge className="bg-sky-500/15 text-sky-700 border-sky-500/30 text-[10px]" variant="outline">Low</Badge></td>
                        <td className="p-3 text-muted-foreground">2 hours ago</td>
                        <td className="p-3 text-right text-emerald-600 font-medium">Authorized</td>
                      </tr>
                      <tr className="hover:bg-muted/30 transition">
                        <td className="p-3 font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <Laptop className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Workstation Encryption Audit</span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">Workstation-03 (BitLocker)</td>
                        <td className="p-3"><Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]" variant="outline">Passed</Badge></td>
                        <td className="p-3 text-muted-foreground">4 hours ago</td>
                        <td className="p-3 text-right text-emerald-600 font-medium">Compliant</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* 4. Incident Management Summary */}
              <Card className="p-5 border-border bg-card shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="font-serif text-lg font-medium flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-rose-500" /> Incident Management & Breach Overview
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">HIPAA Breach Notification Rule §164.400 tracking matrix.</p>
                  </div>
                  <Button variant="default" size="sm" className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5" onClick={() => setActiveTab("incidents")}>
                    <ShieldAlert className="h-3.5 w-3.5" /> Open Incident Manager
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-xl border border-border bg-muted/20">
                    <div className="text-xs text-muted-foreground">Open Incidents</div>
                    <div className="text-xl font-bold font-serif text-foreground mt-1">0</div>
                  </div>
                  <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
                    <div className="text-xs text-amber-700 font-semibold">Investigating</div>
                    <div className="text-xl font-bold font-serif text-amber-700 mt-1">1</div>
                  </div>
                  <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                    <div className="text-xs text-emerald-700 font-semibold">Resolved (2025)</div>
                    <div className="text-xl font-bold font-serif text-emerald-700 mt-1">14</div>
                  </div>
                  <div className="p-3 rounded-xl border border-border bg-muted/20">
                    <div className="text-xs text-muted-foreground">Critical Breaches</div>
                    <div className="text-xl font-bold font-serif text-foreground mt-1">0</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Active Investigation: <strong>#INC-2025-08</strong> (Suspicious email phishing report — Pending Workstation Malware Scan)</span>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => setActiveTab("incidents")}>View Investigation</Button>
                </div>
              </Card>

            </div>

            {/* Right Column (Span 1) */}
            <div className="space-y-6">

              {/* 5. High-Priority Notifications & Security Panel */}
              <Card className="p-5 border-border bg-card shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-serif text-base font-medium flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" /> Security Notifications
                  </h3>
                  <Badge variant="outline" className="text-[10px]">3 New</Badge>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-1">
                    <div className="flex items-center justify-between font-semibold text-rose-800 dark:text-rose-300">
                      <span className="flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> High Priority Alert</span>
                      <span className="text-[10px] opacity-75">12m ago</span>
                    </div>
                    <p className="text-rose-700/90 dark:text-rose-200 text-[11px]">Web Application Firewall blocked unauthorized IP `192.168.1.105` attempting login brute-force.</p>
                  </div>

                  <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-1">
                    <div className="flex items-center justify-between font-semibold text-amber-800 dark:text-amber-300">
                      <span className="flex items-center gap-1.5"><Laptop className="h-3.5 w-3.5" /> IT Inventory Notice</span>
                      <span className="text-[10px] opacity-75">2h ago</span>
                    </div>
                    <p className="text-amber-700/90 dark:text-amber-200 text-[11px]">New workstation `FrontDesk-MacBook-02` registered. Encryption key validation required.</p>
                  </div>

                  <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-1">
                    <div className="flex items-center justify-between font-semibold text-emerald-800 dark:text-emerald-300">
                      <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Vendor BAA Auto-Renewed</span>
                      <span className="text-[10px] opacity-75">1d ago</span>
                    </div>
                    <p className="text-emerald-700/90 dark:text-emerald-200 text-[11px]">Signed BAA for Twilio SMS Pipeline auto-renewed for 2026–2027.</p>
                  </div>
                </div>
              </Card>

              {/* 6. Vendor & Device Security Quick Summary */}
              <Card className="p-5 border-border bg-card shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-serif text-base font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-sky-600" /> Vendor & Device Status
                  </h3>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveTab("inventory")}>Details →</Button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between text-muted-foreground mb-1">
                      <span>Vendor BAA Coverage</span>
                      <span className="font-semibold text-foreground">5 / 5 Signed (100%)</span>
                    </div>
                    <Progress value={100} className="h-1.5 bg-muted" />
                  </div>

                  <div>
                    <div className="flex justify-between text-muted-foreground mb-1">
                      <span>Device Encryption Rate</span>
                      <span className="font-semibold text-foreground">4 / 4 Encrypted (100%)</span>
                    </div>
                    <Progress value={100} className="h-1.5 bg-muted" />
                  </div>

                  <div className="pt-2 border-t border-border grid grid-cols-2 gap-2 text-center text-[11px]">
                    <div className="p-2 rounded-lg bg-muted/30 border border-border">
                      <div className="text-muted-foreground">Expiring BAAs</div>
                      <div className="font-bold text-foreground mt-0.5">0</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30 border border-border">
                      <div className="text-muted-foreground">Pending Devices</div>
                      <div className="font-bold text-foreground mt-0.5">0</div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 7. Risk Level & Disaster Recovery Overview */}
              <Card className="p-5 border-border bg-card shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-serif text-base font-medium flex items-center gap-2">
                    <Server className="h-4 w-4 text-emerald-600" /> Risk & Disaster Recovery
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">Overall Risk Level:</span>
                    <Badge className="bg-emerald-600 text-white font-bold">LOW RISK</Badge>
                  </div>

                  <div className="space-y-1 text-muted-foreground text-[11px]">
                    <div className="flex justify-between">
                      <span>Last Risk Assessment:</span>
                      <strong className="text-foreground">2025-06-15 (SRA Tool)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Database Snapshot:</span>
                      <strong className="text-foreground">Today, 15:00 UTC</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Annual DR Test Restore:</span>
                      <strong className="text-emerald-600 font-semibold">Passed (0 Data Loss)</strong>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 8. Audit Log Activity Stream */}
              <Card className="p-5 border-border bg-card shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="font-serif text-base font-medium flex items-center gap-2">
                    <HistoryIcon className="h-4 w-4 text-primary" /> PHI & System Audit Log
                  </h3>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-0.5">
                    <div className="font-medium text-foreground flex items-center justify-between">
                      <span>PHI Chart Query</span>
                      <span className="text-[10px] text-muted-foreground font-mono">15:42:10</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">Dr. Kiem viewed chart notes for client Sarah M.</div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-0.5">
                    <div className="font-medium text-foreground flex items-center justify-between">
                      <span>Policy Draft Saved</span>
                      <span className="text-[10px] text-muted-foreground font-mono">14:10:00</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">Workforce Sanction Policy v2.0 draft updated.</div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-0.5">
                    <div className="font-medium text-foreground flex items-center justify-between">
                      <span>Admin Session Authenticated</span>
                      <span className="text-[10px] text-muted-foreground font-mono">09:15:22</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">Privileged MFA session established (aal2).</div>
                  </div>
                </div>
              </Card>

            </div>

          </div>

          {/* ── 9. Secondary Operational Schedule Overview (At Bottom as Requested) ── */}
          <Card className="p-5 border-border bg-card/60 shadow-xs space-y-3 mt-8">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-serif text-base font-medium flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 text-muted-foreground" /> Clinic Operational Schedule & Secondary Booking Overview
                </h3>
                <p className="text-[11px] text-muted-foreground">Secondary operational reference for Officer awareness (Primary monitoring is focused on HIPAA Security & Governance).</p>
              </div>
              <Link to="/staff/calendar">
                <Button variant="outline" size="sm" className="h-7 text-xs">Open Full Calendar →</Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-border bg-muted/30 flex items-center justify-between">
                <div>
                  <div className="text-muted-foreground text-[11px]">Today's Appointments</div>
                  <div className="text-base font-bold text-foreground mt-0.5">12 Appointments</div>
                </div>
                <Badge variant="outline">Schedule Active</Badge>
              </div>

              <div className="p-3 rounded-xl border border-border bg-muted/30 flex items-center justify-between">
                <div>
                  <div className="text-muted-foreground text-[11px]">Pending Booking Requests</div>
                  <div className="text-base font-bold text-foreground mt-0.5">2 Requests</div>
                </div>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">Pending Review</Badge>
              </div>

              <div className="p-3 rounded-xl border border-border bg-muted/30 flex items-center justify-between">
                <div>
                  <div className="text-muted-foreground text-[11px]">On-Duty Providers</div>
                  <div className="text-base font-bold text-foreground mt-0.5">3 Staff On Shift</div>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Checked In</Badge>
              </div>
            </div>
          </Card>

        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: POLICY APPROVALS HUB
           ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="policies" className="mt-6">
          <AdminHipaaPolicies />
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 3: INCIDENT & BREACH RESPONSE
           ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="incidents" className="mt-6">
          <StaffBreachReport />
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 4: DEVICE & VENDOR COMPLIANCE
           ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="inventory" className="mt-6">
          <AdminVendors />
        </TabsContent>

      </Tabs>
    </div>
  );
}


