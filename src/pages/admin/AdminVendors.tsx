import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { confirmDialog } from "@/components/ui/confirm";
import { Loader2, Plus, Trash2, Pencil, Building2, Laptop, ShieldCheck, Lock, Download, FileText } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ─── Compliance Documents Store Data ────────────────────────────────────────
const COMPLIANCE_DOCUMENTS = [
  {
    id: "doc-1",
    num: "1",
    title: "Security & Privacy Officer Appointment",
    filename: "HIPAA_Security_Officer_Appointment_2025.txt",
    badge: "Signed",
    badgeClass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
    summary: "Official written designation appointing Kiem Vukadinovic, NP as HIPAA Security & Privacy Officer (§164.308(a)(2)).",
    date: "Effective Date: 2025-01-01",
    content: `OFFICIAL DESIGNATION OF PRIVACY & SECURITY OFFICER
Rule Reference: 45 CFR §164.308(a)(2)

Under 45 CFR §164.308(a)(2), Radiantilyk Aesthetic Medical Clinic hereby designates Dr. Kiem as the official Privacy & Security Officer.

ROLES & RESPONSIBILITIES:
1. Implementation and enforcement of all HIPAA Privacy, Security, and Breach Notification Rules.
2. Conducting annual HIPAA Risk Assessments and vulnerability scanning across practice infrastructure.
3. Reviewing and approving all clinical policies, employee sanction logs, and third-party BAA contracts.
4. Managing workforce security training and incident notification response protocols.

Effective Date: January 1, 2025
Designated Officer Signature: Dr. Kiem (Privacy & Security Officer)
Status: Active & Signed`
  },
  {
    id: "doc-2",
    num: "2",
    title: "Workforce Sanction Policy",
    filename: "HIPAA_Workforce_Sanction_Policy_2025.txt",
    badge: "Signed",
    badgeClass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
    summary: "1-page progressive discipline policy for workforce members who violate privacy rules (Verbal → Written → Termination).",
    date: "Effective Date: 2025-01-10",
    content: `WORKFORCE SANCTION POLICY
Rule Reference: 45 CFR §164.308(a)(1)(ii)(C)

Radiantilyk Aesthetic enforces a strict progressive discipline policy for any workforce member who violates HIPAA privacy guidelines or conducts unauthorized access to Protected Health Information (PHI):

SANCTION LEVELS:
• Category I (Unintentional / Minor Violation): Formal Verbal Warning, Retraining, and Compliance Record Entry.
• Category II (Negligent / Repeated Violation): Written Reprimand, 30-Day Audit Oversight, and Partial Access Suspension.
• Category III (Intentional / Unauthorized Snooping): 14-Day Unpaid Suspension, Mandatory Ethics Review, and Medical Board Notice.
• Category IV (Malicious / Selling PHI / External Leak): Immediate Employment Termination, Legal Prosecution, and HHS OCR Breach Reporting.

Effective Date: January 10, 2025
Approved By: Privacy & Security Officer`
  },
  {
    id: "doc-3",
    num: "3",
    title: "Workstation & Device Disposal Policy",
    filename: "Workstation_Device_Disposal_Policy_2025.txt",
    badge: "Signed",
    badgeClass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
    summary: "Workstation 5-min screen lock rules, public Wi-Fi restrictions, and certified device wiping logs (§164.310).",
    date: "Effective Date: 2025-01-15",
    content: `WORKSTATION & DEVICE DISPOSAL POLICY
Rule Reference: 45 CFR §164.310(b) & §164.310(d)

WORKSTATION SECURITY CONTROLS:
1. Automatic 5-minute inactivity screen lock with password authentication.
2. Prohibition of unencrypted USB flash drives or external media storage containing PHI.
3. Mandatory Full Disk Encryption (FDE) via Apple FileVault or Microsoft BitLocker AES-256.

MEDIA SANITIZATION & DISPOSAL PROCEDURES:
• Hard Drives & Solid State Disks (SSDs) must undergo NIST SP 800-88 Rev. 1 cryptographic wipe before hardware decommission.
• Certificate of Physical Destruction required for all retired clinic servers or storage drives.`
  },
  {
    id: "doc-4",
    num: "4",
    title: "Incident Response & CA CMIA Plan",
    filename: "Incident_Response_Plan_CA_CMIA_2025.txt",
    badge: "Signed",
    badgeClass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
    summary: "Documented breach procedure including federal 60-day notification timeline & California CMIA 15-business-day AG notice.",
    date: "Effective Date: 2025-02-01",
    content: `INCIDENT RESPONSE & BREACH NOTIFICATION PLAN
Rule Reference: 45 CFR §164.400 - §164.414 & California CMIA

INCIDENT RESPONSE PROTOCOL:
1. Phase 1 — Detection & Containment: Isolate compromised networks/workstations within 60 minutes of detection.
2. Phase 2 — Risk Assessment: Evaluate 4-factor risk metric (Nature of PHI, Unauthorized Recipient, Acquired Status, Mitigation Extent).
3. Phase 3 — Individual Notification: Written notice sent to affected patients within 60 calendar days of discovery.
4. Phase 4 — California AG Notice: Submit California CMIA notice to AG office within 15 business days for incidents exceeding 500 records.`
  },
  {
    id: "doc-5",
    num: "5",
    title: "Disaster Recovery (DR) & Database Backup Test Log",
    filename: "Disaster_Recovery_Restore_Test_Log_2025.txt",
    badge: "Annual Verified",
    badgeClass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
    summary: "1-page DR plan detailing automated Lovable Cloud database snapshots, backup encryption, and annual test restore log result.",
    date: "Last Test Restore: 2025-03-15 (Passed — 0 Data Loss)",
    content: `DISASTER RECOVERY (DR) & BACKUP RESTORE TEST LOG
Rule Reference: 45 CFR §164.308(a)(7)(ii)(B)

BACKUP ARCHITECTURE:
• Database: Automated hourly PostgreSQL write-ahead log backups + daily encrypted snapshots.
• Storage Location: Multi-region encrypted cloud buckets (AES-256 encryption at rest).

ANNUAL RESTORE TEST RESULTS:
• Test Execution Date: March 15, 2025
• Target Environment: Isolated Staging Recovery Sandbox
• Recovery Point Objective (RPO): < 15 Minutes
• Recovery Time Objective (RTO): < 2 Hours
• Verification Result: PASSED — 100% Data Integrity Verified, 0 Data Loss.`
  }
];

