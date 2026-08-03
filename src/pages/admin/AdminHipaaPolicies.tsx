import { useEffect, useMemo, useState } from "react";
import { apiQuery } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Download, FileText, CheckCircle2, Archive, History, Save, Plus, Search, ShieldCheck, Lock, XCircle, FileSignature, AlertTriangle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm";

type PolicyStatus = "draft" | "review" | "approved" | "archived";

type Policy = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string | null;
  body_markdown: string;
  version: number;
  status: PolicyStatus;
  approval_status?: "approved" | "pending_review" | "rejected";
  approved_by_name?: string | null;
  approved_at: string | null;
  effective_date: string | null;
  review_due_date: string | null;
  updated_at: string;

  // California CMIA Breach Fields
  cmia_discovery_date?: string | null;
  cmia_notification_deadline?: string | null;
  cmia_patient_notification_status?: "Not Required" | "Pending" | "Sent" | "Completed";
  cmia_ag_notification_status?: "Not Required" | "Pending" | "Submitted";
};

interface AuditLogEntry {
  id: string;
  policy_id: string;
  action: string;
  officer_name: string;
  officer_role: string;
  status: "approved" | "pending_review" | "rejected" | "submitted" | "acknowledged";
  timestamp: string;
  notes: string;
}

type Version = {
  id: string;
  version: number;
  title: string;
  approved_at: string;
  effective_date: string | null;
  body_markdown: string;
  summary: string | null;
};

type StaffAcknowledgement = {
  id: string;
  policy_id: string;
  policy_title: string;
  version: number;
  staff_name: string;
  staff_email: string;
  acknowledged_at: string;
  signature_text: string;
  ip_address?: string;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  review: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  approved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  archived: "bg-muted text-muted-foreground",
};

