import { useState } from "react";
import { apiQuery } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { generateMedicalRecordPDF } from "@/lib/pdfMedicalRecordGenerator";

export function DownloadRecordsCard({ userEmail, profile }: { userEmail: string; profile?: any }) {
  const [downloading, setDownloading] = useState(false);
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
            const { data } = await apiQuery
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
            const { data } = await apiQuery
              .from("consent_signatures")
              .select("id, signed_at, signed_full_name, decision, signing_mode, form_version")
              .ilike("client_email", email)
              .order("signed_at", { ascending: false });

            let consentsList = data || [];
            if (consentsList.length === 0) {
              // Fallback to local stored demo appointments with consents
              try {
                const localAppts: any[] = JSON.parse(localStorage.getItem("rka_demo_appointments") || "[]");
                consentsList = localAppts
                  .filter((a) => a.client_email?.toLowerCase() === email && (a.signed_name || a.consents_signed))
                  .map((a) => ({
                    id: a.id,
                    signed_at: a.created_at || new Date().toISOString(),
                    signed_full_name: a.signed_name || `${a.client_first_name || ""} ${a.client_last_name || ""}`.trim() || "Patient",
                    decision: "agreed",
                    form_version: 1,
                  }));
              } catch {}
            }
            exportData.consentSignatures = consentsList;
          })()
        );
      }

      if (includeAppts) {
        promises.push(
          (async () => {
            const { data } = await apiQuery
              .from("appointments")
              .select("id, start_at, end_at, status, created_at")
              .ilike("client_email", email)
              .order("start_at", { ascending: false });

            let apptList = data || [];
            if (apptList.length === 0) {
              try {
                const localAppts: any[] = JSON.parse(localStorage.getItem("rka_demo_appointments") || "[]");
                apptList = localAppts.filter((a) => a.client_email?.toLowerCase() === email);
              } catch {}
            }
            exportData.appointments = apptList;
          })()
        );
      }

      if (includeReceipts) {
        promises.push(
          (async () => {
            const { data } = await apiQuery
              .from("sales")
              .select("id, paid_at, total_cents, receipt_url, status")
              .ilike("client_email", email);
            exportData.billingReceipts = data || [];
          })()
        );
      }

      await Promise.all(promises);
      const dateStr = format(new Date(), "yyyy-MM-dd");

      const doc = generateMedicalRecordPDF(exportData as any);
      doc.save(`medical_records_${email.replace(/[^a-z0-9]/g, "_")}_${dateStr}.pdf`);
      toast.success("Official Medical Record PDF downloaded successfully!");
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
            You have the right to inspect and download an electronic PDF copy of your complete health record.
          </p>
        </div>
        <FileText className="h-8 w-8 text-primary/40 shrink-0" />
      </div>

      {/* Item Checklist */}
      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-xs">
        <div className="font-medium text-foreground mb-2">Select items to include in your PDF export:</div>
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
          🔒 Official PDF is generated directly in your browser.
        </div>
        <Button
          onClick={handleExport}
          disabled={downloading || (!includeNotes && !includeConsents && !includeAppts && !includeReceipts)}
          className="w-full sm:w-auto rounded-full gap-2"
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generating PDF...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" /> Download Medical Record (.pdf)
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
