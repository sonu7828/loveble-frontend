import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ShieldCheck, ShieldAlert, AlertTriangle, BookOpen, History as HistoryIcon,
  UserCheck, CheckCircle2, Lock, Bell, Eye, Clock, Users, ArrowUpRight,
  RefreshCw, Check, X, ShieldX, FileText, UserPlus
} from "lucide-react";

export default function AdminSecurityOfficer() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Access Requests State
  const [accessRequests, setAccessRequests] = useState([
    { id: "AR-101", user: "Nurse Sarah Jenkins", role: "Nurse Practitioner", requested: "Chart Edit & E-Prescribe", date: "10 mins ago" },
    { id: "AR-102", user: "Maria Gonzalez", role: "Receptionist", requested: "Client Financial Export", date: "1 hour ago" },
    { id: "AR-103", user: "Dr. Kamaren Manzano", role: "Medical Director", requested: "Audit Log Export Access", date: "3 hours ago" },
  ]);

  const handleAccess = (id: string, action: "approve" | "reject") => {
    setAccessRequests(prev => prev.filter(r => r.id !== id));
    toast.success(`Access request ${id} ${action === "approve" ? "approved" : "declined"}`);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      toast.success("Security metrics & logs updated");
    }, 600);
  };

  const officerName = user?.user_metadata?.first_name || user?.user_metadata?.last_name
    ? `${user?.user_metadata?.first_name || ""} ${user?.user_metadata?.last_name || ""}`.trim() + " (Security Officer)"
    : user?.email || "Security Officer";

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* ── Page Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-xl sm:text-2xl font-medium tracking-tight">Security Operations Hub</h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium px-2.5 py-0.5 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> HIPAA Verified (§164.308)
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time healthcare security monitoring, PHI audit logs, incident response, and access control.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-card text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-muted-foreground font-medium">{officerName}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="h-9 rounded-xl text-xs gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* ── Top 4 Summary Cards Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Compliance Score */}
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-emerald-500/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Compliance Score</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">96%</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Audit-ready status (§164.312)
          </div>
        </Card>

        {/* 2. Open Incidents */}
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-amber-500/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Open Incidents</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">1 Active</div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">
            0 Critical breaches • 1 Under review
          </div>
        </Card>

        {/* 3. Security Alerts */}
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-rose-500/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Security Alerts</span>
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">2 Active</div>
          <div className="text-[11px] text-rose-600 font-medium mt-1">
            1 High threat • 1 Medium notice
          </div>
        </Card>

        {/* 4. Pending Access Requests */}
        <Card className="p-4 border border-border bg-card shadow-xs hover:border-primary/30 transition rounded-xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Pending Access Requests</span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-medium text-foreground">{accessRequests.length} Pending</div>
          <div className="text-[11px] text-muted-foreground font-medium mt-1">
            Requires Privacy Officer review
          </div>
        </Card>
      </div>

      {/* ── Main Content Grid: Left Main Sections (2 Cols) + Right Sidebar (1 Col) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT MAIN SECTIONS ────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Section 1: Recent Security Activity (Audit Logs) */}
          <Card className="p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-normal tracking-tight flex items-center gap-2">
                  <HistoryIcon className="h-4 w-4 text-primary" /> Recent Security Activity & PHI Audit Logs
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Continuous immutable logging of chart views, logins, and permission checks.</p>
              </div>
              <Badge variant="outline" className="text-[10px] font-medium">Real-Time Feed</Badge>
            </div>

            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border font-medium">
                    <tr>
                      <th className="p-3">User / Actor</th>
                      <th className="p-3">Action Details</th>
                      <th className="p-3">Source IP</th>
                      <th className="p-3">Time</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="hover:bg-muted/30 transition">
                      <td className="p-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <ShieldX className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                          <span>Unknown External Actor</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">Unrecognized IP login attempt (WAF Blocked)</td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">192.168.1.105</td>
                      <td className="p-3 text-muted-foreground">12m ago</td>
                      <td className="p-3 text-right"><Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]" variant="outline">Blocked</Badge></td>
                    </tr>
                    <tr className="hover:bg-muted/30 transition">
                      <td className="p-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Eye className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                          <span>Dr. Kamaren Manzano</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">Accessed PHI Chart Notes (#1042 — Sarah Jenkins)</td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">10.0.4.12</td>
                      <td className="p-3 text-muted-foreground">42m ago</td>
                      <td className="p-3 text-right"><Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]" variant="outline">Authorized</Badge></td>
                    </tr>
                    <tr className="hover:bg-muted/30 transition">
                      <td className="p-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>Nurse Practitioner Staff</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">MFA 2-Factor authentication retry challenge</td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">10.0.4.88</td>
                      <td className="p-3 text-muted-foreground">1h ago</td>
                      <td className="p-3 text-right"><Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]" variant="outline">Verified</Badge></td>
                    </tr>
                    <tr className="hover:bg-muted/30 transition">
                      <td className="p-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>System Admin</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">Exported PHI Access Audit Logs (§164.312)</td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">10.0.1.1</td>
                      <td className="p-3 text-muted-foreground">3h ago</td>
                      <td className="p-3 text-right"><Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]" variant="outline">Logged</Badge></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          {/* Section 2: Open Security Incidents */}
          <Card className="p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-normal tracking-tight flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600" /> Open Security Incidents & Investigations
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Active HIPAA breach cases, threat reports, and investigation logs.</p>
              </div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">1 Under Investigation</Badge>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-foreground">#INC-2026-08</span>
                      <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px]" variant="outline">Medium Priority</Badge>
                      <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/20 text-[10px]" variant="outline">Investigation Active</Badge>
                    </div>
                    <h3 className="text-xs font-semibold text-foreground">Phishing Email Suspicion — Front Desk Workstation</h3>
                    <p className="text-xs text-muted-foreground">
                      Suspicious email link clicked on workstation 02. Workstation isolated from network, full antivirus scan initiated. No PHI data leaked.
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">Reported 2h ago</span>
                </div>

                <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between gap-3 text-xs">
                  <span className="text-[11px] text-muted-foreground">Assigned Investigator: <strong>Security Officer</strong></span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg" onClick={() => toast.info("Incident details opened")}>View Log</Button>
                    <Button size="sm" className="h-7 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => toast.success("Incident marked resolved")}>Mark Resolved</Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>

        </div>

        {/* ── SMALL RIGHT SIDEBAR (1 COL) ──────────────────────────────────── */}
        <div className="space-y-6">

          {/* Sidebar Section 1: HIPAA Compliance Status */}
          <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-serif text-base font-normal tracking-tight flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> HIPAA Compliance
              </h3>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Compliant</Badge>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-muted-foreground mb-1">
                  <span>Policy Approval Rate</span>
                  <span className="font-semibold text-foreground">96%</span>
                </div>
                <Progress value={96} className="h-1.5 bg-muted" />
              </div>

              <div className="pt-2 space-y-2 text-[11px]">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Annual Staff HIPAA Training</span>
                  <span className="font-medium text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" /> 12/12 Completed</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Vendor BAA Agreements</span>
                  <span className="font-medium text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" /> 5/5 Signed</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Device Full-Disk Encryption</span>
                  <span className="font-medium text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" /> BitLocker Active</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Technical Safeguards §164.312</span>
                  <span className="font-medium text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" /> Verified</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Sidebar Section 2: Pending Access Requests */}
          <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-serif text-base font-normal tracking-tight flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" /> Access Requests
              </h3>
              <Badge variant="outline" className="text-[10px]">{accessRequests.length} Pending</Badge>
            </div>

            {accessRequests.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No pending access requests.</p>
            ) : (
              <div className="space-y-3 text-xs">
                {accessRequests.map((req) => (
                  <div key={req.id} className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-foreground">{req.user}</div>
                        <div className="text-[11px] text-muted-foreground">{req.role} • <span className="text-primary font-medium">{req.requested}</span></div>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{req.date}</span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10 px-2" onClick={() => handleAccess(req.id, "reject")}>
                        <X className="h-3.5 w-3.5 mr-1" /> Decline
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 px-2" onClick={() => handleAccess(req.id, "approve")}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Sidebar Section 3: Notifications */}
          <Card className="p-4 sm:p-5 border border-border bg-card shadow-xs space-y-3.5 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-serif text-base font-normal tracking-tight flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-600" /> Notifications
              </h3>
              <Badge variant="outline" className="text-[10px]">3 New</Badge>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1">
                <div className="flex items-center justify-between font-medium text-rose-700">
                  <span className="flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Firewall Threat Blocked</span>
                  <span className="text-[10px] opacity-75">12m ago</span>
                </div>
                <p className="text-muted-foreground text-[11px]">WAF blocked unauthorized IP `192.168.1.105` attempting login brute-force.</p>
              </div>

              <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
                <div className="flex items-center justify-between font-medium text-amber-700">
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Policy Renewal Notice</span>
                  <span className="text-[10px] opacity-75">2h ago</span>
                </div>
                <p className="text-muted-foreground text-[11px]">Annual workstation disposal policy (§164.310) due for Security Officer sign-off.</p>
              </div>

              <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                <div className="flex items-center justify-between font-medium text-emerald-700">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Vendor BAA Verified</span>
                  <span className="text-[10px] opacity-75">1d ago</span>
                </div>
                <p className="text-muted-foreground text-[11px]">Twilio SMS Business Associate Agreement verified for 2026–2027.</p>
              </div>
            </div>
          </Card>

        </div>

      </div>
    </div>
  );
}