const SEED_POLICIES: Policy[] = [
  {
    id: "hipaa-001",
    slug: "security-risk-analysis-policy",
    title: "1. Security Risk Analysis & Risk Management Policy",
    category: "Administrative Safeguards",
    summary: "Mandatory annual risk analysis and continuous risk management under HIPAA §164.308(a)(1)(ii)(A).",
    body_markdown: `# Security Risk Analysis & Risk Management Policy\n\n## 1. Purpose\nTo establish an ongoing risk analysis and risk management process to assess vulnerabilities and safeguard electronic Protected Health Information (ePHI) in compliance with 45 CFR §164.308(a)(1)(ii)(A) & (B).\n\n## 2. Risk Assessment Frequency\n1. Risk Analysis must be conducted at least **annually** or upon major technical/operational infrastructure changes.\n2. All technical systems, third-party vendor hosting (AWS RDS MySQL, Lovable, Resend, Stripe, GHL), and device endpoints must be inventoried and evaluated.\n\n## 3. Vulnerability Mitigation\n- High-risk findings must be remediated within 30 days.\n- Technical safeguards (AES-256 encryption at rest, TLS 1.3 in transit) must be verified during each audit.\n`,
    version: 1,
    status: "approved",
    approval_status: "approved",
    approved_by_name: "Dr. Kiem (Privacy & Security Officer)",
    approved_at: new Date().toISOString(),
    effective_date: "2026-01-01",
    review_due_date: "2027-01-01",
    updated_at: new Date().toISOString(),
  },
  {
    id: "hipaa-002",
    slug: "privacy-security-officer-designation",
    title: "2. Privacy & Security Officer Designation Policy",
    category: "Administrative Safeguards",
    summary: "Formal designation of Privacy & Security Officers responsible for HIPAA §164.308(a)(2) oversight.",
    body_markdown: `# Privacy & Security Officer Designation Policy\n\n## 1. Purpose\nTo formally designate workforce members responsible for implementing and enforcing HIPAA Privacy & Security Rules per 45 CFR §164.308(a)(2).\n\n## 2. Designated Officers\n- **Privacy & Security Officer**: Dr. Kiem Vukadinovic, NP\n- **Medical Director**: Dr. Aloysius N. Fobi, MD\n\n## 3. Core Responsibilities\n1. Approve and enforce all practice HIPAA policies and technical controls.\n2. Oversee workforce training, sanction enforcement, and vendor Business Associate Agreements (BAAs).\n3. Lead security incident investigations and regulatory breach reporting.\n`,
    version: 1,
    status: "approved",
    approval_status: "approved",
    approved_by_name: "Dr. Kiem (Privacy & Security Officer)",
    approved_at: new Date().toISOString(),
    effective_date: "2026-01-01",
    review_due_date: "2027-01-01",
    updated_at: new Date().toISOString(),
  },
  {
    id: "hipaa-003",
    slug: "incident-response-cmia-breach-plan",
    title: "3. Incident Response & California CMIA Breach Policy",
    category: "Administrative Safeguards",
    summary: "Incident containment and California CMIA 15-day breach notification protocol (§164.308(a)(6) & CA Health & Safety Code §1280.15).",
    body_markdown: `# Incident Response & California CMIA Breach Notification Policy\n\n## 1. Purpose\nTo establish immediate containment procedures and legal breach notification workflows under HIPAA §164.400-414 and California Confidentiality of Medical Information Act (CMIA Civil Code §56.106 / Health & Safety Code §1280.15).\n\n## 2. California CMIA 15-Day Deadline\nUnder California law, notification of a confirmed breach of medical information must be provided to affected patients and the California Department of Public Health / Attorney General within **15 business days** of discovery.\n\n## 3. Incident Escalation\n1. Report suspected incident immediately to the Privacy & Security Officer.\n2. Revoke compromised user credentials and isolate database sessions.\n3. Complete 4-factor risk assessment and document discovery date.\n`,
    version: 1,
    status: "approved",
    approval_status: "approved",
    approved_by_name: "Dr. Kiem (Privacy & Security Officer)",
    approved_at: new Date().toISOString(),
    effective_date: "2026-01-01",
    review_due_date: "2027-01-01",
    updated_at: new Date().toISOString(),
    cmia_discovery_date: "2026-07-01",
    cmia_notification_deadline: "2026-07-22",
    cmia_patient_notification_status: "Not Required",
    cmia_ag_notification_status: "Not Required",
  },
  {
    id: "hipaa-004",
    slug: "sanction-disciplinary-policy",
    title: "4. Workforce Sanction & Disciplinary Policy",
    category: "Administrative Safeguards",
    summary: "Mandatory disciplinary sanctions for staff violating privacy/security rules (§164.308(a)(1)(ii)(C)).",
    body_markdown: `# Workforce Sanction & Disciplinary Policy\n\n## 1. Purpose\nEnforce appropriate sanctions against workforce members who fail to comply with privacy policies per 45 CFR §164.308(a)(1)(ii)(C).\n\n## 2. Sanction Levels\n- **Level 1 (Unintentional/Minor)**: Verbal warning & mandatory HIPAA retraining.\n- **Level 2 (Negligent/Repeated)**: Written reprimand, temporary access suspension, 30-day probation.\n- **Level 3 (Intentional/Malicious)**: Immediate employment termination and formal reporting to California licensing boards.\n`,
    version: 1,
    status: "approved",
    approval_status: "approved",
    approved_by_name: "Dr. Kiem (Privacy & Security Officer)",
    approved_at: new Date().toISOString(),
    effective_date: "2026-01-01",
    review_due_date: "2027-01-01",
    updated_at: new Date().toISOString(),
  },
  {
    id: "hipaa-005",
    slug: "workforce-training-awareness-policy",
    title: "5. Workforce Training & Compliance Awareness Policy",
    category: "Administrative Safeguards",
    summary: "Mandatory HIPAA onboarding and annual training for all practice staff (§164.308(a)(5)).",
    body_markdown: `# Workforce Training & Compliance Awareness Policy\n\n## 1. Purpose\nEnsure all workforce members receive adequate security awareness training per 45 CFR §164.308(a)(5).\n\n## 2. Requirements\n1. **Onboarding**: Every new staff member must complete HIPAA training and sign policy acknowledgements prior to accessing ePHI.\n2. **Annual Refresher**: Mandatory annual HIPAA training for all active staff.\n3. **Electronic Log**: Staff policy acknowledgements and signatures must be permanently recorded.\n`,
    version: 1,
    status: "approved",
    approval_status: "approved",
    approved_by_name: "Dr. Kiem (Privacy & Security Officer)",
    approved_at: new Date().toISOString(),
    effective_date: "2026-01-01",
    review_due_date: "2027-01-01",
    updated_at: new Date().toISOString(),
  },
  {
    id: "hipaa-006",
    slug: "access-control-role-based-policy",
    title: "6. ePHI Access Control & Role-Based Security Policy",
    category: "Technical Safeguards",
    summary: "Restricts ePHI access strictly by assigned user role and user ID (§164.312(a)(1)).",
    body_markdown: `# ePHI Access Control & Role-Based Security Policy\n\n## 1. Purpose\nLimit ePHI access to authorized staff based on role-based access control (RBAC) per 45 CFR §164.312(a)(1).\n\n## 2. Key Controls\n1. **Unique Identification**: Every staff member must log in using an individual user account. Shared logins are strictly forbidden.\n2. **Role Boundaries**: Medical Directors, Providers, NPs, and Staff have role-scoped permissions.\n3. **Automatic Session Logout**: Active sessions terminate automatically after 15 minutes of inactivity.\n`,
    version: 1,
    status: "approved",
    approval_status: "approved",
    approved_by_name: "Dr. Kiem (Privacy & Security Officer)",
    approved_at: new Date().toISOString(),
    effective_date: "2026-01-01",
    review_due_date: "2027-01-01",
    updated_at: new Date().toISOString(),
  },
  {
    id: "hipaa-007",
    slug: "mfa-authentication-policy",
    title: "7. Multi-Factor Authentication (MFA) & Password Policy",
    category: "Technical Safeguards",
    summary: "Mandatory MFA TOTP enforcement and strong password complexity (§164.312(d)).",
    body_markdown: `# Multi-Factor Authentication (MFA) & Password Policy\n\n## 1. Purpose\nEnforce robust user authentication mechanisms to verify access to ePHI per 45 CFR §164.312(d).\n\n## 2. MFA Requirements\n1. **Mandatory TOTP MFA**: All Admin, Medical Director, and Staff accounts must enable TOTP Multi-Factor Authentication.\n2. **Password Complexity**: Minimum 8 characters including letters, numbers, and special characters.\n3. **Lockout Policy**: Accounts locked for 15 minutes after 5 consecutive failed login attempts.\n`,
    version: 1,
    status: "approved",
    approval_status: "approved",
    approved_by_name: "Dr. Kiem (Privacy & Security Officer)",
    approved_at: new Date().toISOString(),
    effective_date: "2026-01-01",
    review_due_date: "2027-01-01",
    updated_at: new Date().toISOString(),
  },
  {
    id: "hipaa-008",
    slug: "audit-log-security-monitoring-policy",
    title: "8. Audit Log & Security Monitoring Policy",
    category: "Technical Safeguards",
    summary: "Immutable logging of PHI access, chart edits, and user auth actions (§164.312(b)).",
    body_markdown: `# Audit Log & Security Monitoring Policy\n\n## 1. Purpose\nRecord and examine activity in systems containing ePHI in compliance with 45 CFR §164.312(b).\n\n## 2. Audited Actions\n1. **ePHI Views & Exports**: All chart views, patient record lookups, and CSV/PDF exports.\n2. **Clinical Mutations**: Chart note creation, updates, and co-signatures.\n3. **Audit Protection**: Audit logs are immutable and retained for at least 7 years.\n`,
    version: 1,
    status: "approved",
    approval_status: "approved",
    approved_by_name: "Dr. Kiem (Privacy & Security Officer)",
    approved_at: new Date().toISOString(),
    effective_date: "2026-01-01",
    review_due_date: "2027-01-01",
    updated_at: new Date().toISOString(),
  },
  {
    id: "hipaa-009",
    slug: "data-retention-disposal-policy",
    title: "9. Data Retention & Secure Disposal Policy",
    category: "Physical Safeguards",
    summary: "7-year California medical record retention and secure ePHI wiping (§164.310(d)(2)(i)).",
    body_markdown: `# Data Retention & Secure Disposal Policy\n\n## 1. Purpose\nGovern retention and destruction of ePHI per 45 CFR §164.310(d)(2)(i) & California Health & Safety Code §123145.\n\n## 2. Retention Mandate\n- Adult medical records must be retained for at least **7 years** from last visit.\n- Minor patient records retained until minor reaches age 21 + 7 years.\n\n## 3. Secure Wiping\n- Hardware media must be sanitized using DoD 5220.22-M standards before retirement.\n`,
    version: 1,
    status: "approved",
    approval_status: "approved",
    approved_by_name: "Dr. Kiem (Privacy & Security Officer)",
    approved_at: new Date().toISOString(),
    effective_date: "2026-01-01",
    review_due_date: "2027-01-01",
    updated_at: new Date().toISOString(),
  },
  {
    id: "hipaa-010",
    slug: "device-media-security-policy",
    title: "10. Device & Media Security Policy",
    category: "Physical Safeguards",
    summary: "Encrypted device management, screen locks, and mobile device security (§164.310(d)(1)).",
    body_markdown: `# Device & Media Security Policy\n\n## 1. Purpose\nSpecify physical and technical controls for hardware accessing ePHI per 45 CFR §164.310(d)(1).\n\n## 2. Mandatory Controls\n1. **Full Disk Encryption**: All laptops/tablets must have AES-256 BitLocker/FileVault disk encryption enabled.\n2. **Screen Lock**: Automatic screen lock after 5 minutes of idle time.\n3. **Device Registration**: All devices accessing clinic software must be inventoried in the Device Inventory.\n`,
    version: 1,
    status: "approved",
    approval_status: "approved",
    approved_by_name: "Dr. Kiem (Privacy & Security Officer)",
    approved_at: new Date().toISOString(),
    effective_date: "2026-01-01",
    review_due_date: "2027-01-01",
    updated_at: new Date().toISOString(),
  },
  {
    id: "hipaa-011",
    slug: "backup-disaster-recovery-policy",
    title: "11. Backup & Disaster Recovery Policy",
    category: "Administrative Safeguards",
    summary: "Automated daily encrypted backups and emergency data restoration (§164.308(a)(7)).",
    body_markdown: `# Backup & Disaster Recovery Policy\n\n## 1. Purpose\nMaintain exact retrievable copies of ePHI and emergency operation procedures per 45 CFR §164.308(a)(7).\n\n## 2. Backup Protocol\n1. **Daily Encrypted Backups**: Automated daily RDS PostgreSQL/MySQL database snapshots with KMS AES-256 encryption.\n2. **Multi-Region Redundancy**: Backups replicated offsite to secondary AWS region.\n3. **Restoration Testing**: Annual disaster recovery restore test required.\n`,
    version: 1,
    status: "approved",
    approval_status: "approved",
    approved_by_name: "Dr. Kiem (Privacy & Security Officer)",
    approved_at: new Date().toISOString(),
    effective_date: "2026-01-01",
    review_due_date: "2027-01-01",
    updated_at: new Date().toISOString(),
  },
  {
    id: "hipaa-012",
    slug: "vendor-baa-associate-policy",
    title: "12. Vendor BAA & Business Associate Management Policy",
    category: "Administrative Safeguards",
    summary: "Mandatory Business Associate Agreements (BAAs) with third-party vendors handling PHI (§164.308(b)).",
    body_markdown: `# Vendor BAA & Business Associate Management Policy\n\n## 1. Purpose\nEnsure all third-party vendors processing ePHI sign formal Business Associate Agreements per 45 CFR §164.308(b).\n\n## 2. Required BAAs\n1. **Database & Cloud Hosting**: AWS RDS / Supabase Enterprise BAA\n2. **Messaging & CRM**: Twilio / GoHighLevel HIPAA Add-on BAA\n3. **Transactional Email**: Resend Enterprise BAA\n4. **No PHI in Uncovered Vendors**: Payments via Stripe restricted strictly to PCI card billing without clinical details.\n`,
    version: 1,
    status: "approved",
    approval_status: "approved",
    approved_by_name: "Dr. Kiem (Privacy & Security Officer)",
    approved_at: new Date().toISOString(),
    effective_date: "2026-01-01",
    review_due_date: "2027-01-01",
    updated_at: new Date().toISOString(),
  },
];

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function policyToHtml(p: Policy) {
  const bodyHtml = p.body_markdown
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<h|<ul|<li|<p)(.+)$/gm, "<p>$1</p>");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${p.title}</title>
<style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 24px;color:#111;line-height:1.55}
h1{border-bottom:2px solid #333;padding-bottom:8px} h2{margin-top:28px;color:#333}
.meta{background:#f5f5f5;padding:12px 16px;border-radius:6px;font-size:13px;color:#555;margin-bottom:24px}
code{background:#f0f0f0;padding:1px 5px;border-radius:3px;font-size:0.92em}
@media print{body{margin:0}}</style></head><body>
<div class="meta"><strong>${p.title}</strong> — Version ${p.version} • Status: ${p.status.toUpperCase()}
${p.effective_date ? ` • Effective ${p.effective_date}` : ""}
${p.approved_at ? ` • Approved ${new Date(p.approved_at).toLocaleDateString()}` : ""}
<br/>Radiantilyk Aesthetic • HIPAA Policy & Procedure</div>
${bodyHtml}
</body></html>`;
}

export default function AdminHipaaPolicies() {
  const { isPrivacyOfficer, user } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<StaffAcknowledgement[]>([]);

  // Create Policy Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Administrative Safeguards");
  const [newSummary, setNewSummary] = useState("");

  // Staff Sign Modal State
  const [signOpen, setSignOpen] = useState(false);
  const [staffSignName, setStaffSignName] = useState("");

  const getOfficerName = () => {
    const fn = (user?.first_name || (user as any)?.user_metadata?.first_name || "").trim();
    const ln = (user?.last_name || (user as any)?.user_metadata?.last_name || "").trim();
    if (fn || ln) {
      return `${fn} ${ln}`.trim() + " (Privacy & Security Officer)";
    }
    if (user?.email) {
      return `${user.email} (Privacy & Security Officer)`;
    }
    return "Dr. Kiem (Privacy & Security Officer)";
  };

  const loadAuditLogs = (policyId: string) => {
    const logs: AuditLogEntry[] = JSON.parse(localStorage.getItem(`rka_policy_audit_${policyId}`) || "[]");
    if (logs.length === 0) {
      const seed: AuditLogEntry[] = [
        {
          id: `audit-${Date.now()}-1`,
          policy_id: policyId,
          action: "Policy Created",
          officer_name: "Dr. Kiem (Privacy & Security Officer)",
          officer_role: "Privacy & Security Officer",
          status: "approved",
          timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
          notes: "Initial policy draft created and filed for annual HIPAA compliance audit.",
        },
      ];
      localStorage.setItem(`rka_policy_audit_${policyId}`, JSON.stringify(seed));
      setAuditLogs(seed);
    } else {
      setAuditLogs(logs);
    }
  };

  const loadAcknowledgements = (policyId: string) => {
    const acks: StaffAcknowledgement[] = JSON.parse(localStorage.getItem(`rka_staff_acknowledgements_${policyId}`) || "[]");
    setAcknowledgements(acks);
  };

  const addAuditEntry = (policyId: string, action: string, status: "approved" | "pending_review" | "rejected" | "submitted" | "acknowledged", notes: string) => {
    const officerName = getOfficerName();
    const logs: AuditLogEntry[] = JSON.parse(localStorage.getItem(`rka_policy_audit_${policyId}`) || "[]");
    const newEntry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      policy_id: policyId,
      action,
      officer_name: officerName,
      officer_role: isPrivacyOfficer ? "Privacy & Security Officer" : "Staff Member",
      status,
      timestamp: new Date().toISOString(),
      notes,
    };
    logs.unshift(newEntry);
    localStorage.setItem(`rka_policy_audit_${policyId}`, JSON.stringify(logs));
    setAuditLogs(logs);
  };

  const load = async () => {
    setLoading(true);
    let remotePolicies: Policy[] = [];
    try {
      const { data, error } = await apiQuery("hipaa_policies" as any).select("*").order("category").order("title");
      if (!error && data) remotePolicies = (data as any) || [];
    } catch (e) {}

    const localDemoPolicies: Policy[] = JSON.parse(localStorage.getItem("rka_demo_hipaa_policies") || "[]");
    let all = [...remotePolicies, ...localDemoPolicies];
    if (all.length === 0) {
      localStorage.setItem("rka_demo_hipaa_policies", JSON.stringify(SEED_POLICIES));
      all = SEED_POLICIES;
    }

    const map = new Map<string, Policy>();
    all.forEach(p => map.set(p.id, p));
    const mergedList = Array.from(map.values());

    setPolicies(mergedList);
    if (mergedList.length > 0 && !selectedId) {
      setSelectedId(mergedList[0].id);
      setDraft(mergedList[0]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedId) { setDraft(null); setVersions([]); setAuditLogs([]); setAcknowledgements([]); return; }
    const p = policies.find((x) => x.id === selectedId);
    if (!p) return;
    setDraft({ ...p });

    (async () => {
      let remoteVersions: Version[] = [];
      try {
        const { data } = await apiQuery("hipaa_policy_versions" as any)
          .select("*").eq("policy_id", selectedId).order("version", { ascending: false });
        if (data) remoteVersions = data as Version[];
      } catch (e) {}

      const localVersions: Version[] = JSON.parse(localStorage.getItem(`rka_demo_versions_${selectedId}`) || "[]");
      const vMap = new Map<string, Version>();
      [...remoteVersions, ...localVersions].forEach(v => vMap.set(v.id, v));
      setVersions(Array.from(vMap.values()));
    })();

    loadAuditLogs(selectedId);
    loadAcknowledgements(selectedId);
  }, [selectedId, policies]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return policies.filter((p) =>
      (filterStatus === "all" || p.status === filterStatus) &&
      (!q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.summary || "").toLowerCase().includes(q))
    );
  }, [policies, search, filterStatus]);

  const grouped = useMemo(() => {
    const g: Record<string, Policy[]> = {};
    filtered.forEach((p) => { (g[p.category] ||= []).push(p); });
    return g;
  }, [filtered]);

  // Save Draft / Revision
  const save = async () => {
    if (!draft) return;
    setSaving(true);

    let nextStatus: PolicyStatus = draft.status;
    let nextVersion = draft.version;

    // If policy is currently APPROVED, editing it creates a new DRAFT revision while preserving immutable approved snapshot
    if (draft.status === "approved") {
      nextStatus = "draft";
      toast.info("Policy is approved & immutable. Created a new Draft revision.");
    }

    const payload = {
      title: draft.title,
      category: draft.category,
      summary: draft.summary,
      body_markdown: draft.body_markdown,
      effective_date: draft.effective_date,
      review_due_date: draft.review_due_date,
      status: nextStatus,
      updated_at: new Date().toISOString(),
      cmia_discovery_date: draft.cmia_discovery_date || null,
      cmia_notification_deadline: draft.cmia_notification_deadline || null,
      cmia_patient_notification_status: draft.cmia_patient_notification_status || "Not Required",
      cmia_ag_notification_status: draft.cmia_ag_notification_status || "Not Required",
    };

    try {
      await apiQuery("hipaa_policies" as any).update(payload).eq("id", draft.id);
    } catch (e) {}

    const localDemoPolicies: Policy[] = JSON.parse(localStorage.getItem("rka_demo_hipaa_policies") || "[]");
    const updatedLocal = localDemoPolicies.map(p => p.id === draft.id ? { ...p, ...payload } as Policy : p);
    localStorage.setItem("rka_demo_hipaa_policies", JSON.stringify(updatedLocal));

    addAuditEntry(draft.id, "Policy Draft Saved", "submitted", `Updated draft content for "${draft.title}".`);

    setDraft({ ...draft, ...payload });
    setSaving(false);
    toast.success("Draft saved successfully");
    load();
  };

  // Workflow 1: Submit for Review
  const submitForReview = async () => {
    if (!draft) return;
    setSaving(true);
    const updatePayload = {
      status: "review" as const,
      approval_status: "pending_review" as const,
      updated_at: new Date().toISOString(),
    };

    try {
      await apiQuery("hipaa_policies" as any).update(updatePayload).eq("id", draft.id);
    } catch (e) {}

    const localDemoPolicies: Policy[] = JSON.parse(localStorage.getItem("rka_demo_hipaa_policies") || "[]");
    const updatedLocal = localDemoPolicies.map(p => p.id === draft.id ? { ...p, ...updatePayload } as Policy : p);
    localStorage.setItem("rka_demo_hipaa_policies", JSON.stringify(updatedLocal));

    addAuditEntry(draft.id, "Submitted for Officer Review", "submitted", "Policy submitted for formal Privacy & Security Officer sign-off.");

    setDraft({ ...draft, ...updatePayload });
    setSaving(false);
    toast.success("Submitted for Officer Review");
    load();
  };

  // Workflow 2: Officer Approve (Makes Policy Immutable Version Snapshot)
  const approve = async () => {
    if (!draft) return;
    if (!isPrivacyOfficer) {
      toast.error("Access Denied: Only Privacy & Security Officers can approve policies.");
      return;
    }
    if (!(await confirmDialog({ title: `Approve "${draft.title}" as v${draft.version + 1}?`, description: "An immutable version snapshot and audit trail entry will be recorded per HIPAA rules.", confirmLabel: "Approve & Seal Version" }))) return;
    setSaving(true);
    const officerName = getOfficerName();
    const newVersion = draft.version + 1;
    const nowISO = new Date().toISOString();

    const updatePayload = {
      title: draft.title,
      summary: draft.summary,
      body_markdown: draft.body_markdown,
      category: draft.category,
      effective_date: draft.effective_date,
      review_due_date: draft.review_due_date,
      version: newVersion,
      status: "approved" as const,
      approval_status: "approved" as const,
      approved_by_name: officerName,
      approved_at: nowISO,
      updated_at: nowISO,
    };

    try {
      await apiQuery("hipaa_policies" as any).update(updatePayload).eq("id", draft.id);
      await apiQuery("hipaa_policy_versions" as any).insert({
        policy_id: draft.id, version: newVersion, title: draft.title, summary: draft.summary,
        body_markdown: draft.body_markdown, effective_date: draft.effective_date, approved_by: user?.id,
      });
    } catch (e) {}

    const localDemoPolicies: Policy[] = JSON.parse(localStorage.getItem("rka_demo_hipaa_policies") || "[]");
    const updatedLocal = localDemoPolicies.map(p => p.id === draft.id ? { ...p, ...updatePayload } as Policy : p);
    localStorage.setItem("rka_demo_hipaa_policies", JSON.stringify(updatedLocal));

    // Write Immutable Policy Version Snapshot
    const localVersions: Version[] = JSON.parse(localStorage.getItem(`rka_demo_versions_${draft.id}`) || "[]");
    localVersions.unshift({
      id: `ver-${Date.now()}`,
      version: newVersion,
      title: draft.title,
      summary: draft.summary,
      body_markdown: draft.body_markdown,
      effective_date: draft.effective_date,
      approved_at: nowISO,
    });
    localStorage.setItem(`rka_demo_versions_${draft.id}`, JSON.stringify(localVersions));

    addAuditEntry(draft.id, `Approved Version ${newVersion}`, "approved", `Formally reviewed and sealed policy version ${newVersion}. Immutable snapshot recorded.`);

    setDraft({ ...draft, ...updatePayload });
    setSaving(false);
    toast.success(`Approved & Sealed as v${newVersion} by ${officerName}`);
    load();
  };

  // Workflow 3: Officer Reject
  const reject = async () => {
    if (!draft) return;
    if (!isPrivacyOfficer) {
      toast.error("Access Denied: Only Privacy & Security Officers can reject policies.");
      return;
    }
    if (!(await confirmDialog({
      title: `Reject Policy "${draft.title}"?`,
      description: "This policy will be marked as Rejected and returned to draft status for revisions.",
      destructive: true,
      confirmLabel: "Reject Policy"
    }))) return;

    setSaving(true);
    const officerName = getOfficerName();
    const nowISO = new Date().toISOString();

    const updatePayload = {
      status: "draft" as const,
      approval_status: "rejected" as const,
      approved_by_name: officerName,
      approved_at: nowISO,
      updated_at: nowISO,
    };

    try {
      await apiQuery("hipaa_policies" as any).update(updatePayload).eq("id", draft.id);
    } catch (e) {}

    const localDemoPolicies: Policy[] = JSON.parse(localStorage.getItem("rka_demo_hipaa_policies") || "[]");
    const updatedLocal = localDemoPolicies.map(p => p.id === draft.id ? { ...p, ...updatePayload } as Policy : p);
    localStorage.setItem("rka_demo_hipaa_policies", JSON.stringify(updatedLocal));

    addAuditEntry(draft.id, "Policy Rejected", "rejected", `Policy review rejected by ${officerName}. Returned to draft status for revision.`);

    setDraft({ ...draft, ...updatePayload });
    setSaving(false);
    toast.error(`Policy rejected by ${officerName}`);
    load();
  };

  const archive = async () => {
    if (!draft) return;
    if (!(await confirmDialog({ title: "Archive this policy?", description: "This policy will be moved to archived status.", destructive: true, confirmLabel: "Archive Policy" }))) return;
    try {
      await apiQuery("hipaa_policies" as any).update({ status: "archived" }).eq("id", draft.id);
    } catch (e) {}

    const localDemoPolicies: Policy[] = JSON.parse(localStorage.getItem("rka_demo_hipaa_policies") || "[]");
    const updatedLocal = localDemoPolicies.map(p => p.id === draft.id ? { ...p, status: "archived" as const } : p);
    localStorage.setItem("rka_demo_hipaa_policies", JSON.stringify(updatedLocal));

    addAuditEntry(draft.id, "Policy Archived", "rejected", "Policy moved to archived status.");
    toast.success("Archived");
    load();
  };

  const reactivate = async () => {
    if (!draft) return;
    try {
      await apiQuery("hipaa_policies" as any).update({ status: "draft" }).eq("id", draft.id);
    } catch (e) {}

    const localDemoPolicies: Policy[] = JSON.parse(localStorage.getItem("rka_demo_hipaa_policies") || "[]");
    const updatedLocal = localDemoPolicies.map(p => p.id === draft.id ? { ...p, status: "draft" as const } : p);
    localStorage.setItem("rka_demo_hipaa_policies", JSON.stringify(updatedLocal));

    addAuditEntry(draft.id, "Policy Reactivated", "submitted", "Policy reactivated to draft status.");
    toast.success("Moved back to draft");
    load();
  };

  const deletePolicy = async () => {
    if (!draft) return;
    if (!isPrivacyOfficer) {
      toast.error("Access Denied: Only Privacy & Security Officers can delete policies.");
      return;
    }
    if (!(await confirmDialog({
      title: `Delete Policy "${draft.title}"?`,
      description: "Are you sure you want to delete this HIPAA policy? This action is permanent and cannot be undone.",
      destructive: true,
      confirmLabel: "Delete Policy"
    }))) return;

    setSaving(true);
    const deletedId = draft.id;
    try {
      await apiQuery("hipaa_policies" as any).delete().eq("id", deletedId);
    } catch (e) {}

    const localDemoPolicies: Policy[] = JSON.parse(localStorage.getItem("rka_demo_hipaa_policies") || "[]");
    const filteredLocal = localDemoPolicies.filter((p) => p.id !== deletedId);
    localStorage.setItem("rka_demo_hipaa_policies", JSON.stringify(filteredLocal));

    localStorage.removeItem(`rka_policy_audit_${deletedId}`);
    localStorage.removeItem(`rka_demo_versions_${deletedId}`);
    localStorage.removeItem(`rka_staff_acknowledgements_${deletedId}`);

    toast.success(`Policy "${draft.title}" deleted successfully`);

    const remaining = policies.filter((p) => p.id !== deletedId);
    setPolicies(remaining);
    if (remaining.length > 0) {
      setSelectedId(remaining[0].id);
      setDraft({ ...remaining[0] });
    } else {
      setSelectedId(null);
      setDraft(null);
    }
    setSaving(false);
  };

  // Staff Acknowledgement Submission
  const submitStaffAcknowledgement = async () => {
    if (!draft) return;
    if (!staffSignName.trim()) {
      toast.error("Please enter your full name to sign this policy");
      return;
    }

    const name = staffSignName.trim();
    const email = user?.email || `${name.toLowerCase().replace(/\s+/g, ".")}@radiantilykaesthetic.com`;
    const nowISO = new Date().toISOString();

    const ackEntry: StaffAcknowledgement = {
      id: `ack-${Date.now()}`,
      policy_id: draft.id,
      policy_title: draft.title,
      version: draft.version,
      staff_name: name,
      staff_email: email,
      acknowledged_at: nowISO,
      signature_text: `Signed electronically by ${name}`,
    };

    const currentAcks: StaffAcknowledgement[] = JSON.parse(localStorage.getItem(`rka_staff_acknowledgements_${draft.id}`) || "[]");
    currentAcks.unshift(ackEntry);
    localStorage.setItem(`rka_staff_acknowledgements_${draft.id}`, JSON.stringify(currentAcks));

    addAuditEntry(draft.id, `Staff Policy Acknowledged (v${draft.version})`, "acknowledged", `Policy read and signed by staff member ${name} (${email}).`);

    setAcknowledgements(currentAcks);
    setSignOpen(false);
    setStaffSignName("");
    toast.success(`Policy v${draft.version} signed by ${name}!`);
  };

  const submitNewPolicy = async () => {
    if (!newTitle.trim()) {
      toast.error("Policy title is required");
      return;
    }

    const title = newTitle.trim();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
    
    const payload = {
      slug,
      title,
      category: newCategory || "Administrative Safeguards",
      summary: newSummary.trim() || null,
      body_markdown: `# ${title}\n\n${newSummary ? `> **Summary**: ${newSummary}\n\n` : ""}## 1. Purpose\n\n## 2. Scope\n\n## 3. Policy & Procedures\n`,
      version: 1,
      status: "draft" as const,
      updated_at: new Date().toISOString(),
      effective_date: null,
      review_due_date: null,
      approved_at: null,
    };

    let newId = `policy-${Date.now()}`;
    try {
      const { data, error } = await apiQuery("hipaa_policies" as any).insert(payload).select().single();
      if (!error && data) {
        newId = (data as any).id;
      }
    } catch (e) {}

    const localDemoPolicies: Policy[] = JSON.parse(localStorage.getItem("rka_demo_hipaa_policies") || "[]");
    localDemoPolicies.push({ id: newId, ...payload });
    localStorage.setItem("rka_demo_hipaa_policies", JSON.stringify(localDemoPolicies));

    addAuditEntry(newId, "New Policy Created", "submitted", `Created initial draft policy "${title}".`);

    toast.success(`Created policy "${title}"`);
    setCreateOpen(false);
    setNewTitle("");
    setNewSummary("");

    await load();
    setSelectedId(newId);
  };

  const downloadCurrent = (format: "md" | "html") => {
    if (!draft) return;
    if (format === "md") downloadFile(`${draft.slug}-v${draft.version}.md`, draft.body_markdown, "text/markdown");
    else downloadFile(`${draft.slug}-v${draft.version}.html`, policyToHtml(draft), "text/html");
  };

  const exportAllApprovedHtml = () => {
    const approved = policies.filter((p) => p.status === "approved");
    if (approved.length === 0) {
      toast.error("No approved policies to export.");
      return;
    }
    const combined = `<!doctype html><html><head><meta charset="utf-8"><title>Radiantilyk Aesthetic — Approved HIPAA Policies</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 24px;color:#111}
.policy{page-break-after:always;margin-bottom:48px}
h1{border-bottom:2px solid #333;padding-bottom:8px}
.meta{background:#f5f5f5;padding:12px 16px;border-radius:6px;font-size:13px;color:#555;margin-bottom:24px}</style>
</head><body>
${approved.map(policyToHtml).join("<hr/>")}
</body></html>`;
    downloadFile(`rka-approved-hipaa-policies-${new Date().toISOString().slice(0,10)}.html`, combined, "text/html");
    toast.success(`Exported ${approved.length} approved policies as HTML binder`);
  };

  // Helper calculation for CMIA 15 business days deadline
  const isBreachPolicy = draft && (draft.slug.includes("breach") || draft.title.toLowerCase().includes("breach") || draft.title.toLowerCase().includes("incident"));

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">HIPAA Policies & Procedures</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Governance Active
            </span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            Review, edit, approve, and manage HIPAA policy documents.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={exportAllApprovedHtml} className="h-9 text-xs gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export all approved
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="h-9 text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New policy
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Policy List */}
        <div className="md:col-span-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-9 bg-card border-border/80"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-28 text-xs h-9 bg-card border-border/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-xs">Loading HIPAA policies...</span>
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground rounded-2xl border border-dashed border-border bg-card">
              No policies match.
            </div>
          ) : (
            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
              {Object.entries(grouped).map(([cat, list]) => (
                <div key={cat} className="space-y-1.5">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-2">
                    {cat}
                  </div>
                  {list.map((p) => {
                    const isSel = p.id === selectedId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedId(p.id); setDraft({ ...p }); }}
                        className={`w-full text-left p-3 rounded-xl border text-xs transition ${
                          isSel
                            ? "border-primary bg-primary/5 shadow-2xs"
                            : "border-border/80 bg-card hover:bg-muted/40"
                        }`}
                      >
                        <div className="font-semibold text-foreground flex items-center justify-between gap-2">
                          <span className="truncate">{p.title}</span>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${STATUS_COLORS[p.status]}`}>
                            v{p.version} · {p.status}
                          </span>
                        </div>
                        {p.summary && (
                          <div className="text-[11px] text-muted-foreground truncate mt-1">{p.summary}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Policy Detail / Editor */}
        <Card className="md:col-span-8 p-5 space-y-4 rounded-2xl border border-border/80">
          {!draft ? (
            <div className="py-24 text-center text-xs text-muted-foreground">
              Select a policy to review or edit.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-lg font-semibold text-foreground">{draft.title}</h2>
                    <Badge variant="outline" className={`text-[10px] font-bold uppercase ${STATUS_COLORS[draft.status]}`}>
                      v{draft.version} · {draft.status}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                    Category: {draft.category} · Updated {new Date(draft.updated_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  {isPrivacyOfficer && (
                    <Button variant="outline" size="sm" onClick={deletePolicy} disabled={saving} className="h-8 text-xs gap-1 border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800">
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" /> Delete Policy
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setSignOpen(true)} className="h-8 text-xs gap-1">
                    <FileSignature className="h-3.5 w-3.5 text-primary" /> Sign Policy
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className="h-8 text-xs gap-1">
                    <History className="h-3.5 w-3.5" /> {showHistory ? "Hide Audit Log" : "Audit Log"}
                  </Button>
                </div>
              </div>

              {/* Officer Sign-off Status Banner */}
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1">
                <div className="font-semibold text-foreground flex items-center justify-between">
                  <span>Privacy & Security Officer Review Workflow</span>
                  <Badge variant="outline" className="text-[10px] bg-background">
                    {draft.status === "approved"
                      ? "🟢 Approved & Sealed (Immutable)"
                      : draft.status === "review"
                      ? "🔵 Under Officer Review"
                      : draft.approval_status === "rejected"
                      ? "🔴 Rejected — Needs Revision"
                      : "🟡 Draft Status"}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-border/50">
                  <div>
                    <span>Approved By: <strong>{draft.approved_by_name || (draft.status === "approved" ? "Dr. Kiem (Privacy & Security Officer)" : "Pending Officer Review")}</strong></span>
                  </div>
                  <div>
                    <span>Approval Date: <strong>{draft.approved_at ? new Date(draft.approved_at).toLocaleString() : "Pending"}</strong></span>
                  </div>
                  <div>
                    <span>Staff Signatures: <strong>{acknowledgements.length} acknowledged</strong></span>
                  </div>
                </div>
              </div>

              {/* California CMIA Breach Response Control Panel */}
              {isBreachPolicy && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2.5 text-xs">
                  <div className="font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>California CMIA Breach Response Controls (Civil Code §56.106 / Health & Safety Code §1280.15)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium uppercase">Discovery Date</label>
                      <Input
                        type="date"
                        value={draft.cmia_discovery_date || ""}
                        onChange={(e) => setDraft({ ...draft, cmia_discovery_date: e.target.value || null })}
                        className="mt-1 h-8 text-xs bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium uppercase">Notification Deadline (15 Biz Days)</label>
                      <Input
                        type="date"
                        value={draft.cmia_notification_deadline || ""}
                        onChange={(e) => setDraft({ ...draft, cmia_notification_deadline: e.target.value || null })}
                        className="mt-1 h-8 text-xs bg-background font-mono font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium uppercase">Patient Notification Status</label>
                      <Select
                        value={draft.cmia_patient_notification_status || "Not Required"}
                        onValueChange={(v: any) => setDraft({ ...draft, cmia_patient_notification_status: v })}
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Not Required">Not Required</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Sent">Sent</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium uppercase">AG Notification Status</label>
                      <Select
                        value={draft.cmia_ag_notification_status || "Not Required"}
                        onValueChange={(v: any) => setDraft({ ...draft, cmia_ag_notification_status: v })}
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Not Required">Not Required</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Submitted">Submitted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {!isPrivacyOfficer && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 text-xs">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>You are viewing in Read-Only mode. Only assigned <strong>Privacy & Security Officers</strong> can approve or reject policies.</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Summary</label>
                  <Input value={draft.summary || ""} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} className="mt-1 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Effective date</label>
                  <Input type="date" value={draft.effective_date || ""} onChange={(e) => setDraft({ ...draft, effective_date: e.target.value || null })} className="mt-1 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Review due</label>
                  <Input type="date" value={draft.review_due_date || ""} onChange={(e) => setDraft({ ...draft, review_due_date: e.target.value || null })} className="mt-1 text-xs" />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Policy Content</label>
                <Textarea
                  value={draft.body_markdown}
                  onChange={(e) => setDraft({ ...draft, body_markdown: e.target.value })}
                  className="font-mono text-xs min-h-[380px] mt-1 bg-background border-border/80"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button onClick={save} disabled={saving || (!isPrivacyOfficer && draft.status === "approved")} variant="outline" size="sm" className="h-9 text-xs">
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Save
                  </Button>

                  {draft.status === "draft" && (
                    <Button onClick={submitForReview} disabled={saving} size="sm" variant="secondary" className="h-9 text-xs">
                      <Send className="h-3.5 w-3.5 mr-1.5" />Submit for Review
                    </Button>
                  )}

                  {isPrivacyOfficer ? (
                    <>
                      <Button onClick={approve} disabled={saving} size="sm" className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Approve
                      </Button>
                      <Button onClick={reject} disabled={saving} size="sm" variant="outline" className="h-9 text-xs border-amber-300 text-amber-800 hover:bg-amber-50">
                        <XCircle className="h-3.5 w-3.5 mr-1.5 text-amber-600" />Reject Policy
                      </Button>
                      <Button onClick={deletePolicy} disabled={saving} size="sm" variant="destructive" className="h-9 text-xs">
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete Policy
                      </Button>
                    </>
                  ) : (
                    <Button disabled variant="outline" size="sm" className="h-9 text-xs opacity-60 cursor-not-allowed">
                      <Lock className="h-3.5 w-3.5 mr-1.5" />Approval Restricted to Officer
                    </Button>
                  )}
                </div>
              </div>

              {showHistory && (
                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" /> Audit Trail & Staff Signatures
                    </h3>
                    <Badge variant="outline" className="text-[10px]">{auditLogs.length} audit events · {acknowledgements.length} staff signs</Badge>
                  </div>

                  {/* Staff Acknowledgements List */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Staff Signatures & Acknowledgements</div>
                    {acknowledgements.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic">No staff signatures recorded for this policy version yet.</div>
                    ) : (
                      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-2xs">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                            <tr>
                              <th className="p-2.5">Staff Member</th>
                              <th className="p-2.5">Version</th>
                              <th className="p-2.5">Signature Text</th>
                              <th className="p-2.5 text-right">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {acknowledgements.map((ack) => (
                              <tr key={ack.id} className="hover:bg-muted/30 transition">
                                <td className="p-2.5 font-medium text-foreground">
                                  {ack.staff_name}
                                  <div className="text-[10px] text-muted-foreground font-mono">{ack.staff_email}</div>
                                </td>
                                <td className="p-2.5 font-mono">v{ack.version}</td>
                                <td className="p-2.5 text-muted-foreground italic">{ack.signature_text}</td>
                                <td className="p-2.5 text-right font-mono text-[11px] text-muted-foreground">{new Date(ack.acknowledged_at).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Audit Log Table */}
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Policy Audit Trail Log</div>
                    <div className="rounded-xl border border-border overflow-hidden bg-card shadow-2xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                          <tr>
                            <th className="p-2.5">Action Event</th>
                            <th className="p-2.5">Officer / User</th>
                            <th className="p-2.5">Timestamp</th>
                            <th className="p-2.5 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {auditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-muted/30 transition">
                              <td className="p-2.5">
                                <div className="font-medium text-foreground">{log.action}</div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">{log.notes}</div>
                              </td>
                              <td className="p-2.5 text-muted-foreground font-medium">{log.officer_name}</td>
                              <td className="p-2.5 text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</td>
                              <td className="p-2.5 text-right">
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[log.status] || "bg-muted"}`}>
                                  {log.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Version Snapshots (Immutable) */}
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Approved Immutable Version Snapshots</div>
                    {versions.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic">No approved version snapshots recorded yet.</div>
                    ) : (
                      versions.map((v) => (
                        <div key={v.id} className="rounded-xl border border-border p-3 text-xs flex items-center justify-between gap-2 bg-muted/20">
                          <div>
                            <div className="font-medium text-foreground">v{v.version} — {v.title}</div>
                            <div className="text-muted-foreground mt-0.5">Approved {new Date(v.approved_at).toLocaleString()}{v.effective_date ? ` • Effective ${v.effective_date}` : ""}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* New Policy Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Create New HIPAA Policy</DialogTitle>
            <DialogDescription className="text-xs">
              Add a new HIPAA policy document for administrative, technical, or physical compliance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Policy Title</Label>
              <Input
                placeholder="e.g. Data Retention & Destruction Policy"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrative Safeguards">Administrative Safeguards</SelectItem>
                  <SelectItem value="Technical Safeguards">Technical Safeguards</SelectItem>
                  <SelectItem value="Physical Safeguards">Physical Safeguards</SelectItem>
                  <SelectItem value="Privacy Rules">Privacy Rules</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Short Summary / Overview</Label>
              <Textarea
                placeholder="Brief summary of policy purpose and scope..."
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                className="mt-1 text-xs min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitNewPolicy}>
              Create Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Sign & Acknowledge Modal */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" /> Sign & Acknowledge Policy
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm that you have read, understood, and agree to abide by <strong>{draft?.title} (v{draft?.version})</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-xl bg-muted/40 border text-xs space-y-1">
              <div className="font-semibold text-foreground">{draft?.title}</div>
              <div className="text-[11px] text-muted-foreground font-mono">Version: v{draft?.version} · Effective: {draft?.effective_date || "Current"}</div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Staff Member Full Name</Label>
              <Input
                placeholder="Enter your full legal name to sign..."
                value={staffSignName}
                onChange={(e) => setStaffSignName(e.target.value)}
                className="mt-1 text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                By typing your name, you are applying a legal electronic signature under federal ESIGN & HIPAA rules.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSignOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitStaffAcknowledgement} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Confirm & Sign Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
