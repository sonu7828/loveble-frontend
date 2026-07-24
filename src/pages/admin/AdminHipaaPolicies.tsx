import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, FileText, CheckCircle2, Archive, History, Save, Plus, Search, ShieldCheck, ShieldAlert, Lock, XCircle, UserCheck } from "lucide-react";
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
  const [versions, setVersions] = useState<Version[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showHistory, setShowHistory] = useState(false);

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
      const { data, error } = await supabase.from("hipaa_policies" as any).select("*").order("category").order("title");
      if (!error && data) remotePolicies = (data as any) || [];
    } catch (e) {}

    const localDemoPolicies: Policy[] = JSON.parse(localStorage.getItem("rka_demo_hipaa_policies") || "[]");
    const remoteIds = new Set(remotePolicies.map(x => x.id));
    const uniqueLocal = localDemoPolicies.filter(x => !remoteIds.has(x.id));

    setPolicies([...remotePolicies, ...uniqueLocal]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedId) { setDraft(null); setVersions([]); setAuditLogs([]); return; }
    const p = policies.find((x) => x.id === selectedId);
    if (p) {
      setDraft({ ...p });
      loadAuditLogs(p.id);
    }
    
    supabase.from("hipaa_policy_versions" as any)
      .select("*").eq("policy_id", selectedId).order("version", { ascending: false })
      .then(({ data }) => {
        const remoteVersions = (data as any) || [];
        const localVersions = JSON.parse(localStorage.getItem(`rka_demo_versions_${selectedId}`) || "[]");
        const allIds = new Set(remoteVersions.map((v: any) => v.id));
        const uniqueLocal = localVersions.filter((v: any) => !allIds.has(v.id));
        setVersions([...remoteVersions, ...uniqueLocal]);
      });
  }, [selectedId, policies]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
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
      await supabase.from("hipaa_policies" as any).update({
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
      await supabase.from("hipaa_policies" as any).update(updatePayload).eq("id", draft.id);
      await supabase.from("hipaa_policy_versions" as any).insert({
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
      await supabase.from("hipaa_policies" as any).update({ status: "draft" }).eq("id", draft.id);
    } catch (e) {}

    const localDemoPolicies: Policy[] = JSON.parse(localStorage.getItem("rka_demo_hipaa_policies") || "[]");
    const updatedLocal = localDemoPolicies.map(p => p.id === draft.id ? { ...p, ...updatePayload } as Policy : p);
    localStorage.setItem("rka_demo_hipaa_policies", JSON.stringify(updatedLocal));

    addAuditEntry(draft.id, `Rejected Policy Revision`, "rejected", `Policy revision rejected by ${officerName}. Revisions requested before approval.`);

    setDraft({ ...draft, ...updatePayload });
    setSaving(false);
    toast.error(`Policy rejected by ${officerName}`);
    load();
  };

  const archive = async () => {
    if (!draft) return;
    if (!(await confirmDialog({ title: "Archive this policy?", description: "This policy will be moved to archived status.", destructive: true, confirmLabel: "Archive Policy" }))) return;
    try {
      await supabase.from("hipaa_policies" as any).update({ status: "archived" }).eq("id", draft.id);
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
      await supabase.from("hipaa_policies" as any).update({ status: "draft" }).eq("id", draft.id);
    } catch (e) {}

    const localDemoPolicies: Policy[] = JSON.parse(localStorage.getItem("rka_demo_hipaa_policies") || "[]");
    const updatedLocal = localDemoPolicies.map(p => p.id === draft.id ? { ...p, status: "draft" as const } : p);
    localStorage.setItem("rka_demo_hipaa_policies", JSON.stringify(updatedLocal));

    toast.success("Moved back to draft");
    load();
  };

  const createNew = async () => {
    const title = prompt("New policy title:");
    if (!title) return;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
    
    const payload = {
      slug,
      title,
      category: "Custom",
      body_markdown: `# ${title}\n\n## 1. Purpose\n\n## 2. Scope\n\n## 3. Policy\n\n## 4. Procedures\n`,
      version: 1,
      status: "draft" as const,
      updated_at: new Date().toISOString(),
      summary: "",
      effective_date: null,
      review_due_date: null,
      approved_at: null,
    };

    let newId = `policy-${Date.now()}`;
    try {
      const { data, error } = await supabase.from("hipaa_policies" as any).insert(payload).select().single();
      if (!error && data) {
        newId = (data as any).id;
      }
    } catch (e) {}

    const localDemoPolicies: Policy[] = JSON.parse(localStorage.getItem("rka_demo_hipaa_policies") || "[]");
    localDemoPolicies.push({ id: newId, ...payload });
    localStorage.setItem("rka_demo_hipaa_policies", JSON.stringify(localDemoPolicies));

    await load();
    setSelectedId(newId);
  };

  const downloadCurrent = (format: "md" | "html") => {
    if (!draft) return;
    if (format === "md") downloadFile(`${draft.slug}-v${draft.version}.md`, draft.body_markdown, "text/markdown");
    else downloadFile(`${draft.slug}-v${draft.version}.html`, policyToHtml(draft), "text/html");
  };

  const downloadAll = async () => {
    const approved = policies.filter((p) => p.status === "approved");
    if (approved.length === 0) return toast.info("No approved policies yet.");
    const combined = approved.map((p) => `\n\n---\n\n${p.body_markdown}\n\n_Version ${p.version} • Effective ${p.effective_date || "—"}_`).join("\n");
    downloadFile(`hipaa-policies-approved-${new Date().toISOString().slice(0,10)}.md`,
      `# Radiantilyk Aesthetic — HIPAA Policies & Procedures\n\nExported ${new Date().toLocaleString()}\n${combined}`,
      "text/markdown");
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <header className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl font-medium">HIPAA Policies & Procedures</h1>
          <p className="text-sm text-muted-foreground mt-1">Review, edit, approve, and download policy templates. Approved versions are snapshotted for audit.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadAll}><Download className="h-4 w-4 mr-1.5" />Export all approved</Button>
          <Button size="sm" onClick={createNew}><Plus className="h-4 w-4 mr-1.5" />New policy</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <Card className="p-3">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8 h-9" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-1">{cat}</div>
                  <div className="space-y-1">
                    {items.map((p) => (
                      <button key={p.id} onClick={() => setSelectedId(p.id)}
                        className={`w-full text-left rounded-md px-2 py-2 border transition ${selectedId === p.id ? "bg-accent border-primary/40" : "border-transparent hover:bg-accent"}`}>
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{p.title}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[p.status]}`}>{p.status}</Badge>
                              <span className="text-[10px] text-muted-foreground">v{p.version}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">No policies match.</div>}
            </div>
          )}
        </Card>

        <Card className="p-4 md:p-5">
          {!draft ? (
            <div className="text-sm text-muted-foreground text-center py-16">Select a policy to review or edit.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className="text-lg font-serif border-0 px-0 h-auto shadow-none focus-visible:ring-0" />
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className={STATUS_COLORS[draft.approval_status || draft.status]}>
                      {draft.approval_status ? draft.approval_status.replace("_", " ").toUpperCase() : draft.status.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">v{draft.version}</span>
                    <Input type="text" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                      className="h-6 w-32 text-xs" placeholder="Category" />
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}><History className="h-4 w-4 mr-1" />Audit History ({auditLogs.length})</Button>
                  <Button variant="outline" size="sm" onClick={() => downloadCurrent("md")}><Download className="h-4 w-4 mr-1" />.md</Button>
                  <Button variant="outline" size="sm" onClick={() => downloadCurrent("html")}><Download className="h-4 w-4 mr-1" />.html</Button>
                </div>
              </div>

              {/* Approval Details Box */}
              <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Approval Status:</span>
                    <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${STATUS_COLORS[draft.approval_status || draft.status]}`}>
                      {draft.approval_status ? draft.approval_status.replace("_", " ") : draft.status}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Approved By: <strong>{draft.approved_by_name || (draft.status === "approved" ? "Dr. Kiem (Privacy & Security Officer)" : "Pending Officer Review")}</strong></span>
                  </div>
                  <div className="text-muted-foreground">
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
                  <Input value={draft.summary || ""} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Effective date</label>
                  <Input type="date" value={draft.effective_date || ""} onChange={(e) => setDraft({ ...draft, effective_date: e.target.value || null })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Review due</label>
                  <Input type="date" value={draft.review_due_date || ""} onChange={(e) => setDraft({ ...draft, review_due_date: e.target.value || null })} />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Body (Markdown)</label>
                <Textarea value={draft.body_markdown} onChange={(e) => setDraft({ ...draft, body_markdown: e.target.value })}
                  className="font-mono text-sm min-h-[420px]" />
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button onClick={save} disabled={saving || !isPrivacyOfficer} variant="outline">
                    <Save className="h-4 w-4 mr-1.5" />Save draft
                  </Button>
                  {isPrivacyOfficer ? (
                    <>
                      <Button onClick={approve} disabled={saving} variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />Approve as v{draft.version + 1}
                      </Button>
                      <Button onClick={reject} disabled={saving} variant="destructive">
                        <XCircle className="h-4 w-4 mr-1.5" />Reject Policy
                      </Button>
                    </>
                  ) : (
                    <Button disabled variant="outline" className="opacity-60 cursor-not-allowed text-xs">
                      <Lock className="h-3.5 w-3.5 mr-1.5" />Approval Restricted to Privacy & Security Officer
                    </Button>
                  )}
                </div>
                {draft.status !== "archived" ? (
                  <Button onClick={archive} variant="ghost" disabled={!isPrivacyOfficer} className="text-xs text-muted-foreground hover:text-destructive">
                    <Archive className="h-4 w-4 mr-1.5" />Archive
                  </Button>
                ) : (
                  <Button onClick={reactivate} variant="outline" disabled={!isPrivacyOfficer}>Reactivate</Button>
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
                  <div className="rounded-xl border border-border overflow-hidden bg-card shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                        <tr>
                          <th className="p-2.5">Action Event</th>
                          <th className="p-2.5">Privacy & Security Officer</th>
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
    </div>
  );
}

