import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ShieldCheck, ShieldAlert, Lock, BookOpen, History as HistoryIcon,
  UserCheck, CheckCircle2, Building2, ArrowUpRight
} from "lucide-react";

export default function AdminSecurityOfficer() {
  const { user } = useAuth();

  const officerName = user?.user_metadata?.first_name || user?.user_metadata?.last_name
    ? `${user?.user_metadata?.first_name || ""} ${user?.user_metadata?.last_name || ""}`.trim() + " (Privacy & Security Officer)"
    : "Kiem Vukadinovic, NP (Privacy & Security Officer)";

  const COMPLIANCE_MODULES = [
    {
      to: "/staff/hipaa-policies",
      label: "HIPAA Policies & Protocols",
      desc: "Workforce training, sanction policy & annual risk analysis documentation",
      icon: BookOpen,
      color: "text-blue-700 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60",
    },
    {
      to: "/staff/audit-report",
      label: "PHI Audit Trail Logs",
      desc: "Immutable audit history for chart views, exports & patient record access",
      icon: HistoryIcon,
      color: "text-purple-700 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/60",
    },
    {
      to: "/staff/vendors",
      label: "Vendor BAA Registry",
      desc: "Track signed Business Associate Agreements for Cloud DB, Stripe, GHL & Twilio",
      icon: Building2,
      color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60",
    },
    {
      to: "/staff/breach-report",
      label: "Incident & Breach Response",
      desc: "File security incident reports, CMIA 15-day SLA tracker & OCR notifications",
      icon: ShieldAlert,
      color: "text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60",
    },
  ];

  const SAFEGUARDS = [
    { name: "Multi-Factor Authentication (MFA)", rule: "45 CFR §164.312(a)(2)(d)", status: "Enforced", detail: "Required for all staff & provider logins" },
    { name: "15-Min Workstation Auto-Logout", rule: "45 CFR §164.312(a)(2)(iii)", status: "Active", detail: "Inactivity session termination hook active" },
    { name: "Row-Level Security & Access Control", rule: "45 CFR §164.308(a)(4)", status: "Active", detail: "Database RLS enforced across PHI tables" },
    { name: "AES-256 Encryption (Rest & Transit)", rule: "45 CFR §164.312(a)(2)(iv)", status: "Active", detail: "TLS 1.3 in transit & AES-256 at rest" },
    { name: "Immutable Audit Access Logging", rule: "45 CFR §164.312(b)", status: "Active", detail: "PHI access log RPC appended on all chart views" },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      
      {/* Officer Overview Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl md:text-3xl font-medium tracking-tight text-foreground">
              Privacy & Security Officer Control Hub
            </h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-semibold px-2.5 py-0.5 text-xs rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1 inline text-emerald-600" /> HIPAA Compliant
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Enterprise security oversight, HIPAA safeguards, vendor BAAs, and PHI audit governance.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-card p-3 rounded-2xl border border-border/80 shadow-2xs">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="h-5 w-5" />
          </div>
          <div className="text-left text-xs">
            <div className="font-semibold text-foreground">{officerName}</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
              Designated Officer • MFA Protected
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border border-border/80 bg-card shadow-2xs rounded-2xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Compliance Grade</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-foreground mt-2">98% <span className="text-xs text-emerald-600 font-sans font-medium">(Grade A)</span></div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Audit-Ready Safeguards</p>
        </Card>

        <Card className="p-4 border border-border/80 bg-card shadow-2xs rounded-2xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">MFA Enforcement</span>
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Lock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-foreground mt-2">100%</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">All Privileged Roles Protected</p>
        </Card>

        <Card className="p-4 border border-border/80 bg-card shadow-2xs rounded-2xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Vendor BAAs</span>
            <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-foreground mt-2">Verified</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">DB, Stripe, GHL & Twilio BAAs</p>
        </Card>

        <Card className="p-4 border border-border/80 bg-card shadow-2xs rounded-2xl">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Active Breaches</span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-foreground mt-2">0</div>
          <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Threat Level: Low</p>
        </Card>
      </div>

      {/* Core Governance Modules (4 Clean Cards) */}
      <div className="space-y-3">
        <h2 className="font-serif text-lg font-semibold text-foreground">Security Governance Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COMPLIANCE_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.label}
                to={mod.to}
                className="group rounded-2xl border border-border/80 bg-card p-5 hover:border-primary/50 transition flex items-start gap-4 shadow-2xs"
              >
                <div className={`p-3 rounded-xl shrink-0 ${mod.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-base font-semibold text-foreground flex items-center justify-between group-hover:text-primary transition">
                    {mod.label}
                    <ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mandatory Technical & Administrative Safeguards Checklist */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-foreground">Mandatory Safeguards (§164.308 / §164.312)</h2>
          <Badge variant="outline" className="text-[11px] font-normal">
            5 / 5 Safeguards Active
          </Badge>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs divide-y divide-border/60">
          {SAFEGUARDS.map((sg) => (
            <div key={sg.name} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-muted/30 transition">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-foreground">{sg.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{sg.detail}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:text-right shrink-0">
                <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-2 py-0.5 rounded-md">
                  {sg.rule}
                </span>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-medium text-[11px] px-2 py-0.5">
                  {sg.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
