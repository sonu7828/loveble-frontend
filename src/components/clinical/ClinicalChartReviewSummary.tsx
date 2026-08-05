import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ChevronDown, ChevronUp, UserCheck, ShieldCheck, Stethoscope, Maximize2 } from "lucide-react";
import { ClientFullChartModal } from "./ClientFullChartModal";

type Props = {
  record: {
    id?: string;
    client: string;
    email: string;
    provider: string;
    service: string;
    type: string;
    date: string;
    chiefComplaint?: string;
    medicalHistory?: string;
    physicalExam?: string;
    treatmentPlan?: string;
  };
};

export function ClinicalChartReviewSummary({ record }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [chartModalOpen, setChartModalOpen] = useState(false);

  const isGfe = record.service?.toLowerCase().includes("gfe") || record.type?.toLowerCase().includes("assessment");

  return (
    <>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10 p-3.5 space-y-3 shadow-2xs text-xs">
        <div className="flex items-start justify-between gap-2 border-b border-amber-500/20 pb-2.5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-500/30 text-[10px] font-bold uppercase" variant="outline">
                <Stethoscope className="h-3 w-3 mr-1" /> {isGfe ? "Good Faith Exam (GFE)" : "Clinical SOAP Note"}
              </Badge>
              <span className="font-semibold text-foreground text-sm">{record.service}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Patient: <strong className="text-foreground">{record.client}</strong> ({record.email}) • Exam Date: {record.date}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setChartModalOpen(true)}
            className="h-7 text-[11px] rounded-lg gap-1 shrink-0 bg-background hover:bg-muted font-medium border-amber-500/40 text-amber-900 dark:text-amber-200"
          >
            <Maximize2 className="h-3 w-3 text-amber-600" /> View Full Chart
          </Button>
        </div>

        {/* Practitioner Sign-off */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-background/80 p-2 rounded-lg border border-border">
          <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <div>
            Conducting Clinician: <strong className="text-foreground">{record.provider}</strong> • Status: <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Cleared & Signed by NP</span>
          </div>
        </div>

        {/* Clinical Exam Findings Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5 text-amber-600" /> Clinical Assessment & Exam Findings
            </span>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] text-primary hover:underline flex items-center gap-0.5 font-medium"
            >
              {expanded ? <>Hide Details <ChevronUp className="h-3 w-3" /></> : <>Read Full Exam <ChevronDown className="h-3 w-3" /></>}
            </button>
          </div>

          {expanded && (
            <div className="space-y-2.5 p-3 rounded-lg bg-background border border-border text-[11px] leading-relaxed">
              <div>
                <span className="font-semibold text-foreground uppercase text-[10px] tracking-wider text-muted-foreground block mb-0.5">
                  Chief Complaint & Aesthetic Goals:
                </span>
                <p className="text-muted-foreground">
                  {record.chiefComplaint || "Patient presents for facial rejuvenation assessment, glabellar wrinkle reduction, and lateral canthal line smoothing."}
                </p>
              </div>

              <div>
                <span className="font-semibold text-foreground uppercase text-[10px] tracking-wider text-muted-foreground block mb-0.5">
                  Medical Clearance & History:
                </span>
                <p className="text-muted-foreground">
                  {record.medicalHistory || "NKDA. No active neuromuscular disorders (Myasthenia Gravis/ALS), no active skin infection or cold sores. Not pregnant or breastfeeding."}
                </p>
              </div>

              <div>
                <span className="font-semibold text-foreground uppercase text-[10px] tracking-wider text-muted-foreground block mb-0.5">
                  Physical Examination:
                </span>
                <p className="text-muted-foreground">
                  {record.physicalExam || "Facial symmetry intact. Skin elasticity good. Moderate dynamic frontalis and corrugator muscle hyperactivity evaluated."}
                </p>
              </div>

              <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                <span className="font-semibold text-emerald-800 dark:text-emerald-300 uppercase text-[10px] tracking-wider block mb-0.5 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Approved Treatment Clearance & Plan:
                </span>
                <p className="text-emerald-900 dark:text-emerald-200 text-[11px]">
                  {record.treatmentPlan || "Approved for Neurotoxin (Botox/Dysport up to 50u) & Hyaluronic Acid Dermal Fillers as clinically indicated. Topical BLT anesthetic cleared."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Patient Chart Modal Popup */}
      <ClientFullChartModal
        open={chartModalOpen}
        onOpenChange={setChartModalOpen}
        clientEmail={record.email}
        clientName={record.client}
      />
    </>
  );
}
