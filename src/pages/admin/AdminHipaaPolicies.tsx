import { useEffect, useMemo, useState } from "react";
import { apiQuery } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, Download, FileText, CheckCircle2, History, Save, Search, ShieldCheck, Lock,
  XCircle, FileSignature, AlertTriangle, Send, Trash2, Eye, BookOpen, Clock, Plus
} from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm";

export type PolicyStatus = "draft" | "review" | "approved" | "archived";

export type Policy = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string | null;
  body_markdown: string;
  published_body_markdown?: string | null;
  version: number;
  status: PolicyStatus;
  approval_status?: "approved" | "pending_review" | "rejected";
  approved_by_name?: string | null;
  approved_at: string | null;
  effective_date: string | null;
  review_due_date: string | null;
  updated_at: string;
};

export interface AuditLogEntry {
  id: string;
  policy_id: string;
  action: "Policy Created" | "Policy Updated" | "Policy Published" | "Policy Rejected" | "Policy Deleted (draft only)" | "Staff Policy Acknowledged";
  officer_name: string;
  officer_role: string;
  timestamp: string;
  notes: string;
}

export type Version = {
  id: string;
  version: number;
  title: string;
  approved_at: string;
  approved_by_name: string;
  effective_date: string | null;
  body_markdown: string;
  summary: string | null;
};

export type StaffAcknowledgement = {
  id: string;
  policy_id: string;
  policy_title: string;
  version: number;
  staff_name: string;
  staff_email: string;
  acknowledged_at: string;
  signature_text: string;
};

