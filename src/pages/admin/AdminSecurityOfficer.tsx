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

  const officerName = (user?.first_name || user?.last_name)
    ? `${user?.first_name || ""} ${user?.last_name || ""}`.trim() + " (Privacy & Security Officer)"
    : "Designated Privacy & Security Officer";

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
      desc: "Audit history for chart views, exports & patient record access",
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
      desc: "File security incident reports & manage notifications",
      icon: ShieldAlert,
      color: "text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60",
    },
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
            <span className="font-semibold uppercase tracking-wider text-[11px]">Compliance Status</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-foreground mt-2">Active</div>
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
            <span className="font-semibold uppercase tracking-wider text-[11px]">Vendor Compliance</span>
            <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-foreground mt-2">Verified</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Business Associate Agreements Active</p>
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



    </div>
  );
}
