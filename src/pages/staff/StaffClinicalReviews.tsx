import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { FileCheck, FileText, CheckCircle2, Stethoscope, ArrowLeft, ShieldCheck, UserCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { getDynamicProfileName } from "@/lib/userProfile";
import { apiQuery } from "@/services/api";
import { MdSignatureBoard } from "@/components/clinical/MdSignatureBoard";
import { ClinicalChartReviewSummary } from "@/components/clinical/ClinicalChartReviewSummary";

export interface ReviewNoteItem {
  id: string;
  client: string;
  email: string;
  provider: string;
  service: string;
  type: string;
  date: string;
  status: "pending" | "cosigned";
  cosigned_by_name?: string;
  cosigned_at?: string;
  signature_png?: string;
}

export default function StaffClinicalReviews() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mdName = getDynamicProfileName(user, "Medical Director") + " (MD)";

  const [sp, setSp] = useSearchParams();
  const activeTab = sp.get("tab") || "pending";

  const handleTabChange = (val: string) => {
    setSp({ tab: val });
  };

  const [pendingNotes, setPendingNotes] = useState<ReviewNoteItem[]>([]);
  const [signedNotes, setSignedNotes] = useState<ReviewNoteItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Signing dialog state
  const [signingNote, setSigningNote] = useState<ReviewNoteItem | null>(null);
  const [signatureText, setSignatureText] = useState<string>("");
  const [signaturePng, setSignaturePng] = useState<string>("");
  const [signingBusy, setSigningBusy] = useState(false);

  const loadAllReviews = useCallback(async () => {
    setLoading(true);

    const [notesRes, gfeRes]: any[] = await Promise.all([
      apiQuery("clinical_notes").select("*").catch(() => ({ data: [] })),
      apiQuery("gfe_records").select("*").catch(() => ({ data: [] })),
    ]);

    const localNotes: any[] = JSON.parse(localStorage.getItem("rka_demo_chart_notes") || "[]");
    const localGfes: any[] = JSON.parse(localStorage.getItem("rka_demo_gfe_records") || "[]");

    const rawNotes = [...(notesRes?.data ?? []), ...localNotes];
    const rawGfes = [...(gfeRes?.data ?? []), ...localGfes];

    // Build deduplicated pending list
    const pendingMap = new Map<string, ReviewNoteItem>();
    
    rawNotes.forEach((n: any) => {
      if (n.id && n.status !== "cosigned") {
        pendingMap.set(`note-${n.id}`, {
          id: n.id,
          client: `${n.client_first_name || ""} ${n.client_last_name || ""}`.trim() || n.client_email || "Patient",
          email: n.client_email || "patient@example.com",
          provider: n.provider_name || "RN Injector / NP",
          service: n.service_name || n.category || "Clinical SOAP Note",
          type: "SOAP Chart Note",
          date: n.created_at || n.signed_at ? new Date(n.created_at || n.signed_at).toLocaleDateString() : "Recent",
          status: "pending",
        });
      }
    });

    rawGfes.forEach((g: any) => {
      if (g.id && g.status !== "cosigned") {
        pendingMap.set(`gfe-${g.id}`, {
          id: g.id,
          client: g.client_name || g.client_email || "Patient",
          email: g.client_email || "patient@example.com",
          provider: g.np_name || g.provider_name || "Kiem Vukadinovic, NP",
          service: "Good Faith Exam (GFE)",
          type: "Medical Assessment",
          date: g.created_at ? new Date(g.created_at).toLocaleDateString() : "8/3/2026",
          status: "pending",
        });
      }
    });

    // Build deduplicated signed list
    const signedMap = new Map<string, ReviewNoteItem>();

    rawNotes.forEach((n: any) => {
      if (n.id && n.status === "cosigned") {
        signedMap.set(`note-${n.id}`, {
          id: n.id,
          client: `${n.client_first_name || ""} ${n.client_last_name || ""}`.trim() || n.client_email || "Patient",
          email: n.client_email || "patient@example.com",
          provider: n.provider_name || "RN Injector / NP",
          service: n.service_name || n.category || "Clinical SOAP Note",
          type: "SOAP Chart Note",
          date: n.created_at || n.signed_at ? new Date(n.created_at || n.signed_at).toLocaleDateString() : "Recent",
          status: "cosigned",
          cosigned_by_name: n.cosigned_by_name || mdName,
          cosigned_at: n.cosigned_at || new Date().toISOString(),
          signature_png: n.signature_png,
        });
      }
    });

    rawGfes.forEach((g: any) => {
      if (g.id && g.status === "cosigned") {
        signedMap.set(`gfe-${g.id}`, {
          id: g.id,
          client: g.client_name || g.client_email || "Patient",
          email: g.client_email || "patient@example.com",
          provider: g.np_name || g.provider_name || "Kiem Vukadinovic, NP",
          service: "Good Faith Exam (GFE)",
          type: "Medical Assessment",
          date: g.created_at ? new Date(g.created_at).toLocaleDateString() : "8/3/2026",
          status: "cosigned",
          cosigned_by_name: g.cosigned_by_name || mdName,
          cosigned_at: g.cosigned_at || new Date().toISOString(),
          signature_png: g.signature_png,
        });
      }
    });

    const pendingList = Array.from(pendingMap.values());
    const signedList = Array.from(signedMap.values());

    setPendingNotes(pendingList);
    setSignedNotes(signedList);
    setLoading(false);
  }, [mdName]);

  useEffect(() => {
    loadAllReviews();
    const handleUpdate = () => loadAllReviews();
    window.addEventListener("rka_cosign_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("rka_cosign_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [loadAllReviews]);

  const handleOpenReview = (item: ReviewNoteItem) => {
    setSigningNote(item);
    setSignatureText(mdName);
  };

  const confirmCoSign = () => {
    if (!signingNote || !signatureText.trim()) return;
    setSigningBusy(true);

    const sig = signatureText.trim();
    const nowIso = new Date().toISOString();

    try {
      const localNotes: any[] = JSON.parse(localStorage.getItem("rka_demo_chart_notes") || "[]");
      const updatedNotes = localNotes.map((n) =>
        n.id === signingNote.id ? { ...n, status: "cosigned", cosigned_by_name: sig, cosigned_at: nowIso, signature_png: signaturePng } : n
      );
      localStorage.setItem("rka_demo_chart_notes", JSON.stringify(updatedNotes));

      const localGfes: any[] = JSON.parse(localStorage.getItem("rka_demo_gfe_records") || "[]");
      const updatedGfes = localGfes.map((g) =>
        g.id === signingNote.id ? { ...g, status: "cosigned", cosigned_by_name: sig, cosigned_at: nowIso, signature_png: signaturePng } : g
      );
      localStorage.setItem("rka_demo_gfe_records", JSON.stringify(updatedGfes));
    } catch {}

    // Move item from pending to signed
    const newlySignedItem: ReviewNoteItem = {
      ...signingNote,
      status: "cosigned",
      cosigned_by_name: sig,
      cosigned_at: nowIso,
      signature_png: signaturePng,
    };

    setPendingNotes((prev) => prev.filter((item) => item.id !== signingNote.id));
    setSignedNotes((prev) => [newlySignedItem, ...prev.filter((item) => item.id !== signingNote.id)]);

    setSigningBusy(false);
    setSigningNote(null);
    window.dispatchEvent(new CustomEvent("rka_cosign_updated"));
    toast.success(`Chart record co-signed & e-signed by ${sig}!`);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/staff/today")} className="h-7 px-2 text-xs text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Dashboard
            </Button>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20 font-medium text-[10px]">
              Clinical Governance
            </Badge>
          </div>
          <h1 className="font-serif text-xl sm:text-2xl font-medium tracking-tight">Clinical Reviews & Co-Signatures</h1>
          <p className="text-xs text-muted-foreground">
            Review and e-sign clinical chart notes, Good Faith Exams (GFE), and procedure notes submitted by RNs and NPs.
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full sm:w-auto justify-start bg-muted/60 p-1 rounded-xl gap-1 border border-border">
          <TabsTrigger value="pending" className="gap-2 text-xs rounded-lg font-semibold">
            <FileText className="h-3.5 w-3.5" /> Pending Notes ({pendingNotes.length})
          </TabsTrigger>
          <TabsTrigger value="sign" className="gap-2 text-xs rounded-lg font-semibold">
            <FileCheck className="h-3.5 w-3.5 text-purple-600" /> Sign Notes & Co-Signed ({signedNotes.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Pending Notes */}
        <TabsContent value="pending" className="mt-6">
          <Card className="p-5 border border-border bg-card shadow-2xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-medium tracking-tight flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-600" /> Pending Clinical Chart Notes & GFEs
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Chart notes submitted by injectors requiring supervising physician review and co-signature.</p>
              </div>
              <Badge variant="outline" className="text-[10px] font-semibold">{pendingNotes.length} Pending</Badge>
            </div>

            {loading ? (
              <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-purple-600" /></div>
            ) : pendingNotes.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mx-auto" />
                <p className="text-xs font-semibold text-foreground">No pending clinical notes to review.</p>
                <p className="text-[11px] text-muted-foreground">Newly submitted chart notes and GFEs will automatically queue here for review.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border font-medium">
                      <tr>
                        <th className="p-3">Patient Name</th>
                        <th className="p-3">Provider / Injector</th>
                        <th className="p-3">Procedure & Service</th>
                        <th className="p-3">Submitted Date</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pendingNotes.map((n, idx) => (
                        <tr key={`${n.id}-${idx}`} className="hover:bg-muted/30 transition">
                          <td className="p-3 font-semibold text-foreground">{n.client}</td>
                          <td className="p-3 text-muted-foreground">{n.provider}</td>
                          <td className="p-3">
                            <div className="font-medium text-foreground">{n.service}</div>
                            <div className="text-[10px] text-muted-foreground">{n.type}</div>
                          </td>
                          <td className="p-3 text-muted-foreground">{n.date}</td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              className="h-7 text-xs rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-2xs"
                              onClick={() => handleOpenReview(n)}
                            >
                              <FileCheck className="h-3 w-3 mr-1" /> Review & Sign
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 2: Co-Signed Notes */}
        <TabsContent value="sign" className="mt-6">
          <Card className="p-5 border border-border bg-card shadow-2xs space-y-4 rounded-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-serif text-lg font-medium tracking-tight flex items-center gap-2">
                  <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" /> Co-Signed & Authorized Records Queue
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Clinical notes and Good Faith Exams authorized by Supervising Physician signature.</p>
              </div>
              <Badge variant="outline" className="text-[10px] font-semibold">{signedNotes.length} Co-Signed</Badge>
            </div>

            {loading ? (
              <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-emerald-600" /></div>
            ) : signedNotes.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/10 space-y-1">
                <FileCheck className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-xs font-semibold text-foreground">No co-signed records on file yet.</p>
                <p className="text-[11px] text-muted-foreground">Approved clinical notes signed by the Medical Director will archive here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {signedNotes.map((n, idx) => (
                  <div key={`${n.id}-${idx}`} className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-emerald-500/20 text-emerald-800 border-emerald-500/30 text-[10px] uppercase font-bold" variant="outline">
                          <ShieldCheck className="h-3 w-3 mr-1" /> Co-Signed & Authorized
                        </Badge>
                        <span className="font-semibold text-foreground text-sm">{n.service}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Patient: <strong className="text-foreground">{n.client}</strong> ({n.email}) • Injector: {n.provider}
                      </div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        Co-Signed by: {n.cosigned_by_name || mdName} {n.cosigned_at ? `on ${new Date(n.cosigned_at).toLocaleString()}` : ""}
                      </div>
                    </div>

                    <Badge variant="outline" className="bg-emerald-600 text-white border-0 text-xs px-3 py-1 font-semibold shrink-0">
                      Supervising Sign-Off Complete
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Medical Director Co-Signature Review Dialog */}
      <Dialog open={!!signingNote} onOpenChange={(open) => !open && setSigningNote(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto p-4 sm:p-6 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-purple-600" /> Confirm Chart Note Co-Signature
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Review chart details below and sign on the signature board using mouse, touchpad, or stylus.
            </DialogDescription>
          </DialogHeader>

          {signingNote && (
            <div className="space-y-4 py-2 text-xs">
              <ClinicalChartReviewSummary record={signingNote} />

              <div className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/10 space-y-2">
                <div className="font-semibold text-purple-800 dark:text-purple-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-purple-600" /> Supervising Physician Attestation
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  "I have reviewed this clinical chart note and assessment. As Supervising Physician, I hereby co-sign and authorize this record under California Law (CCR §1474)."
                </p>
              </div>

              {/* Touchpad / Mouse / Stylus Signature Board */}
              <MdSignatureBoard
                directorName={mdName}
                accentColor="purple"
                onSignatureComplete={({ name, signaturePng }) => {
                  setSignatureText(name);
                  setSignaturePng(signaturePng);
                }}
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setSigningNote(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-2xs"
              onClick={confirmCoSign}
              disabled={!signatureText.trim() || signingBusy}
            >
              {signingBusy ? "Co-Signing..." : "Confirm & Co-Sign Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