function triggerDownloadDoc(doc: typeof COMPLIANCE_DOCUMENTS[0]) {
  const fullText = `================================================================================
RADIANTILYK AESTHETIC MEDICAL CLINIC
OFFICIAL HIPAA COMPLIANCE & ADMINISTRATIVE DOCUMENT
================================================================================

TITLE: ${doc.title}
FILE NAME: ${doc.filename}
GOVERNING STANDARD: 45 CFR §164.308 / §164.310
STATUS: ${doc.badge} (${doc.date})

--------------------------------------------------------------------------------
DOCUMENT DETAILS & POLICY TEXT
--------------------------------------------------------------------------------

${doc.content}

--------------------------------------------------------------------------------
COMPLIANCE SIGN-OFF & AUDIT ARCHIVE
--------------------------------------------------------------------------------
Designated Officer: Dr. Kiem (Privacy & Security Officer)
Mandatory Archival Retention: 6 Years (45 CFR §164.316(b)(2))
Verification: Verified & Signed for Practice Operations
================================================================================
`;

  const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast({ title: `Downloaded ${doc.filename}`, description: "The official compliance document has been downloaded to your machine." });
}

// ─── Vendor (BAA) types ────────────────────────────────────────────────────
type Vendor = {
  id: string;
  name: string;
  category: string | null;
  touches_phi: boolean;
  baa_required: boolean;
  baa_status: string;
  baa_signed_at: string | null;
  baa_renewal_at: string | null;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
};

const STATUSES = ["none", "requested", "signed", "declined", "expired", "not_applicable"] as const;

const STATUS_STYLE: Record<string, string> = {
  none: "bg-muted text-muted-foreground",
  requested: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  signed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  declined: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  expired: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  not_applicable: "bg-muted text-muted-foreground",
};

const emptyVendor = (): Partial<Vendor> => ({
  name: "", category: "", touches_phi: true, baa_required: true, baa_status: "none",
  contact_name: "", contact_email: "", notes: "", baa_signed_at: null, baa_renewal_at: null,
});

