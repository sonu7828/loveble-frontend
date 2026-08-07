import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { User, FileText, CheckCircle2, ShieldCheck, Stethoscope, Syringe, Calendar, Mail, Phone, Clock } from "lucide-react";
import { format } from "date-fns";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientEmail: string;
  clientName?: string;
};

export function ClientFullChartModal({ open, onOpenChange, clientEmail, clientName }: Props) {
  const [activeTab, setActiveTab] = useState("gfe");
  const displayName = clientName || clientEmail;

  // Load client's GFE and local notes if available
  const [gfeRecord, setGfeRecord] = useState<any>(null);
  const [chartNotes, setChartNotes] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    try {
      const queryStr = (clientEmail || clientName || "").toLowerCase().trim();
      const gfes: any[] = JSON.parse(localStorage.getItem("rka_demo_gfe_records") || "[]");
      const foundGfe = gfes.find((g) => {
        if (!queryStr) return false;
        const emailMatch = (g.client_email || "").toLowerCase().includes(queryStr);
        const nameMatch = (`${g.client_first_name || ""} ${g.client_last_name || ""}`).toLowerCase().includes(queryStr);
        return emailMatch || nameMatch;
      }) || (gfes.length > 0 ? gfes[0] : null);
      setGfeRecord(foundGfe);

      const notes: any[] = JSON.parse(localStorage.getItem("rka_demo_clinical_notes") || "[]");
      const clientNotes = notes.filter((n) => {
        if (!queryStr) return true;
        const emailMatch = (n.client_email || "").toLowerCase().includes(queryStr);
        const nameMatch = (`${n.client_first_name || ""} ${n.client_last_name || ""}`).toLowerCase().includes(queryStr);
        return emailMatch || nameMatch;
      });
      setChartNotes(clientNotes);
    } catch {}
  }, [open, clientEmail]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6 rounded-2xl shadow-xl">
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20 text-[10px] uppercase font-bold" variant="outline">
                  <User className="h-3 w-3 mr-1" /> Confidential Patient Medical Chart
                </Badge>
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px] font-bold" variant="outline">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> GFE Active & Cleared
                </Badge>
              </div>
              <DialogTitle className="font-serif text-xl sm:text-2xl font-semibold">{displayName}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap pt-0.5">
                <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-primary" /> {clientEmail}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-primary" /> (555) 234-5678</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-primary" /> DOB: 04/18/1991 (35y)</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4 pt-2">
          <TabsList className="grid grid-cols-3 w-full bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="gfe" className="text-xs font-semibold rounded-lg gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Good Faith Exam
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs font-semibold rounded-lg gap-1.5">
              <Syringe className="h-3.5 w-3.5 text-purple-600" /> Treatment History
            </TabsTrigger>
            <TabsTrigger value="medical" className="text-xs font-semibold rounded-lg gap-1.5">
              <FileText className="h-3.5 w-3.5 text-amber-600" /> Medical Clearance
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Good Faith Exam Details */}
          <TabsContent value="gfe" className="space-y-3 focus:outline-none">
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <div>
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-emerald-600" /> California Good Faith Exam (GFE) Record
                  </h4>
                  <p className="text-[11px] text-muted-foreground">Standardized Medical Assessment for Aesthetic Procedures</p>
                </div>
                <Badge className="bg-emerald-600 text-white border-0 text-[10px] uppercase font-bold">
                  Valid 1 Year
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="p-2.5 rounded-lg bg-background border border-border space-y-1">
                  <span className="font-bold text-muted-foreground uppercase text-[9px]">Examining Practitioner:</span>
                  <p className="font-medium text-foreground">{gfeRecord?.np_name || "Kiem Vukadinovic, NP (License #NP-94021)"}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border space-y-1">
                  <span className="font-bold text-muted-foreground uppercase text-[9px]">Exam Date & Expiration:</span>
                  <p className="font-medium text-foreground">Executed: 08/03/2026 • Expires: 08/03/2027 (363 days remaining)</p>
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-background border border-border text-[11px] leading-relaxed">
                <div>
                  <span className="font-bold text-foreground uppercase text-[9px] text-muted-foreground block">Evaluation Summary & Chief Complaint:</span>
                  <p className="text-muted-foreground">Client evaluated for upper facial dynamic rhytids, glabellar lines, and midface volume loss. Full facial symmetry and muscular tone assessed.</p>
                </div>

                <div>
                  <span className="font-bold text-foreground uppercase text-[9px] text-muted-foreground block">Medical Screening & Contraindications:</span>
                  <p className="text-muted-foreground">No history of neuromuscular disease (Myasthenia Gravis/ALS/Eaton-Lambert). No active skin infections, herpes simplex, or open lesions in treatment area. NKDA.</p>
                </div>

                <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 uppercase text-[9px] block">Authorized Treatments & Dosages:</span>
                  <ul className="list-disc list-inside text-emerald-900 dark:text-emerald-200 text-[11px] space-y-0.5 mt-1">
                    <li>Neurotoxin (Botox / Dysport / Xeomin) up to 50 Units per session</li>
                    <li>Hyaluronic Acid Dermal Fillers (Juvederm / Restylane) up to 2.0mL</li>
                    <li>Topical Prescription Compound Anesthetic (Lidocaine 23% / Tetracaine 7%)</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Treatment History */}
          <TabsContent value="history" className="space-y-3 focus:outline-none text-xs">
            <div className="space-y-2.5">
              <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                    <Syringe className="h-4 w-4 text-purple-600" /> Neurotoxin Treatment (Glabella & Forehead)
                  </span>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Aug 3, 2026</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Provider: nursepractitioner (NP) • Location: Main Clinic</p>
                <div className="p-2 rounded-lg bg-muted/40 text-[11px] space-y-1">
                  <div><strong>Injected:</strong> Botox 20 Units Glabella (Corrugators/Procerus) + 10 Units Frontalis</div>
                  <div><strong>Lot #:</strong> BTX-99482 • <strong>Exp:</strong> 12/2027</div>
                  <div><strong>Outcome:</strong> Immediate tolerance good. Post-care instructions delivered.</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-card space-y-2 opacity-80">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                    <Syringe className="h-4 w-4 text-purple-600" /> Lip Augmentation (Juvederm Ultra XC)
                  </span>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> May 12, 2026</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Provider: Kiem Vukadinovic, NP</p>
                <div className="p-2 rounded-lg bg-muted/40 text-[11px] space-y-1">
                  <div><strong>Injected:</strong> 1.0mL Juvederm Ultra XC to Vermilion Border & Body</div>
                  <div><strong>Lot #:</strong> JUV-88401 • <strong>Exp:</strong> 08/2027</div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Medical Clearance */}
          <TabsContent value="medical" className="space-y-3 focus:outline-none text-xs">
            <div className="p-4 rounded-xl border border-border bg-card space-y-3">
              <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-600" /> Intake & Medical Screening Questionnaire
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg border border-border bg-muted/20">Allergies: <strong>NKDA (No Known Drug Allergies)</strong></div>
                <div className="p-2 rounded-lg border border-border bg-muted/20">Active Medications: <strong>Multivitamins</strong></div>
                <div className="p-2 rounded-lg border border-border bg-muted/20">Neuromuscular Disease: <strong>Negative</strong></div>
                <div className="p-2 rounded-lg border border-border bg-muted/20">Pregnant / Nursing: <strong>No</strong></div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl px-5 font-semibold">
            Close Medical Chart
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
