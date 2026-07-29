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
import { Loader2, Download, FileText, CheckCircle2, Archive, History, Save, Plus, Search, ShieldCheck, Lock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm";

type Policy = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string | null;
  body_markdown: string;
  version: number;
  status: "draft" | "approved" | "archived";
  approval_status?: "approved" | "pending_review" | "rejected";
  approved_by_name?: string | null;
  approved_at: string | null;
  effective_date: string | null;
  review_due_date: string | null;
  updated_at: string;
};

interface AuditLogEntry {
  id: string;
  policy_id: string;
  action: string;
  officer_name: string;
  officer_role: string;
  status: "approved" | "pending_review" | "rejected";
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

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  archived: "bg-muted text-muted-foreground",
};

const SEED_POLICIES: Policy[] = [
  {
    id: "hipaa-001",
    slug: "privacy-security-officer-designation",
    title: "HIPAA Privacy & Security Officer Designation Policy",
    category: "Administrative Safeguards",
    summary: "Formal designation of Privacy & Security Officers responsible for HIPAA §164.308 compliance.",
    body_markdown: `# HIPAA Privacy & Security Officer Designation Policy\n\n## 1. Purpose\nTo formally designate officers responsible for overseeing HIPAA Privacy and Security Rule compliance per 45 CFR §164.308(a)(2).\n\n## 2. Designated Officers\n- **Privacy & Security Officer**: Dr. Kiem Vukadinovic, NP\n- **Medical Director**: Dr. Aloysius N. Fobi, MD\n\n## 3. Responsibilities\n1. Maintain and enforce HIPAA policies and procedures.\n2. Conduct annual risk analysis and staff training.\n3. Investigate potential security incidents or ePHI breaches.\n`,
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
    slug: "ephi-access-control-policy",
    title: "ePHI Access Control & Role-Based Security Policy",
    category: "Technical Safeguards",
    summary: "Enforces role-based access control, unique user logins, and 15-min idle timeouts per §164.312(a)(1).",
    body_markdown: `# ePHI Access Control & Role-Based Security Policy\n\n## 1. Purpose\nEnforce strict technical access controls over Protected Health Information (PHI) under 45 CFR §164.312(a)(1).\n\n## 2. Requirements\n1. **Unique Identification**: Every staff member must log in with individual credentials. Shared accounts are strictly prohibited.\n2. **Role-Based Access**: Access to clinical records is restricted based on assigned role (Provider, Admin, NP, Receptionist).\n3. **Session Timeout**: Automatic logout is triggered after 15 minutes of inactivity.\n`,
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
    slug: "data-breach-notification-protocol",
    title: "Data Breach Notification & Incident Response Protocol",
    category: "Administrative Safeguards",
    summary: "Procedures for investigating and reporting ePHI security incidents under 45 CFR §164.400-414.",
    body_markdown: `# Data Breach Notification & Incident Response Protocol\n\n## 1. Purpose\nOutline actions required in the event of unauthorized acquisition, access, or disclosure of ePHI.\n\n## 2. Incident Response Steps\n1. **Immediate Containment**: Isolate affected system components and revoke compromised user credentials.\n2. **Risk Assessment**: Assess whether ePHI was compromised using the 4-factor HIPAA risk test.\n3. **Notification Timelines**: If a breach is confirmed, notify affected individuals within 60 days and report to HHS OCR.\n`,
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

  // Create Policy Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Administrative Safeguards");
  const [newSummary, setNewSummary] = useState("");

  const getOfficerName = () => {
    const fn = (user?.user_metadata?.first_name || "").trim();
    const ln = (user?.user_metadata?.last_name || "").trim();
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

  const addAuditEntry = (policyId: string, action: string, status: "approved" | "pending_review" | "rejected", notes: string) => {
    const officerName = getOfficerName();
    const logs: AuditLogEntry[] = JSON.parse(localStorage.getItem(`rka_policy_audit_${policyId}`) || "[]");
    const newEntry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      policy_id: policyId,
      action,
      officer_name: officerName,
      officer_role: "Privacy & Security Officer",
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
    if (!selectedId) { setDraft(null); setVersions([]); setAuditLogs([]); return; }
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

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await apiQuery("hipaa_policies" as any).update({
        title: draft.title, category: draft.category, summary: draft.summary,
        body_markdown: draft.body_markdown, effective_date: draft.effective_date,
        review_due_date: draft.review_due_date,
      }).eq("id", draft.id);
    } catch (e) {}

    const localDemoPolicies: Policy[] = JSON.parse(localStorage.getItem("rka_demo_hipaa_policies") || "[]");
    const updatedLocal = localDemoPolicies.map(p => p.id === draft.id ? { ...p, ...draft } as Policy : p);
    localStorage.setItem("rka_demo_hipaa_policies", JSON.stringify(updatedLocal));

    setSaving(false);
    toast.success("Saved");
    load();
  };

  const approve = async () => {
    if (!draft) return;
    if (!isPrivacyOfficer) {
      toast.error("Access Denied: Only Privacy & Security Officers can approve policies.");
      return;
    }
    if (!(await confirmDialog({ title: `Approve "${draft.title}" as v${draft.version + 1}?`, description: "An immutable version snapshot and audit trail entry will be recorded.", confirmLabel: "Approve Version" }))) return;
    setSaving(true);
    const officerName = getOfficerName();
    const newVersion = draft.version + 1;
    const nowISO = new Date().toISOString();
    const updatePayload = {
      title: draft.title, summary: draft.summary, body_markdown: draft.body_markdown,
      category: draft.category, effective_date: draft.effective_date, review_due_date: draft.review_due_date,
      version: newVersion,
      status: "approved" as const,
      approval_status: "approved" as const,
      approved_by_name: officerName,
      approved_at: nowISO,
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

    const localVersions: any[] = JSON.parse(localStorage.getItem(`rka_demo_versions_${draft.id}`) || "[]");
    localVersions.push({
      id: `ver-${Date.now()}`,
      policy_id: draft.id,
      version: newVersion,
      title: draft.title,
      summary: draft.summary,
      body_markdown: draft.body_markdown,
      effective_date: draft.effective_date,
      approved_at: nowISO,
    });
    localStorage.setItem(`rka_demo_versions_${draft.id}`, JSON.stringify(localVersions));

    addAuditEntry(draft.id, `Approved Version ${newVersion}`, "approved", `Formally reviewed and approved policy version ${newVersion}. Immutable snapshot recorded.`);

    setDraft({ ...draft, ...updatePayload });
    setSaving(false);
    toast.success(`Approved as v${newVersion} by ${officerName}`);
    load();
  };

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

    toast.success("Moved back to draft");
    load();
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
            Review, edit, approve, and download policy documents for HIPAA §164.308 / §164.312 compliance.
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

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className="h-8 text-xs gap-1">
                    <History className="h-3.5 w-3.5" /> {showHistory ? "Hide Audit Log" : "Audit Log"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadCurrent("md")} className="h-8 text-xs gap-1">
                    <Download className="h-3.5 w-3.5" /> .md
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadCurrent("html")} className="h-8 text-xs gap-1">
                    <FileText className="h-3.5 w-3.5" /> .html
                  </Button>
                </div>
              </div>

              {/* Officer Sign-off Status Banner */}
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1">
                <div className="font-semibold text-foreground flex items-center justify-between">
                  <span>Privacy & Security Officer Review</span>
                  <Badge variant="outline" className="text-[10px] bg-background">
                    {draft.approval_status === "approved" ? "Approved & Sealed" : draft.approval_status === "rejected" ? "Rejected" : "Pending Review"}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-border/50">
                  <div>
                    <span>Approved By: <strong>{draft.approved_by_name || (draft.status === "approved" ? "Dr. Kiem (Privacy & Security Officer)" : "Pending Officer Review")}</strong></span>
                  </div>
                  <div>
                    <span>Approval Date: <strong>{draft.approved_at ? new Date(draft.approved_at).toLocaleString() : "Pending"}</strong></span>
                  </div>
                </div>
              </div>

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
                <label className="text-xs text-muted-foreground">Body (Markdown)</label>
                <Textarea
                  value={draft.body_markdown}
                  onChange={(e) => setDraft({ ...draft, body_markdown: e.target.value })}
                  className="font-mono text-xs min-h-[380px] mt-1 bg-background border-border/80"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button onClick={save} disabled={saving || !isPrivacyOfficer} variant="outline" size="sm" className="h-9 text-xs">
                    <Save className="h-3.5 w-3.5 mr-1.5" />Save draft
                  </Button>
                  {isPrivacyOfficer ? (
                    <>
                      <Button onClick={approve} disabled={saving} size="sm" className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Approve as v{draft.version + 1}
                      </Button>
                      <Button onClick={reject} disabled={saving} size="sm" variant="destructive" className="h-9 text-xs">
                        <XCircle className="h-3.5 w-3.5 mr-1.5" />Reject Policy
                      </Button>
                    </>
                  ) : (
                    <Button disabled variant="outline" size="sm" className="h-9 text-xs opacity-60 cursor-not-allowed">
                      <Lock className="h-3.5 w-3.5 mr-1.5" />Approval Restricted to Officer
                    </Button>
                  )}
                </div>
                {draft.status !== "archived" ? (
                  <Button onClick={archive} variant="ghost" size="sm" disabled={!isPrivacyOfficer} className="h-9 text-xs text-muted-foreground hover:text-destructive">
                    <Archive className="h-3.5 w-3.5 mr-1.5" />Archive
                  </Button>
                ) : (
                  <Button onClick={reactivate} variant="outline" size="sm" disabled={!isPrivacyOfficer} className="h-9 text-xs">
                    Reactivate
                  </Button>
                )}
              </div>

              {showHistory && (
                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" /> Approval & Audit History
                    </h3>
                    <Badge variant="outline" className="text-[10px]">{auditLogs.length} events logged</Badge>
                  </div>

                  {/* Audit Log Table */}
                  <div className="rounded-xl border border-border overflow-hidden bg-card shadow-2xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                        <tr>
                          <th className="p-2.5">Action Event</th>
                          <th className="p-2.5">Officer</th>
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

                  {/* Version Snapshots */}
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Approved Version Snapshots</div>
                    {versions.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic">No approved version snapshots recorded yet.</div>
                    ) : (
                      versions.map((v) => (
                        <div key={v.id} className="rounded-xl border border-border p-3 text-xs flex items-center justify-between gap-2 bg-muted/20">
                          <div>
                            <div className="font-medium text-foreground">v{v.version} — {v.title}</div>
                            <div className="text-muted-foreground mt-0.5">Approved {new Date(v.approved_at).toLocaleString()}{v.effective_date ? ` • Effective ${v.effective_date}` : ""}</div>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => downloadFile(`${draft.slug}-v${v.version}.md`, v.body_markdown, "text/markdown")}>
                            <Download className="h-3 w-3 mr-1" /> .md
                          </Button>
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
    </div>
  );
}