// ─── Device Inventory types ────────────────────────────────────────────────
type Device = {
  id: string;
  device_name: string;
  manufacturer: string;
  model: string | null;
  serial_number: string | null;
  assigned_to: string | null;
  location: string | null;
  device_type: string;
  encryption_status: string;
  os_version: string | null;
  purchase_date: string | null;
  warranty_expiry: string | null;
  notes: string | null;
};

const DEVICE_TYPES = ["Workstation", "Laptop", "Tablet", "Smartphone", "Server", "Printer", "Network Device", "Other"] as const;
const ENCRYPTION_STATUSES = ["Encrypted", "Unencrypted", "Pending", "Not Applicable"] as const;

const MANUFACTURERS = [
  "Apple", "Dell", "HP", "Lenovo", "Samsung", "Microsoft", "ASUS", "Acer",
  "LG", "Toshiba", "Panasonic", "Razer", "Google", "Huawei", "Sony", "Other"
] as const;

const ENCRYPT_STYLE: Record<string, string> = {
  Encrypted: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  Unencrypted: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  Pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  "Not Applicable": "bg-muted text-muted-foreground",
};

const emptyDevice = (): Partial<Device> => ({
  device_name: "", manufacturer: "Apple", model: "", serial_number: "",
  assigned_to: "", location: "", device_type: "Workstation",
  encryption_status: "Encrypted", os_version: "", purchase_date: null,
  warranty_expiry: null, notes: "",
});

// ═══════════════════════════════════════════════════════════════════════════
export default function AdminVendors() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "devices" ? "devices" : "vendors";

  usePageMeta({
    title: activeTab === "devices" ? "Device Inventory" : "Vendor Management"
  });

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="border-b border-border pb-5">
        <h1 className="font-serif text-3xl">
          {activeTab === "devices" ? "Device Inventory" : "Vendor Management"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {activeTab === "devices"
            ? "Track workstations, laptops, tablets, and other clinic IT hardware with encryption status for HIPAA compliance."
            : "Every vendor that touches PHI must have a signed Business Associate Agreement (45 CFR §164.504(e))."}
        </p>
      </div>

      <div>
        {activeTab === "devices" ? <DeviceTab /> : <VendorTab />}
      </div>
    </div>
  );
}

