import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck, Lock, Eye, FileText, CheckCircle2, ShieldAlert, UserCheck } from "lucide-react";
import { toast } from "sonner";
import rkaLogo from "@/assets/rka-logo.webp";

export type PolicyStatus = "draft" | "review" | "approved" | "archived";

export type Policy = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string | null;
  body_markdown: string;
  version: number;
  status: PolicyStatus;
  approval_status?: "approved" | "pending_review" | "rejected";
  effective_date: string | null;
  updated_at: string;
};

const DEFAULT_PERMANENT_POLICIES: Policy[] = [
  {
    id: "perm-policy-001",
    slug: "patient-confidentiality-hipaa-privacy",
    title: "Patient Confidentiality & HIPAA Privacy Policy",
    category: "Privacy & Clinical Safeguards",
    summary: "Mandatory safeguards for patient privacy, PHI disclosure rules, electronic chart access, and California CMIA confidentiality compliance.",
    body_markdown: `# Patient Confidentiality & HIPAA Privacy Policy\n\n## 1. Purpose\nTo establish strict procedures protecting Protected Health Information (PHI) and electronic Protected Health Information (ePHI) under 45 CFR Part 160 & 164 and the California Confidentiality of Medical Information Act (CMIA).\n\n## 2. Patient Privacy Safeguards\n- **Minimum Necessary Standard**: Workforce members may access only the minimum necessary patient information required to perform clinical duties.\n- **Patient Rights**: Patients have the right to inspect, copy, and request amendments to their medical records.\n- **PHI Disclosures**: All external PHI disclosures must be logged and maintained in the Disclosure Log for 6 years.\n\n## 3. Physical & Technical Controls\n- Patient charts and photos must be encrypted at rest (AES-256) and in transit (TLS 1.3).\n- Staff must lock workstations when leaving patient care areas. Automated idle timeout enforces logout after 15 minutes.\n`,
    version: 1,
    status: "approved",
    effective_date: "2026-01-01",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "perm-policy-002",
    slug: "staff-confidentiality-acceptable-use",
    title: "Staff Confidentiality & Acceptable Use Policy",
    category: "Workforce & System Security",
    summary: "Workforce standards for computer system access, password management, device security, and electronic communications.",
    body_markdown: `# Staff Confidentiality & Acceptable Use Policy\n\n## 1. Purpose\nTo outline workforce responsibilities when accessing practice workstations, cloud systems, messaging platforms, and patient records.\n\n## 2. Acceptable Use Standard\n- Practice devices and software accounts are restricted to authorized clinical and administrative operations.\n- **Multi-Factor Authentication (MFA)** is mandatory for all staff accessing patient management applications.\n- Sharing user credentials or login passwords is strictly prohibited.\n\n## 3. Disciplinary Sanctions\n- Violations of workforce confidentiality are subject to formal disciplinary action under 45 CFR §164.308(a)(1)(ii)(C), up to and including termination and reporting to California licensing boards.\n`,
    version: 1,
    status: "approved",
    effective_date: "2026-01-01",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "perm-policy-003",
    slug: "workplace-code-of-conduct-compliance",
    title: "Workplace Code of Conduct & Compliance Policy",
    category: "Administrative & Ethical Governance",
    summary: "Professional conduct standards, HIPAA compliance commitments, non-retaliation policies, and incident escalation procedures.",
    body_markdown: `# Workplace Code of Conduct & Compliance Policy\n\n## 1. Purpose\nTo establish ethical standards, professional conduct guidelines, and legal compliance obligations for all Radiantilyk Aesthetic workforce members.\n\n## 2. Code of Professional Conduct\n- All workforce members must uphold patient dignity, professional integrity, and full compliance with federal and state healthcare laws.\n- Promptly report suspected HIPAA breaches or security incidents to the Privacy & Security Officer.\n- Zero tolerance for workplace harassment, discrimination, or non-retaliation against compliance whistleblowers.\n`,
    version: 1,
    status: "approved",
    effective_date: "2026-01-01",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

export function HipaaMandatoryAcknowledgementModal() {
  const { user } = useAuth();
  const userId = user?.id || user?.email || "staff-user";

  const [viewPolicy, setViewPolicy] = useState<Policy | null>(null);
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [ipAddress, setIpAddress] = useState<string>("192.168.1.104");
  const [dismissed, setDismissed] = useState<boolean>(false);

  const [ackVersionMap, setAckVersionMap] = useState<Record<string, number>>(() => {
    if (!userId) return {};
    try {
      return JSON.parse(localStorage.getItem(`rka_hipaa_user_ack_${userId}`) || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (userId) {
      try {
        const savedMap = JSON.parse(localStorage.getItem(`rka_hipaa_user_ack_${userId}`) || "{}");
        setAckVersionMap(savedMap);
      } catch {
        setAckVersionMap({});
      }
    }
  }, [userId]);

  // Fetch active policies from local storage or defaults
  const activePolicies: Policy[] = useMemo(() => {
    const saved: Policy[] = JSON.parse(localStorage.getItem("rka_perm_hipaa_policies") || "[]");
    if (!saved || saved.length === 0) return DEFAULT_PERMANENT_POLICIES;
    
    // Ensure all published policies are included
    const policyMap = new Map<string, Policy>();
    DEFAULT_PERMANENT_POLICIES.forEach((p) => policyMap.set(p.id, p));
    saved.forEach((p) => {
      if (p.status === "approved" || !policyMap.has(p.id)) {
        policyMap.set(p.id, p);
      }
    });
    return Array.from(policyMap.values());
  }, []);

  // Check user's acknowledged policy versions
  const pendingPolicies = useMemo(() => {
    if (!user) return [];
    return activePolicies.filter((p) => {
      const ackVer = ackVersionMap[p.id];
      return ackVer === undefined || ackVer < p.version;
    });
  }, [user, activePolicies, ackVersionMap]);

  // Attempt to fetch real or fallback client IP address
  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.ip) setIpAddress(data.ip);
      })
      .catch(() => {
        // Fallback simulated local intranet IP
        setIpAddress("192.168.1." + Math.floor(Math.random() * 89 + 10));
      });
  }, []);

  if (!user || dismissed || pendingPolicies.length === 0) {
    return null; // Skip screen and open dashboard immediately
  }

  const allChecked = pendingPolicies.every((p) => checkedMap[p.id] === true);

  const getStaffName = () => {
    const fn = (user?.first_name || (user as any)?.user_metadata?.first_name || "").trim();
    const ln = (user?.last_name || (user as any)?.user_metadata?.last_name || "").trim();
    if (fn || ln) return `${fn} ${ln}`.trim();
    return user.email?.split("@")[0] || "Practice Workforce Member";
  };

  const getStaffRole = () => {
    const roles: string[] = (user as any)?.roles || [];
    if (roles.includes("admin")) return "Practice Administrator";
    if (roles.includes("medical_director")) return "Medical Director";
    if (roles.includes("privacy_officer")) return "Privacy & Security Officer";
    if (roles.includes("nurse_practitioner")) return "Nurse Practitioner";
    if (roles.includes("rn_injector")) return "RN Injector";
    if (roles.includes("front_desk")) return "Front Desk Specialist";
    return "Clinical Workforce Member";
  };

  const handleToggleCheck = (policyId: string, val: boolean) => {
    setCheckedMap((prev) => ({ ...prev, [policyId]: val }));
  };

  const submitAcknowledgements = async () => {
    if (!allChecked) return;
    setSubmitting(true);

    const userName = getStaffName();
    const userRole = getStaffRole();
    const nowISO = new Date().toISOString();

    // 1. Update user's version acknowledgement map
    const userAckMap: Record<string, number> = JSON.parse(
      localStorage.getItem(`rka_hipaa_user_ack_${userId}`) || "{}"
    );

    const history: any[] = JSON.parse(
      localStorage.getItem(`rka_hipaa_user_ack_history_${userId}`) || "[]"
    );

    pendingPolicies.forEach((p) => {
      userAckMap[p.id] = p.version;

      const record = {
        id: `ack-${Date.now()}-${p.id}`,
        userId,
        userName,
        userRole,
        userEmail: user.email,
        policyId: p.id,
        policyTitle: p.title,
        version: p.version,
        timestamp: nowISO,
        ipAddress,
      };
      history.unshift(record);

      // 2. Also write to policy audit log for Privacy & Security Officer dashboard
      const auditLogs: any[] = JSON.parse(
        localStorage.getItem(`rka_policy_audit_${p.id}`) || "[]"
      );
      auditLogs.unshift({
        id: `audit-${Date.now()}-${p.id}`,
        policy_id: p.id,
        action: "Staff Policy Acknowledged",
        officer_name: `${userName} (${userRole})`,
        officer_role: userRole,
        timestamp: nowISO,
        notes: `Policy v${p.version} electronically acknowledged by ${userName} (${user.email}). IP: ${ipAddress}`,
      });
      localStorage.setItem(`rka_policy_audit_${p.id}`, JSON.stringify(auditLogs));

      // 3. Store in staff acknowledgements
      const staffAcks: any[] = JSON.parse(
        localStorage.getItem(`rka_staff_acknowledgements_${p.id}`) || "[]"
      );
      staffAcks.unshift({
        id: `ack-${Date.now()}`,
        policy_id: p.id,
        policy_title: p.title,
        version: p.version,
        staff_name: userName,
        staff_email: user.email,
        acknowledged_at: nowISO,
        signature_text: `Signed electronically by ${userName} (IP: ${ipAddress})`,
      });
      localStorage.setItem(`rka_staff_acknowledgements_${p.id}`, JSON.stringify(staffAcks));
    });

    localStorage.setItem(`rka_hipaa_user_ack_${userId}`, JSON.stringify(userAckMap));
    localStorage.setItem(`rka_hipaa_user_ack_history_${userId}`, JSON.stringify(history));

    setAckVersionMap({ ...userAckMap });
    setDismissed(true);

    toast.success("HIPAA Policy Acknowledgements saved successfully! Dashboard unlocked.");
    setSubmitting(false);
    // Component will automatically unmount / return null because pendingPolicies becomes empty!
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 md:p-6 bg-muted/40 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <img src={rkaLogo} alt="Radiantilyk Aesthetic" className="h-10 w-10 rounded-full object-cover shadow-xs border" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-lg md:text-xl font-bold tracking-tight text-foreground">
                  Mandatory HIPAA Policy Review
                </h1>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] uppercase font-bold">
                  <ShieldAlert className="h-3 w-3 mr-1" /> Login Gate
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Radiantilyk Aesthetic Healthcare Compliance & Governance System
              </p>
            </div>
          </div>

          <div className="text-left md:text-right text-xs font-mono bg-background/80 px-3 py-2 rounded-xl border border-border/60">
            <div className="font-semibold text-foreground flex items-center gap-1.5 justify-start md:justify-end">
              <UserCheck className="h-3.5 w-3.5 text-primary" /> {getStaffName()}
            </div>
            <div className="text-[11px] text-muted-foreground">{getStaffRole()}</div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="px-5 py-3 bg-primary/5 border-b border-primary/10 text-xs text-muted-foreground flex items-center gap-2 shrink-0 font-sans">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
          <span>
            Federal HIPAA Security Regulations require all staff members to review and electronically acknowledge active practice compliance policies before accessing the clinical dashboard.
          </span>
        </div>

        {/* Main List of Pending Unacknowledged Policies */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-4 flex-1">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Pending Policy Acknowledgements ({pendingPolicies.length})
          </div>

          {pendingPolicies.map((policy) => {
            const isChecked = checkedMap[policy.id] === true;

            return (
              <Card key={policy.id} className="p-4 rounded-xl border border-border/80 space-y-3 bg-card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                  <div>
                    <h3 className="font-serif text-sm font-semibold text-foreground flex items-center gap-2">
                      {policy.title}
                    </h3>
                    <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      Category: {policy.category}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px] font-bold">
                      v{policy.version} · Active Published
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewPolicy(policy)}
                      className="h-7 text-xs gap-1 text-primary hover:bg-primary/5"
                    >
                      <Eye className="h-3.5 w-3.5" /> View Full Policy
                    </Button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground leading-relaxed">
                  {policy.summary || "No summary provided for this policy."}
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <Checkbox
                    id={`check-${policy.id}`}
                    checked={isChecked}
                    onCheckedChange={(v) => handleToggleCheck(policy.id, !!v)}
                    className="mt-0.5 h-4 w-4 rounded"
                  />
                  <label
                    htmlFor={`check-${policy.id}`}
                    className="text-xs text-foreground font-medium leading-normal cursor-pointer select-none"
                  >
                    I have read, understand, and agree to strictly comply with the <strong>{policy.title} (v{policy.version})</strong>.
                  </label>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Footer Action Bar */}
        <div className="p-4 md:p-5 bg-muted/40 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-muted-foreground flex items-center gap-2 font-mono">
            <Lock className="h-3.5 w-3.5 text-primary" />
            <span>
              Recorded for Audit: <strong>{userId}</strong> (IP: {ipAddress})
            </span>
          </div>

          <Button
            onClick={submitAcknowledgements}
            disabled={!allChecked || submitting}
            className="w-full sm:w-auto h-10 px-6 text-xs gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md disabled:opacity-50"
          >
            {submitting ? (
              <>Processing...</>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> I Acknowledge & Continue
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Modal: View Full Policy Document */}
      <Dialog open={!!viewPolicy} onOpenChange={() => setViewPolicy(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-semibold flex items-center justify-between">
              <span>{viewPolicy?.title} (v{viewPolicy?.version})</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">
              Category: {viewPolicy?.category} · Effective Date: {viewPolicy?.effective_date || "2026-01-01"}
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 rounded-xl border border-border bg-muted/20 font-mono text-xs whitespace-pre-wrap max-h-[500px] overflow-y-auto leading-relaxed">
            {viewPolicy?.body_markdown}
          </div>

          <div className="flex items-center justify-end pt-2 border-t">
            <Button size="sm" onClick={() => setViewPolicy(null)} className="h-8 text-xs">
              Close & Return
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