const PERMANENT_POLICIES: Policy[] = [
  {
    id: "perm-policy-001",
    slug: "patient-confidentiality-hipaa-privacy",
    title: "1. Patient Confidentiality & HIPAA Privacy Policy",
    category: "Privacy & Clinical Safeguards",
    summary: "Mandatory safeguards for patient privacy, PHI disclosure rules, electronic chart access, and California CMIA confidentiality compliance.",
    body_markdown: `# Patient Confidentiality & HIPAA Privacy Policy

## 1. Purpose
To establish strict procedures protecting Protected Health Information (PHI) and electronic Protected Health Information (ePHI) under 45 CFR Part 160 & 164 and the California Confidentiality of Medical Information Act (CMIA).

## 2. Patient Privacy Safeguards
- **Minimum Necessary Standard**: Workforce members may access only the minimum necessary patient information required to perform clinical duties.
- **Patient Rights**: Patients have the right to inspect, copy, and request amendments to their medical records.
- **PHI Disclosures**: All external PHI disclosures must be logged and maintained in the Disclosure Log for 6 years.

## 3. Physical & Technical Controls
- Patient charts and photos must be encrypted at rest (AES-256) and in transit (TLS 1.3).
- Staff must lock workstations when leaving patient care areas. Automated idle timeout enforces logout after 15 minutes.
`,
    version: 1,
    status: "approved",
    approval_status: "approved",
    approved_by_name: "Dr. Kiem (Privacy & Security Officer)",
    approved_at: "2026-01-01T00:00:00.000Z",
    effective_date: "2026-01-01",
    review_due_date: "2027-01-01",
    updated_at: new Date().toISOString(),
  },
  {
    id: "perm-policy-002",
    slug: "staff-confidentiality-acceptable-use",
    title: "2. Staff Confidentiality & Acceptable Use Policy",
    category: "Workforce & System Security",
    summary: "Workforce standards for computer system access, password management, device security, and electronic communications.",
    body_markdown: `# Staff Confidentiality & Acceptable Use Policy

## 1. Purpose
To outline workforce responsibilities when accessing practice workstations, cloud systems, messaging platforms, and patient records.

## 2. Acceptable Use Standard
- Practice devices and software accounts are restricted to authorized clinical and administrative operations.
- **Multi-Factor Authentication (MFA)** is mandatory for all staff accessing patient management applications.
- Sharing user credentials or login passwords is strictly prohibited.

## 3. Disciplinary Sanctions
- Violations of workforce confidentiality are subject to formal disciplinary action under 45 CFR §164.308(a)(1)(ii)(C), up to and including termination and reporting to California licensing boards.
`,
    version: 1,
    status: "approved",
    approval_status: "approved",
    approved_by_name: "Dr. Kiem (Privacy & Security Officer)",
    approved_at: "2026-01-01T00:00:00.000Z",
    effective_date: "2026-01-01",
    review_due_date: "2027-01-01",
    updated_at: new Date().toISOString(),
  },
  {
    id: "perm-policy-003",
    slug: "workplace-code-of-conduct-compliance",
    title: "3. Workplace Code of Conduct & Compliance Policy",
    category: "Administrative & Ethical Governance",
    summary: "Professional conduct standards, HIPAA compliance commitments, non-retaliation policies, and incident escalation procedures.",
    body_markdown: `# Workplace Code of Conduct & Compliance Policy

## 1. Purpose
To establish ethical standards, professional conduct guidelines, and legal compliance obligations for all Radiantilyk Aesthetic workforce members.

## 2. Code of Professional Conduct
- All workforce members must uphold patient dignity, professional integrity, and full compliance with federal and state healthcare laws.
- Mandatory annual HIPAA training and policy sign-offs are required for all active staff.

## 3. Reporting & Non-Retaliation
- Staff are required to report suspected privacy breaches, security incidents, or policy violations immediately to the Privacy & Security Officer.
- Non-retaliation policy protects any employee who reports suspected compliance violations in good faith.
`,
    version: 1,
    status: "approved",
    approval_status: "approved",
    approved_by_name: "Dr. Kiem (Privacy & Security Officer)",
    approved_at: "2026-01-01T00:00:00.000Z",
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

export default function AdminHipaaPolicies() {
  const { isPrivacyOfficer, user } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<StaffAcknowledgement[]>([]);

  // Dialog State
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<Version | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [staffSignName, setStaffSignName] = useState("");

  // Create Policy Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Administrative Safeguards");
  const [newSummary, setNewSummary] = useState("");

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
          timestamp: "2026-01-01T00:00:00.000Z",
          notes: "Permanent HIPAA policy established and published for practice compliance.",
        },
      ];
      localStorage.setItem(`rka_policy_audit_${policyId}`, JSON.stringify(seed));
      setAuditLogs(seed);
    } else {
      // Filter out minor draft saves to display only simplified compliance events
      const simplified = logs.filter((l) =>
        ["Policy Created", "Policy Updated", "Policy Published", "Policy Rejected", "Policy Deleted (draft only)", "Staff Policy Acknowledged"].includes(l.action)
      );
      setAuditLogs(simplified);
    }
  };

  const loadAcknowledgements = (policyId: string) => {
    const acks: StaffAcknowledgement[] = JSON.parse(localStorage.getItem(`rka_staff_acknowledgements_${policyId}`) || "[]");
    setAcknowledgements(acks);
  };

  const addAuditEntry = (
    policyId: string,
    action: AuditLogEntry["action"],
    notes: string
  ) => {
    const officerName = getOfficerName();
    const logs: AuditLogEntry[] = JSON.parse(localStorage.getItem(`rka_policy_audit_${policyId}`) || "[]");
    const newEntry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      policy_id: policyId,
      action,
      officer_name: officerName,
      officer_role: isPrivacyOfficer ? "Privacy & Security Officer" : "Staff Member",
      timestamp: new Date().toISOString(),
      notes,
    };
    logs.unshift(newEntry);
    localStorage.setItem(`rka_policy_audit_${policyId}`, JSON.stringify(logs));

    const simplified = logs.filter((l) =>
      ["Policy Created", "Policy Updated", "Policy Published", "Policy Rejected", "Policy Deleted (draft only)", "Staff Policy Acknowledged"].includes(l.action)
    );
    setAuditLogs(simplified);
  };

  const submitNewPolicy = async () => {
    if (!newTitle.trim()) {
      toast.error("Policy title is required");
      return;
    }

    const title = newTitle.trim();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
    const newId = `policy-${Date.now()}`;

    const newPolicy: Policy = {
      id: newId,
      slug,
      title,
      category: newCategory || "Administrative Safeguards",
      summary: newSummary.trim() || null,
      body_markdown: `# ${title}\n\n${newSummary ? `> **Summary**: ${newSummary}\n\n` : ""}## 1. Purpose\nTo outline administrative, technical, and physical safeguards governing clinic operations.\n\n## 2. Scope\nApplies to all practice staff, contractors, and clinical systems handling ePHI.\n\n## 3. Policy & Procedures\n- All workforce members must comply with practice HIPAA guidelines.\n`,
      version: 1,
      status: "draft",
      approval_status: "pending_review",
      approved_by_name: null,
      approved_at: null,
      effective_date: new Date().toISOString().split("T")[0],
      review_due_date: null,
      updated_at: new Date().toISOString(),
    };

    addAuditEntry(newId, "Policy Created", `Created initial policy draft "${title}".`);

    const updatedLocal = [...policies, newPolicy];
    setPolicies(updatedLocal);
    localStorage.setItem("rka_perm_hipaa_policies", JSON.stringify(updatedLocal));

    toast.success(`Created new policy "${title}"!`);
    setCreateOpen(false);
    setNewTitle("");
    setNewSummary("");

    setSelectedId(newId);
    setDraft({ ...newPolicy });
  };

  const load = async () => {
    setLoading(true);

    const savedLocal: Policy[] = JSON.parse(localStorage.getItem("rka_perm_hipaa_policies") || "[]");

    const policyMap = new Map<string, Policy>();
    PERMANENT_POLICIES.forEach((p) => policyMap.set(p.id, p));

    if (savedLocal && savedLocal.length > 0) {
      savedLocal.forEach((p) => {
        policyMap.set(p.id, p);
      });
    }

    const finalPolicies = Array.from(policyMap.values());
    localStorage.setItem("rka_perm_hipaa_policies", JSON.stringify(finalPolicies));

    setPolicies(finalPolicies);

    if (finalPolicies.length > 0) {
      const activeId = selectedId && finalPolicies.some((p) => p.id === selectedId) ? selectedId : finalPolicies[0].id;
      setSelectedId(activeId);
      const activePolicy = finalPolicies.find((p) => p.id === activeId) || finalPolicies[0];
      setDraft({ ...activePolicy });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDraft(null);
      setVersions([]);
      setAuditLogs([]);
      setAcknowledgements([]);
      return;
    }
    const p = policies.find((x) => x.id === selectedId);
    if (!p) return;
    setDraft({ ...p });

    // Load archived version history for compliance review
    const localVersions: Version[] = JSON.parse(localStorage.getItem(`rka_demo_versions_${selectedId}`) || "[]");
    if (localVersions.length === 0) {
      const seedVer: Version = {
        id: `ver-v1-${selectedId}`,
        version: 1,
        title: p.title,
        summary: p.summary,
        body_markdown: p.published_body_markdown || p.body_markdown,
        approved_at: p.approved_at || "2026-01-01T00:00:00.000Z",
        approved_by_name: p.approved_by_name || "Dr. Kiem (Privacy & Security Officer)",
        effective_date: p.effective_date || "2026-01-01",
      };
      localStorage.setItem(`rka_demo_versions_${selectedId}`, JSON.stringify([seedVer]));
      setVersions([seedVer]);
    } else {
      setVersions(localVersions);
    }

    loadAuditLogs(selectedId);
    loadAcknowledgements(selectedId);
  }, [selectedId, policies]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return policies.filter(
      (p) =>
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.summary || "").toLowerCase().includes(q)
    );
  }, [policies, search]);

  // Workflow 1: Save Draft Revision
  const saveDraftRevision = async () => {
    if (!draft) return;
    setSaving(true);

    const isDraftState = draft.status === "draft";
    const updatePayload = {
      title: draft.title,
      category: draft.category,
      summary: draft.summary,
      body_markdown: draft.body_markdown,
      effective_date: draft.effective_date,
      review_due_date: draft.review_due_date,
      status: "draft" as const,
      approval_status: "pending_review" as const,
      updated_at: new Date().toISOString(),
    };

    const updatedLocal = policies.map((p) => (p.id === draft.id ? { ...p, ...updatePayload } : p));
    setPolicies(updatedLocal);
    localStorage.setItem("rka_perm_hipaa_policies", JSON.stringify(updatedLocal));

    if (!isDraftState) {
      addAuditEntry(draft.id, "Policy Updated", `Created draft revision for ${draft.title}. Pending officer approval.`);
    }

    setDraft({ ...draft, ...updatePayload });
    setSaving(false);
    toast.success("Draft revision saved cleanly.");
  };

  // Workflow 2: Approve & Publish Policy Draft
  const approveAndPublish = async () => {
    if (!draft) return;
    if (!isPrivacyOfficer) {
      toast.error("Access Denied: Only Privacy & Security Officers can publish policies.");
      return;
    }

    const nextVersion = draft.status === "draft" ? draft.version + 1 : draft.version;

    if (
      !(await confirmDialog({
        title: `Publish Version ${nextVersion} of "${draft.title}"?`,
        description: `This draft will become the official active version v${nextVersion}. Previous version will be automatically archived in compliance history.`,
        confirmLabel: `Publish v${nextVersion}`,
      }))
    )
      return;

    setSaving(true);
    const officerName = getOfficerName();
    const nowISO = new Date().toISOString();

    const publishPayload = {
      title: draft.title,
      category: draft.category,
      summary: draft.summary,
      body_markdown: draft.body_markdown,
      published_body_markdown: draft.body_markdown,
      effective_date: draft.effective_date || new Date().toISOString().split("T")[0],
      review_due_date: draft.review_due_date,
      version: nextVersion,
      status: "approved" as const,
      approval_status: "approved" as const,
      approved_by_name: officerName,
      approved_at: nowISO,
      updated_at: nowISO,
    };

    // Archive previous version to version history store
    const localVersions: Version[] = JSON.parse(localStorage.getItem(`rka_demo_versions_${draft.id}`) || "[]");
    localVersions.unshift({
      id: `ver-${Date.now()}`,
      version: nextVersion,
      title: draft.title,
      summary: draft.summary,
      body_markdown: draft.body_markdown,
      approved_at: nowISO,
      approved_by_name: officerName,
      effective_date: publishPayload.effective_date,
    });
    localStorage.setItem(`rka_demo_versions_${draft.id}`, JSON.stringify(localVersions));
    setVersions(localVersions);

    // Write audit log
    addAuditEntry(draft.id, "Policy Published", `Published official active version v${nextVersion} by ${officerName}. Previous version archived.`);

    const updatedLocal = policies.map((p) => (p.id === draft.id ? { ...p, ...publishPayload } : p));
    setPolicies(updatedLocal);
    localStorage.setItem("rka_perm_hipaa_policies", JSON.stringify(updatedLocal));

    setDraft({ ...draft, ...publishPayload });
    setSaving(false);
    toast.success(`Policy Published as v${nextVersion}!`);
  };

  // Workflow 3: Reject Draft
  const rejectDraft = async () => {
    if (!draft) return;
    if (!isPrivacyOfficer) {
      toast.error("Access Denied: Only Privacy & Security Officers can reject policy drafts.");
      return;
    }

    if (
      !(await confirmDialog({
        title: `Reject Draft for "${draft.title}"?`,
        description: "This draft revision will be rejected and returned to revision state.",
        destructive: true,
        confirmLabel: "Reject Draft",
      }))
    )
      return;

    setSaving(true);
    const officerName = getOfficerName();

    addAuditEntry(draft.id, "Policy Rejected", `Draft revision rejected by ${officerName}. Revisions requested.`);

    const updated = {
      ...draft,
      approval_status: "rejected" as const,
      updated_at: new Date().toISOString(),
    };

    const updatedLocal = policies.map((p) => (p.id === draft.id ? updated : p));
    setPolicies(updatedLocal);
    localStorage.setItem("rka_perm_hipaa_policies", JSON.stringify(updatedLocal));

    setDraft(updated);
    setSaving(false);
    toast.error(`Draft rejected by ${officerName}`);
  };

  // Workflow 4: Delete Policy (Available to Privacy & Security Officers)
  const deletePolicy = async (targetId?: string) => {
    const idToDelete = targetId || draft?.id;
    if (!idToDelete) return;
    const policyToDelete = policies.find((p) => p.id === idToDelete) || draft;
    if (!policyToDelete) return;

    if (!isPrivacyOfficer) {
      toast.error("Access Denied: Only Privacy & Security Officers can delete policies.");
      return;
    }

    if (
      !(await confirmDialog({
        title: `Delete Policy "${policyToDelete.title}"?`,
        description: "Are you sure you want to delete this policy? This action will permanently remove the policy and its historical version records.",
        destructive: true,
        confirmLabel: "Delete Policy",
      }))
    )
      return;

    setSaving(true);

    const updatedLocal = policies.filter((p) => p.id !== idToDelete);
    setPolicies(updatedLocal);
    localStorage.setItem("rka_perm_hipaa_policies", JSON.stringify(updatedLocal));

    localStorage.removeItem(`rka_policy_audit_${idToDelete}`);
    localStorage.removeItem(`rka_demo_versions_${idToDelete}`);
    localStorage.removeItem(`rka_staff_acknowledgements_${idToDelete}`);

    toast.success(`Policy "${policyToDelete.title}" deleted successfully`);

    if (selectedId === idToDelete || !draft || draft.id === idToDelete) {
      if (updatedLocal.length > 0) {
        setSelectedId(updatedLocal[0].id);
        setDraft({ ...updatedLocal[0] });
      } else {
        setSelectedId(null);
        setDraft(null);
      }
    }

    setSaving(false);
  };

  // Delete Individual Historical Version Record
  const deleteHistoricalVersion = async (ver: Version) => {
    if (!draft) return;
    if (!isPrivacyOfficer) {
      toast.error("Access Denied: Only Privacy & Security Officers can delete historical version records.");
      return;
    }

    if (
      !(await confirmDialog({
        title: `Delete Version v${ver.version}?`,
        description: `Are you sure you want to delete the archived version record v${ver.version} of "${draft.title}"?`,
        destructive: true,
        confirmLabel: "Delete Version Record",
      }))
    )
      return;

    const localVersions: Version[] = JSON.parse(localStorage.getItem(`rka_demo_versions_${draft.id}`) || "[]");
    const updatedVersions = localVersions.filter((v) => v.id !== ver.id && v.version !== ver.version);
    localStorage.setItem(`rka_demo_versions_${draft.id}`, JSON.stringify(updatedVersions));
    setVersions(updatedVersions);

    if (selectedHistoryVersion?.id === ver.id) {
      setSelectedHistoryVersion(null);
    }

    toast.success(`Archived version v${ver.version} deleted successfully`);
  };

  // Staff Policy Sign-off
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

    addAuditEntry(draft.id, "Staff Policy Acknowledged", `Policy v${draft.version} read and electronically signed by staff member ${name} (${email}).`);

    setAcknowledgements(currentAcks);
    setSignOpen(false);
    setStaffSignName("");
    toast.success(`Policy v${draft.version} signed by ${name}!`);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-2xl md:text-3xl font-medium tracking-tight text-foreground">
              HIPAA Policies & Compliance Governance
            </h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              <ShieldCheck className="h-3.5 w-3.5 mr-1 inline" /> Compliance Governance
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Official practice policy management, version history, staff sign-offs, and simplified HIPAA compliance audit records.
          </p>
        </div>

        {isPrivacyOfficer && (
          <Button onClick={() => setCreateOpen(true)} className="h-9 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs">
            <Plus className="h-4 w-4" /> Create New Policy
          </Button>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left List */}
        <div className="md:col-span-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter policies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-9 bg-card border-border/80"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                COMPLIANCE POLICIES ({policies.length})
              </div>
            </div>
            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-xs">Loading compliance policies...</span>
              </div>
            ) : (
              filtered.map((p) => {
                const isSel = p.id === selectedId;
                const isDraft = p.status === "draft";
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedId(p.id);
                      setDraft({ ...p });
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border text-xs transition ${
                      isSel
                        ? "border-primary bg-primary/5 shadow-2xs font-medium"
                        : "border-border/80 bg-card hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="font-semibold text-foreground flex items-center justify-between gap-2">
                      <span className="truncate">{p.title}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 ${
                            isDraft
                              ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                              : "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                          }`}
                        >
                          {isDraft ? "Draft" : `v${p.version}`}
                        </Badge>
                        {isPrivacyOfficer && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePolicy(p.id);
                            }}
                            className="p-1 text-muted-foreground hover:text-rose-600 rounded hover:bg-rose-50 transition"
                            title="Delete Policy"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate mt-1">{p.summary}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Policy Detail / Editor */}
        <Card className="md:col-span-8 p-5 space-y-4 rounded-2xl border border-border/80 bg-card">
          {!draft ? (
            <div className="py-24 text-center text-xs text-muted-foreground">
              Select one of the compliance policies to view or edit.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-lg font-semibold text-foreground">{draft.title}</h2>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold uppercase ${
                        draft.status === "draft"
                          ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                      }`}
                    >
                      {draft.status === "draft" ? "Draft Revision" : `v${draft.version} · Published`}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                    Category: {draft.category} · Updated {new Date(draft.updated_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setVersionHistoryOpen(true)} className="h-8 text-xs gap-1.5">
                    <History className="h-3.5 w-3.5 text-primary" /> View Version History
                  </Button>

                  <Button variant="outline" size="sm" onClick={() => setSignOpen(true)} className="h-8 text-xs gap-1.5">
                    <FileSignature className="h-3.5 w-3.5 text-emerald-600" /> Sign Policy
                  </Button>
                </div>
              </div>

              {/* Status Banner */}
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1">
                <div className="font-semibold text-foreground flex items-center justify-between">
                  <span>Policy Status & Approval Review</span>
                  <Badge variant="outline" className="text-[10px]">
                    {draft.status === "approved"
                      ? "🟢 Active Published Version (Locked for Audit)"
                      : "🟡 Draft Revision (Pending Officer Approval)"}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-border/50 font-mono">
                  <div>
                    Approved By: <strong>{draft.approved_by_name || "Dr. Kiem (Privacy & Security Officer)"}</strong>
                  </div>
                  <div>
                    Effective Date: <strong>{draft.effective_date || "2026-01-01"}</strong>
                  </div>
                  <div>
                    Staff Signatures: <strong>{acknowledgements.length} acknowledged</strong>
                  </div>
                </div>
              </div>

              {/* Content Form */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Summary</label>
                  <Input
                    value={draft.summary || ""}
                    onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Effective Date</label>
                  <Input
                    type="date"
                    value={draft.effective_date || ""}
                    onChange={(e) => setDraft({ ...draft, effective_date: e.target.value || null })}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium font-mono">Next Annual Review</label>
                  <Input
                    type="date"
                    value={draft.review_due_date || ""}
                    onChange={(e) => setDraft({ ...draft, review_due_date: e.target.value || null })}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium">Policy Markdown Content</label>
                <Textarea
                  value={draft.body_markdown}
                  onChange={(e) => setDraft({ ...draft, body_markdown: e.target.value })}
                  className="font-mono text-xs min-h-[360px] mt-1 bg-background border-border/80"
                />
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap gap-2 pt-3 border-t items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button onClick={saveDraftRevision} disabled={saving} variant="outline" size="sm" className="h-9 text-xs">
                    <Save className="h-3.5 w-3.5 mr-1.5" /> Save Draft
                  </Button>

                  {isPrivacyOfficer ? (
                    <>
                      <Button onClick={approveAndPublish} disabled={saving} size="sm" className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Approve & Publish
                      </Button>

                      {draft.status === "draft" && (
                        <Button onClick={rejectDraft} disabled={saving} size="sm" variant="outline" className="h-9 text-xs border-amber-300 text-amber-800 hover:bg-amber-50">
                          <XCircle className="h-3.5 w-3.5 mr-1.5 text-amber-600" /> Reject Draft
                        </Button>
                      )}

                      <Button onClick={() => deletePolicy()} disabled={saving} size="sm" variant="destructive" className="h-9 text-xs">
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Policy
                      </Button>
                    </>
                  ) : (
                    <Button disabled variant="outline" size="sm" className="h-9 text-xs opacity-60 cursor-not-allowed">
                      <Lock className="h-3.5 w-3.5 mr-1.5" /> Approval & Publishing Restricted to Security Officer
                    </Button>
                  )}
                </div>

                {draft.status === "approved" && (
                  <span className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                    <Lock className="h-3 w-3 text-emerald-600" /> Published policy is locked. Edits create a new draft.
                  </span>
                )}
              </div>

              {/* Simplified Audit History */}
              {isPrivacyOfficer && (
                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5 text-primary" /> Simplified Audit Log ({auditLogs.length} events)
                    </h3>
                    <span className="text-[11px] text-muted-foreground font-mono">{acknowledgements.length} staff signatures</span>
                  </div>

                  {auditLogs.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">No audit events recorded yet.</div>
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden bg-card text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border font-mono">
                          <tr>
                            <th className="p-2.5">Event Action</th>
                            <th className="p-2.5">Officer / User</th>
                            <th className="p-2.5">Details</th>
                            <th className="p-2.5 text-right">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {auditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-muted/30">
                              <td className="p-2.5 font-medium text-foreground">
                                <Badge variant="outline" className="text-[9px] font-semibold">
                                  {log.action}
                                </Badge>
                              </td>
                              <td className="p-2.5 text-muted-foreground">{log.officer_name}</td>
                              <td className="p-2.5 text-muted-foreground">{log.notes}</td>
                              <td className="p-2.5 text-right font-mono text-[10px] text-muted-foreground">
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Modal: View Version History */}
      <Dialog open={versionHistoryOpen} onOpenChange={setVersionHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-semibold flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Historical Published Versions — {draft?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Complete HIPAA compliance version history stored for audit inspection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {versions.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No historical versions archived yet.</div>
            ) : (
              versions.map((ver) => (
                <div key={ver.id} className="p-3.5 rounded-xl border border-border bg-card space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px] font-bold">
                        v{ver.version} · Published
                      </Badge>
                      <span className="font-semibold text-foreground">{ver.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">{new Date(ver.approved_at).toLocaleDateString()}</span>
                  </div>

                  <p className="text-[11px] text-muted-foreground">{ver.summary || "No summary provided."}</p>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/50 font-mono">
                    <span>Approved By: {ver.approved_by_name || "Privacy & Security Officer"}</span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedHistoryVersion(ver)}
                        className="h-7 text-[11px] gap-1 text-primary"
                      >
                        <Eye className="h-3 w-3" /> View Markdown
                      </Button>
                      {isPrivacyOfficer && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteHistoricalVersion(ver)}
                          className="h-7 text-[11px] gap-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-3 w-3" /> Delete Version
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: View Specific Version Content */}
      <Dialog open={!!selectedHistoryVersion} onOpenChange={() => setSelectedHistoryVersion(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-semibold flex items-center justify-between">
              <span>{selectedHistoryVersion?.title} (Version v{selectedHistoryVersion?.version})</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadFile(
                    `${selectedHistoryVersion?.title.replace(/[^a-z0-9]/gi, "_")}_v${selectedHistoryVersion?.version}.md`,
                    selectedHistoryVersion?.body_markdown || "",
                    "text/markdown"
                  )
                }
                className="h-8 text-xs gap-1"
              >
                <Download className="h-3.5 w-3.5" /> Download Markdown
              </Button>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">
              Published on {selectedHistoryVersion?.approved_at ? new Date(selectedHistoryVersion.approved_at).toLocaleString() : ""} by {selectedHistoryVersion?.approved_by_name}
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 rounded-xl border border-border bg-muted/20 font-mono text-xs whitespace-pre-wrap max-h-[500px] overflow-y-auto">
            {selectedHistoryVersion?.body_markdown}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Staff Policy E-Signature */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-semibold flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-emerald-600" /> Sign Policy Acknowledgement
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Electronically sign and confirm that you have read and agree to comply with <strong>{draft?.title} (v{draft?.version})</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-foreground">Your Full Legal Name</label>
              <Input
                placeholder="e.g., Kiem Vukadinovic, NP"
                value={staffSignName}
                onChange={(e) => setStaffSignName(e.target.value)}
                className="mt-1 text-xs h-9"
              />
            </div>
            <div className="p-3 rounded-xl bg-muted/40 text-[11px] text-muted-foreground space-y-1 font-mono">
              <div>Policy Title: {draft?.title}</div>
              <div>Policy Version: v{draft?.version}</div>
              <div>Timestamp: {new Date().toLocaleString()}</div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setSignOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitStaffAcknowledgement} className="bg-emerald-600 hover:bg-emerald-700 text-xs">
              Electronically Sign & Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Create New Policy */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-semibold flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Create New HIPAA Policy
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a new practice policy to the HIPAA compliance registry.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-foreground">Policy Title</label>
              <Input
                placeholder="e.g., Device Encryption & Remote Access Policy"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1 text-xs h-9"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Category</label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="mt-1 h-9 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrative Safeguards">Administrative Safeguards</SelectItem>
                  <SelectItem value="Technical Safeguards">Technical Safeguards</SelectItem>
                  <SelectItem value="Physical Safeguards">Physical Safeguards</SelectItem>
                  <SelectItem value="Privacy & Clinical Safeguards">Privacy & Clinical Safeguards</SelectItem>
                  <SelectItem value="Workforce & System Security">Workforce & System Security</SelectItem>
                  <SelectItem value="Administrative & Ethical Governance">Administrative & Ethical Governance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Summary (Optional)</label>
              <Textarea
                placeholder="Brief summary of policy requirements..."
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                className="mt-1 text-xs min-h-[80px]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitNewPolicy} className="bg-primary text-xs">
              Create Policy Draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