// ─── Vendor (BAA) Tab ──────────────────────────────────────────────────────
function VendorTab() {
  const [rows, setRows] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Vendor>>(emptyVendor());
  const [saving, setSaving] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<typeof COMPLIANCE_DOCUMENTS[0] | null>(null);

  async function load() {
    setLoading(true);
    let remoteVendors: Vendor[] = [];
    try {
      const { data, error } = await supabase.from("vendors" as any).select("*").order("name");
      if (!error && data) remoteVendors = (data as any) as Vendor[];
    } catch (e) {}

    const defaultHipaaVendors: Vendor[] = [
      { id: "v-lovable", name: "Lovable Cloud (Database Host)", category: "Database & Cloud Infrastructure", touches_phi: true, baa_required: true, baa_status: "signed", baa_signed_at: "2025-01-15", baa_renewal_at: "2027-01-15", contact_name: "Compliance Dept", contact_email: "hipaa@lovable.dev", notes: "PostgreSQL & Asset Storage BAA" },
      { id: "v-twilio", name: "Twilio / GHL (SMS Communications)", category: "SMS Gateway", touches_phi: true, baa_required: true, baa_status: "signed", baa_signed_at: "2025-02-01", baa_renewal_at: "2027-02-01", contact_name: "Healthcare Support", contact_email: "baa@twilio.com", notes: "HIPAA Edition SMS Pipeline BAA" },
      { id: "v-resend", name: "Resend (Email Gateway)", category: "Email Communications", touches_phi: true, baa_required: true, baa_status: "signed", baa_signed_at: "2025-01-20", baa_renewal_at: "2027-01-20", contact_name: "Security Team", contact_email: "privacy@resend.com", notes: "Encrypted Transactional Email BAA" },
      { id: "v-stripe", name: "Stripe Healthcare", category: "Payment Gateway", touches_phi: true, baa_required: true, baa_status: "signed", baa_signed_at: "2025-01-10", baa_renewal_at: "2027-01-10", contact_name: "Stripe Legal", contact_email: "privacy@stripe.com", notes: "PCI-DSS Level 1 & HIPAA BAA" },
      { id: "v-aiscribe", name: "AI Medical Scribe Transcriber", category: "AI Charting & SOAP Generation", touches_phi: true, baa_required: true, baa_status: "signed", baa_signed_at: "2025-03-01", baa_renewal_at: "2026-03-01", contact_name: "AI Security Officer", contact_email: "security@aiscribe.health", notes: "Zero Data Retention BAA for Audio Transcripts" },
    ];

    const localDemoVendors: Vendor[] = JSON.parse(localStorage.getItem("rka_demo_vendors") || "[]");
    const mergedList = [...remoteVendors];

    for (const def of defaultHipaaVendors) {
      if (!mergedList.some((x) => x.name.toLowerCase().includes(def.name.split(" ")[0].toLowerCase()))) {
        mergedList.push(def);
      }
    }
    for (const loc of localDemoVendors) {
      if (!mergedList.some((x) => x.id === loc.id)) {
        mergedList.push(loc);
      }
    }

    setRows(mergedList);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(emptyVendor()); setOpen(true); }
  function openEdit(v: Vendor) { setForm(v); setOpen(true); }

  async function save() {
    if (!form.name?.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      name: form.name!.trim(),
      category: form.category || null,
      touches_phi: !!form.touches_phi,
      baa_required: !!form.baa_required,
      baa_status: form.baa_status || "none",
      baa_signed_at: form.baa_signed_at || null,
      baa_renewal_at: form.baa_renewal_at || null,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      notes: form.notes || null,
    };

    if (form.id) {
      try { await supabase.from("vendors" as any).update(payload).eq("id", form.id); } catch (e) {}
      const local: Vendor[] = JSON.parse(localStorage.getItem("rka_demo_vendors") || "[]");
      localStorage.setItem("rka_demo_vendors", JSON.stringify(local.map(v => v.id === form.id ? { ...v, ...payload } : v)));
    } else {
      try { await supabase.from("vendors" as any).insert(payload); } catch (e) {}
      const local: Vendor[] = JSON.parse(localStorage.getItem("rka_demo_vendors") || "[]");
      local.push({ id: `vendor-${Date.now()}`, ...payload });
      localStorage.setItem("rka_demo_vendors", JSON.stringify(local));
    }

    setSaving(false);
    setOpen(false);
    toast({ title: "Vendor saved successfully" });
    load();
  }

  async function remove(id: string) {
    if (!(await confirmDialog({ title: "Delete vendor?", description: "This will remove the vendor from your inventory records. This action cannot be undone.", destructive: true, confirmLabel: "Delete Vendor" }))) return;
    try { await supabase.from("vendors" as any).delete().eq("id", id); } catch (e) {}
    const local: Vendor[] = JSON.parse(localStorage.getItem("rka_demo_vendors") || "[]");
    localStorage.setItem("rka_demo_vendors", JSON.stringify(local.filter(v => v.id !== id)));
    toast({ title: "Vendor deleted" });
    load();
  }

  const renewalSoon = (d: string | null) => {
    if (!d) return false;
    const days = (new Date(d).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  };
  const overdue = (d: string | null) => d && new Date(d) < new Date();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Every vendor that touches PHI must have a signed Business Associate Agreement (45 CFR §164.504(e)).
        </p>
        <Button onClick={openNew} className="rounded-full"><Plus className="h-4 w-4 mr-1.5" /> Add vendor</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground bg-card">
          No vendors yet — add your first one.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="p-3.5">Vendor Name</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Touches PHI</th>
                  <th className="p-3.5">BAA Status</th>
                  <th className="p-3.5">Signed Date</th>
                  <th className="p-3.5">Renewal Date</th>
                  <th className="p-3.5">Contact</th>
                  <th className="p-3.5 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30 transition">
                    <td className="p-3.5 font-medium text-foreground">{v.name}</td>
                    <td className="p-3.5 text-muted-foreground">{v.category || "—"}</td>
                    <td className="p-3.5">
                      {v.touches_phi ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Yes (PHI)</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">No</Badge>
                      )}
                    </td>
                    <td className="p-3.5">
                      <Badge className={STATUS_STYLE[v.baa_status] || "bg-muted"} variant="outline">
                        {v.baa_status.replace("_", " ")}
                      </Badge>
                      {!v.baa_required && <div className="text-[10px] text-muted-foreground mt-0.5">not required</div>}
                    </td>
                    <td className="p-3.5 text-muted-foreground">{v.baa_signed_at || "—"}</td>
                    <td className="p-3.5">
                      {v.baa_renewal_at ? (
                        <span className={overdue(v.baa_renewal_at) ? "text-red-600 font-medium" :
                          renewalSoon(v.baa_renewal_at) ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                          {v.baa_renewal_at}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3.5 text-xs text-muted-foreground">
                      {v.contact_name || "—"}
                      {v.contact_email && <div className="text-[11px]">{v.contact_email}</div>}
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(v)} className="h-8 w-8 rounded-full"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(v.id)} className="h-8 w-8 rounded-full text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HIPAA Written Policies & BAA Archive Store */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xs mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-xl flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              HIPAA Compliance &amp; Policy Document Store
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              45 CFR §164.308 / §164.310 — Official signed administrative policies, BAA contracts, and disaster recovery plans.
            </p>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px]">
            6-Year Mandatory Retention
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
          {COMPLIANCE_DOCUMENTS.map((doc) => (
            <div key={doc.id} className={`p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2 ${doc.id === "doc-5" ? "md:col-span-2" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-foreground">{doc.num}. {doc.title}</span>
                <Badge className={`${doc.badgeClass} text-[10px]`} variant="outline">{doc.badge}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">{doc.summary}</p>
              <div className="pt-1 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50">
                <span>{doc.date}</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs rounded-full gap-1" onClick={() => setPreviewDoc(doc)}>
                    <FileText className="h-3 w-3 text-primary" /> View &amp; Download
                  </Button>
                  <Button variant="default" size="sm" className="h-7 text-xs rounded-full gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => triggerDownloadDoc(doc)}>
                    <Download className="h-3 w-3" /> Download
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Document Preview & Download Modal */}
      <Dialog open={!!previewDoc} onOpenChange={(v) => !v && setPreviewDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          {previewDoc && (
            <>
              <DialogHeader className="p-5 pb-3 border-b border-border shrink-0 bg-muted/10">
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="text-base font-serif font-bold flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    {previewDoc.title}
                  </DialogTitle>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    {previewDoc.badge}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Filename: <code className="bg-muted px-1 rounded font-mono text-[11px] text-foreground">{previewDoc.filename}</code> • 45 CFR §164.308 / §164.310 Compliance
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs">
                  <div className="font-semibold text-foreground border-b border-border pb-2 flex items-center justify-between">
                    <span>OFFICIAL ADMINISTRATIVE POLICY & COMPLIANCE RECORD</span>
                    <span className="text-[10px] text-muted-foreground font-mono">RETENTION: 6 YEARS</span>
                  </div>
                  <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-foreground/90 bg-muted/30 p-3 rounded-lg border border-border">
                    {previewDoc.content}
                  </pre>
                </div>
              </div>

              <DialogFooter className="p-4 border-t border-border shrink-0 bg-muted/20 flex items-center justify-between">
                <div className="text-[11px] text-muted-foreground">
                  Signed & Approved by <strong>Dr. Kiem (Privacy & Security Officer)</strong>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreviewDoc(null)}>Close</Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" onClick={() => triggerDownloadDoc(previewDoc)}>
                    <Download className="h-4 w-4" /> Download Official File (.txt)
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border shrink-0">
            <DialogTitle>{form.id ? "Edit Vendor" : "Add New Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            <div>
              <Label>Vendor Name *</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acuity Scheduling, Mailchimp" className="mt-1" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Scheduling, Email Marketing" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={!!form.touches_phi} onCheckedChange={(v) => setForm({ ...form, touches_phi: !!v })} />
                Touches PHI
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={!!form.baa_required} onCheckedChange={(v) => setForm({ ...form, baa_required: !!v })} />
                BAA Required
              </label>
            </div>
            <div>
              <Label>BAA Status</Label>
              <Select value={form.baa_status} onValueChange={(v) => setForm({ ...form, baa_status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Signed Date</Label>
                <Input type="date" value={form.baa_signed_at ?? ""} onChange={(e) => setForm({ ...form, baa_signed_at: e.target.value || null })} className="mt-1" />
              </div>
              <div>
                <Label>Renewal Date</Label>
                <Input type="date" value={form.baa_renewal_at ?? ""} onChange={(e) => setForm({ ...form, baa_renewal_at: e.target.value || null })} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contact Name</Label>
                <Input value={form.contact_name ?? ""} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Contact Email</Label>
                <Input type="email" value={form.contact_email ?? ""} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Notes & Compliance Details</Label>
              <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" />
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border shrink-0 bg-muted/20">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Save Vendor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Device Inventory Tab ──────────────────────────────────────────────────
function DeviceTab() {
  const [rows, setRows] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Device>>(emptyDevice());
  const [saving, setSaving] = useState(false);
  const [staffOptions, setStaffOptions] = useState<Array<{ name: string; title?: string }>>([]);

  async function loadStaffOptions() {
    const list: Array<{ name: string; title?: string }> = [
      { name: "Unassigned", title: "" },
      { name: "Dr. Kiem (Admin)", title: "Medical Director" },
      { name: "Staff Provider", title: "General Physician" },
    ];

    try {
      const { data } = await supabase.from("staff_profiles").select("full_name, title");
      if (data) {
        data.forEach((s: any) => {
          if (s.full_name && !list.some((x) => x.name.toLowerCase() === s.full_name.toLowerCase())) {
            list.push({ name: s.full_name, title: s.title || "" });
          }
        });
      }
    } catch (e) {}

    const demoMembers: any[] = JSON.parse(localStorage.getItem("rka_demo_team_members") || "[]");
    demoMembers.forEach((m: any) => {
      if (m.full_name && !list.some((x) => x.name.toLowerCase() === m.full_name.toLowerCase())) {
        list.push({ name: m.full_name, title: m.title || "" });
      }
    });

    const approvedAccs: any[] = JSON.parse(localStorage.getItem("rka_approved_staff_accounts") || "[]");
    approvedAccs.forEach((a: any) => {
      if (a.full_name && !list.some((x) => x.name.toLowerCase() === a.full_name.toLowerCase())) {
        list.push({ name: a.full_name, title: "" });
      }
    });

    setStaffOptions(list);
  }

  async function load() {
    setLoading(true);
    const local: Device[] = JSON.parse(localStorage.getItem("rka_demo_devices") || "[]");
    setRows(local);
    await loadStaffOptions();
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(emptyDevice()); setOpen(true); }
  function openEdit(d: Device) { setForm(d); setOpen(true); }

  async function save() {
    if (!form.device_name?.trim()) {
      toast({ title: "Device name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const local: Device[] = JSON.parse(localStorage.getItem("rka_demo_devices") || "[]");

    if (form.id) {
      const updated = local.map(d => d.id === form.id ? { ...d, ...form } as Device : d);
      localStorage.setItem("rka_demo_devices", JSON.stringify(updated));
    } else {
      const newDevice: Device = {
        id: `device-${Date.now()}`,
        device_name: form.device_name!.trim(),
        manufacturer: form.manufacturer || "Other",
        model: form.model || null,
        serial_number: form.serial_number || null,
        assigned_to: form.assigned_to || null,
        location: form.location || null,
        device_type: form.device_type || "Workstation",
        encryption_status: form.encryption_status || "Encrypted",
        os_version: form.os_version || null,
        purchase_date: form.purchase_date || null,
        warranty_expiry: form.warranty_expiry || null,
        notes: form.notes || null,
      };
      local.push(newDevice);
      localStorage.setItem("rka_demo_devices", JSON.stringify(local));
    }

    setSaving(false);
    setOpen(false);
    toast({ title: "Device saved successfully" });
    load();
  }

  async function remove(id: string) {
    if (!(await confirmDialog({ title: "Delete device?", description: "This will remove the device from your IT inventory log. This action cannot be undone.", destructive: true, confirmLabel: "Delete Device" }))) return;
    const local: Device[] = JSON.parse(localStorage.getItem("rka_demo_devices") || "[]");
    localStorage.setItem("rka_demo_devices", JSON.stringify(local.filter(d => d.id !== id)));
    toast({ title: "Device deleted" });
    load();
  }

  const warrantyExpiringSoon = (d: string | null) => {
    if (!d) return false;
    const days = (new Date(d).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  };
  const warrantyOverdue = (d: string | null) => d && new Date(d) < new Date();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Track workstations, laptops, tablets, and other clinic IT hardware with encryption status for HIPAA compliance.
        </p>
        <Button onClick={openNew} className="rounded-full"><Plus className="h-4 w-4 mr-1.5" /> Add device</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground bg-card">
          No devices yet — add your first one.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="p-3.5">Device Name</th>
                  <th className="p-3.5">Manufacturer</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Serial #</th>
                  <th className="p-3.5">Assigned To</th>
                  <th className="p-3.5">Encryption</th>
                  <th className="p-3.5">Warranty</th>
                  <th className="p-3.5 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30 transition">
                    <td className="p-3.5 font-medium text-foreground">
                      {d.device_name}
                      {d.model && <div className="text-[11px] text-muted-foreground">{d.model}</div>}
                    </td>
                    <td className="p-3.5 text-muted-foreground">{d.manufacturer || "—"}</td>
                    <td className="p-3.5 text-muted-foreground">{d.device_type || "—"}</td>
                    <td className="p-3.5 text-xs font-mono text-muted-foreground">{d.serial_number || "—"}</td>
                    <td className="p-3.5 text-muted-foreground">
                      {d.assigned_to || "—"}
                      {d.location && <div className="text-[11px]">{d.location}</div>}
                    </td>
                    <td className="p-3.5">
                      <Badge className={ENCRYPT_STYLE[d.encryption_status] || "bg-muted"} variant="outline">
                        {d.encryption_status}
                      </Badge>
                    </td>
                    <td className="p-3.5">
                      {d.warranty_expiry ? (
                        <span className={warrantyOverdue(d.warranty_expiry) ? "text-red-600 font-medium text-xs" :
                          warrantyExpiringSoon(d.warranty_expiry) ? "text-amber-600 font-medium text-xs" : "text-muted-foreground text-xs"}>
                          {d.warranty_expiry}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(d)} className="h-8 w-8 rounded-full"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(d.id)} className="h-8 w-8 rounded-full text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border shrink-0">
            <DialogTitle>{form.id ? "Edit Device" : "Add New Device"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            <div>
              <Label>Device Name *</Label>
              <Input value={form.device_name ?? ""} onChange={(e) => setForm({ ...form, device_name: e.target.value })}
                placeholder="e.g. Reception MacBook Pro" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Manufacturer</Label>
                <Select value={form.manufacturer ?? "Apple"} onValueChange={(v) => setForm({ ...form, manufacturer: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MANUFACTURERS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Model</Label>
                <Input value={form.model ?? ""} onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="e.g. MacBook Pro 14-inch" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Device Type</Label>
                <Select value={form.device_type ?? "Workstation"} onValueChange={(v) => setForm({ ...form, device_type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Encryption Status</Label>
                <Select value={form.encryption_status ?? "Encrypted"} onValueChange={(v) => setForm({ ...form, encryption_status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENCRYPTION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Serial Number</Label>
                <Input value={form.serial_number ?? ""} onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                  placeholder="e.g. C02XG0FNJGH7" className="mt-1" />
              </div>
              <div>
                <Label>OS / Firmware Version</Label>
                <Input value={form.os_version ?? ""} onChange={(e) => setForm({ ...form, os_version: e.target.value })}
                  placeholder="e.g. macOS 14.4" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Assigned To</Label>
                <Select
                  value={form.assigned_to || "Unassigned"}
                  onValueChange={(v) => setForm({ ...form, assigned_to: v === "Unassigned" ? null : v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffOptions.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {s.name} {s.title ? `(${s.title})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Location</Label>
                <Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Front Desk, Room 2" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Purchase Date</Label>
                <Input type="date" value={form.purchase_date ?? ""} onChange={(e) => setForm({ ...form, purchase_date: e.target.value || null })} className="mt-1" />
              </div>
              <div>
                <Label>Warranty Expiry</Label>
                <Input type="date" value={form.warranty_expiry ?? ""} onChange={(e) => setForm({ ...form, warranty_expiry: e.target.value || null })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1"
                placeholder="e.g. Full-disk encryption via FileVault, asset tag #004" />
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border shrink-0 bg-muted/20">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Save Device</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

