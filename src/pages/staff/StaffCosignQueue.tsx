import { useEffect, useState } from "react";
import { apiQuery } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Link, Navigate } from "react-router-dom";
import { Loader2, ClipboardCheck, ChevronRight, FileCheck, Stethoscope, FileText, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getDynamicProfileName } from "@/lib/userProfile";
import { MdSignatureBoard } from "@/components/clinical/MdSignatureBoard";
import { ClinicalChartReviewSummary } from "@/components/clinical/ClinicalChartReviewSummary";

type Note = {
  id: string;
  appointment_id?: string | null;
  client_email: string;
  client_first_name?: string | null;
  client_last_name?: string | null;
  service_name?: string | null;
  category: string;
  provider_name?: string | null;
  provider_role?: string | null;
  signed_at?: string | null;
  status: string;
};

export default function StaffCosignQueue() {
  const { user, isAdmin, isNP, isMedicalDirector, isRNInjector, loading } = useAuth();
  const mdName = getDynamicProfileName(user, "Medical Director") + " (MD)";

  const [notes, setNotes] = useState<Note[]>([]);
  const [busy, setBusy] = useState(true);
  const [signingNote, setSigningNote] = useState<Note | null>(null);
  const [signatureText, setSignatureText] = useState<string>("");
  const [signingBusy, setSigningBusy] = useState(false);

  const loadQueue = async () => {
    setBusy(true);
    const { data } = await apiQuery
      .from("clinical_notes")
      .select("id, appointment_id, client_email, client_first_name, client_last_name, service_name, category, provider_name, provider_role, signed_at, status")
      .order("signed_at", { ascending: true })
      .limit(200);

    const localNotes: any[] = JSON.parse(localStorage.getItem("rka_demo_chart_notes") || "[]");
    const localGfes: any[] = JSON.parse(localStorage.getItem("rka_demo_gfe_records") || "[]");

    const dbNotes = (data ?? []) as Note[];
    const combined = [...dbNotes, ...localNotes, ...localGfes].filter((n: any) => n.status !== "cosigned");
    setNotes(combined);
    setBusy(false);
  };

  useEffect(() => {
    if (loading) return;
    loadQueue();
    window.addEventListener("rka_cosign_updated", loadQueue);
    return () => window.removeEventListener("rka_cosign_updated", loadQueue);
  }, [loading]);

  const handleOpenSigning = (n: Note) => {
    setSigningNote(n);
    setSignatureText(mdName);
  };

  const confirmCoSign = () => {
    if (!signingNote || !signatureText.trim()) return;
    setSigningBusy(true);

    const sig = signatureText.trim();
    try {
      const localNotes: any[] = JSON.parse(localStorage.getItem("rka_demo_chart_notes") || "[]");
      const updatedNotes = localNotes.map((n) => (n.id === signingNote.id ? { ...n, status: "cosigned", cosigned_by_name: sig } : n));
      localStorage.setItem("rka_demo_chart_notes", JSON.stringify(updatedNotes));

      const localGfes: any[] = JSON.parse(localStorage.getItem("rka_demo_gfe_records") || "[]");
      const updatedGfes = localGfes.map((g) => (g.id === signingNote.id ? { ...g, status: "cosigned", cosigned_by_name: sig } : g));
      localStorage.setItem("rka_demo_gfe_records", JSON.stringify(updatedGfes));
    } catch {}

    setNotes((prev) => prev.filter((n) => n.id !== signingNote.id));
    setSigningBusy(false);
    setSigningNote(null);
    window.dispatchEvent(new CustomEvent("rka_cosign_updated"));
    toast.success(`Chart note co-signed & authorized by ${sig}!`);
  };

  if (loading) return <div className="p-8"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (!isAdmin && !isNP && !isMedicalDirector && !isRNInjector) return <Navigate to="/staff/today" replace />;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <header className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h1 className="text-2xl font-serif flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-purple-600" />
            Clinical Co-Sign Queue
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Chart notes and Good Faith Exams signed by injectors requiring Supervising Physician co-signature.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadQueue} className="h-8 text-xs">
          Refresh Queue
        </Button>
      </header>

      {busy ? (
        <div className="p-8 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
      ) : notes.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-emerald-500/60 mx-auto" />
          <p className="text-sm font-semibold text-foreground">All caught up! No clinical records awaiting co-signature.</p>
          <p className="text-xs text-muted-foreground">Newly signed chart notes requiring review will automatically appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => {
            const name = `${n.client_first_name ?? ""} ${n.client_last_name ?? ""}`.trim() || n.client_email;
            return (
              <div key={n.id} className="rounded-xl border border-border bg-card p-4 shadow-2xs hover:border-purple-500/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-sm">{name}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-xs font-medium text-purple-700 dark:text-purple-300">{n.service_name ?? n.category}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>Injector: <strong>{n.provider_name ?? "RN Injector"}</strong></span>
                    <span>·</span>
                    <span>Email: {n.client_email}</span>
                    <span>·</span>
                    <span>Signed {n.signed_at ? format(new Date(n.signed_at), "MMM d, h:mm a") : "Recently"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* NPs can only review — signing is MD-only */}
                  {isMedicalDirector || isAdmin ? (
                    <Button size="sm" className="h-8 text-xs rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-2xs" onClick={() => handleOpenSigning(n)}>
                      <FileCheck className="h-3.5 w-3.5 mr-1" /> Review &amp; Co-Sign
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl font-medium" onClick={() => handleOpenSigning(n)}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> Review Chart
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MD Co-Signature Dialog */}
      <Dialog open={!!signingNote} onOpenChange={(open) => !open && setSigningNote(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto p-4 sm:p-6 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-purple-600" />
              {isMedicalDirector || isAdmin ? "Confirm Chart Note Co-Signature" : "Chart Note Review"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isMedicalDirector || isAdmin
                ? "Review chart details below and sign on the signature board using mouse, touchpad, or stylus."
                : "Review-only access. Co-signature is performed by the Medical Director."}
            </DialogDescription>
          </DialogHeader>

          {signingNote && (
            <div className="space-y-4 py-2 text-xs">
              <ClinicalChartReviewSummary
                record={{
                  id: signingNote.id,
                  client: `${signingNote.client_first_name || ""} ${signingNote.client_last_name || ""}`.trim() || signingNote.client_email,
                  email: signingNote.client_email,
                  provider: signingNote.provider_name || "Kiem Vukadinovic, NP",
                  service: signingNote.service_name || signingNote.category || "Good Faith Exam (GFE)",
                  type: "Medical Assessment",
                  date: signingNote.signed_at ? format(new Date(signingNote.signed_at), "MMM d, yyyy") : "Recent",
                }}
              />

              {/* Signature board + attestation — Medical Director only */}
              {(isMedicalDirector || isAdmin) && (
                <>
                  <div className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/10 space-y-2">
                    <div className="font-semibold text-purple-800 dark:text-purple-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileCheck className="h-4 w-4 text-purple-600" /> Supervising Physician Attestation
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      "I have reviewed this clinical chart note and assessment. As Supervising Physician, I hereby co-sign and authorize this record under California Law (CCR §1474)."
                    </p>
                  </div>

                  {/* Interactive Touchpad / Mouse / Stylus Signature Board */}
                  <MdSignatureBoard
                    directorName={mdName}
                    accentColor="purple"
                    onSignatureComplete={({ name }) => {
                      setSignatureText(name);
                    }}
                  />
                </>
              )}

              {/* NP read-only notice */}
              {isNP && !isMedicalDirector && !isAdmin && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/8 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">ℹ️</span>
                  <span>This chart is pending co-signature by the Medical Director. You may review the clinical details above but cannot sign on behalf of the supervising physician.</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setSigningNote(null)}>
              {isMedicalDirector || isAdmin ? "Cancel" : "Close"}
            </Button>
            {/* Co-sign button — Medical Director only */}
            {(isMedicalDirector || isAdmin) && (
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-2xs"
                onClick={confirmCoSign}
                disabled={!signatureText.trim() || signingBusy}
              >
                {signingBusy ? "Co-Signing..." : "Confirm & Co-Sign Record"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
