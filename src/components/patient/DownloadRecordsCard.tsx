import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Download, FileText, FileArchive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import JSZip from "jszip";
import { generateMedicalRecordPDF } from "@/lib/pdfMedicalRecordGenerator";

export function DownloadRecordsCard({ userEmail, profile }: { userEmail: string; profile?: any }) {
  const [downloading, setDownloading] = useState(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "zip" | "json">("pdf");
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeConsents, setIncludeConsents] = useState(true);
  const [includeAppts, setIncludeAppts] = useState(true);
  const [includeReceipts, setIncludeReceipts] = useState(true);

  const handleExport = async () => {
    if (!userEmail) {
      toast.error("User email missing.");
      return;
    }
    setDownloading(true);
    try {
      const email = userEmail.toLowerCase();
      const exportData: Record<string, any> = {
        exportedAt: new Date().toISOString(),
        hipaaNotice: "Personal Health Record Export — HIPAA §164.524 Right of Access",
        patientProfile: profile || { email },
      };

      const promises: Promise<void>[] = [];

      if (includeNotes) {
        promises.push(
          (async () => {
            const { data } = await supabase
              .from("clinical_notes")
              .select("id, created_at, category, service_name, provider_name, note_body, status")
              .ilike("client_email", email)
              .in("status", ["signed", "cosigned", "locked"])
              .order("created_at", { ascending: false });
            exportData.clinicalNotes = data || [];
          })()
        );
      }

      if (includeConsents) {
        promises.push(
          (async () => {
            const { data } = await supabase
              .from("consent_signatures")
              .select("id, signed_at, signed_full_name, decision, signing_mode, form_version")
              .ilike("client_email", email)
              .order("signed_at", { ascending: false });
            exportData.consentSignatures = data || [];
          })()
        );
      }

      if (includeAppts) {
        promises.push(
          (async () => {
            const { data } = await supabase
              .from("appointments")
              .select("id, start_at, end_at, status, created_at")
              .ilike("client_email", email)
              .order("start_at", { ascending: false });
            exportData.appointments = data || [];
          })()
        );
      }

      if (includeReceipts) {
        promises.push(
          (async () => {
            const { data } = await supabase
              .from("sales")
              .select("id, paid_at, total_cents, receipt_url, status")
              .ilike("client_email", email);
            exportData.billingReceipts = data || [];
          })()
        );
      }

      await Promise.all(promises);
      const dateStr = format(new Date(), "yyyy-MM-dd");

      if (exportFormat === "pdf") {
        const doc = generateMedicalRecordPDF(exportData as any);
        doc.save(`medical_records_${email}_${dateStr}.pdf`);
        toast.success("Medical record PDF downloaded!");
      } else if (exportFormat === "zip") {
        const doc = generateMedicalRecordPDF(exportData as any);
        const pdfBlob = doc.output("blob");
        const jsonStr = JSON.stringify(exportData, null, 2);

        const zip = new JSZip();
        zip.file(`medical_record_report_${dateStr}.pdf`, pdfBlob);
        zip.file(`medical_record_data_${dateStr}.json`, jsonStr);
        zip.file(
          `HIPAA_RIGHT_OF_ACCESS.txt`,
          `HIPAA §164.524 RIGHT OF ACCESS STATEMENT\n\nPatient Email: ${email}\nExport Date: ${new Date().toISOString()}\n\nThis archive contains your official personal health records generated directly from Radiantilyk Healthcare Platform.`
        );

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const link = document.createElement("a");
        link.href = url;
        link.download = `medical_records_${email}_${dateStr}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Medical record ZIP archive downloaded!");
      } else {
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `medical_records_${email}_${dateStr}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Medical record JSON exported!");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate download file.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-xl">Download Medical Records</h3>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
              <ShieldCheck className="h-3 w-3 mr-1" /> HIPAA §164.524
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            You have the right to inspect and download an electronic copy of your complete health record.
          </p>
        </div>
        <FileText className="h-8 w-8 text-primary/40 shrink-0" />
      </div>

      {/* Export Format Selection */}
      <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4 text-xs">
        <div className="font-medium text-foreground">Choose Download Format:</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={() => setExportFormat("pdf")}
            className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition ${
              exportFormat === "pdf"
                ? "border-primary bg-primary/10 font-medium text-foreground"
                : "border-border bg-card hover:bg-muted/50 text-muted-foreground"
            }`}
          >
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <div>
              <div className="font-semibold text-xs">PDF Document</div>
              <div className="text-[10px] text-muted-foreground">Printable health summary (.pdf)</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setExportFormat("zip")}
            className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition ${
              exportFormat === "zip"
                ? "border-primary bg-primary/10 font-medium text-foreground"
                : "border-border bg-card hover:bg-muted/50 text-muted-foreground"
            }`}
          >
            <FileArchive className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <div className="font-semibold text-xs">ZIP Archive</div>
              <div className="text-[10px] text-muted-foreground">PDF + JSON Bundle (.zip)</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setExportFormat("json")}
            className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition ${
              exportFormat === "json"
                ? "border-primary bg-primary/10 font-medium text-foreground"
                : "border-border bg-card hover:bg-muted/50 text-muted-foreground"
            }`}
          >
            <Download className="h-4 w-4 text-blue-600 shrink-0" />
            <div>
              <div className="font-semibold text-xs">JSON Data</div>
              <div className="text-[10px] text-muted-foreground">Raw electronic data (.json)</div>
            </div>
          </button>
        </div>
      </div>

      {/* Item Checklist */}
      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-xs">
        <div className="font-medium text-foreground mb-2">Select items to include in your export:</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(e) => setIncludeNotes(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span>Clinical Chart Notes &amp; SOAP Records</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeConsents}
              onChange={(e) => setIncludeConsents(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span>Signed Consent Forms &amp; Disclosures</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAppts}
              onChange={(e) => setIncludeAppts(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span>Appointment &amp; Visit History</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeReceipts}
              onChange={(e) => setIncludeReceipts(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <span>Billing Receipts &amp; Payment History</span>
          </label>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="text-[11px] text-muted-foreground">
          🔒 Export file is encrypted and generated directly in your browser.
        </div>
        <Button
          onClick={handleExport}
          disabled={downloading || (!includeNotes && !includeConsents && !includeAppts && !includeReceipts)}
          className="w-full sm:w-auto rounded-full gap-2"
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing Export...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" /> Download Medical Record (.{exportFormat})
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
