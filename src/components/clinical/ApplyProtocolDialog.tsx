import { useEffect, useState } from "react";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
const supabase = supabaseTyped as any;
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientEmail: string;
  clientFirstName: string;
  clientLastName: string;
  clientDob?: string | null;
  appointmentId?: string | null;
  onApplied?: () => void;
};

type ActiveVersion = {
  id: string;
  version_number: number;
  protocol_id: string;
  signed_by_name: string | null;
  signed_at: string | null;
  protocol: { id: string; title: string; category: string };
};

export function ApplyProtocolDialog({
  open, onOpenChange, clientEmail, clientFirstName, clientLastName, clientDob, appointmentId, onApplied,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<ActiveVersion[]>([]);
  const [versionId, setVersionId] = useState<string>("");
  const [startingWeek, setStartingWeek] = useState<string>("1");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ clinical_pdf_url: string | null; handout_pdf_url: string | null } | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [previewing, setPreviewing] = useState(false);

  async function loadPreview() {
    if (!versionId) return;
    setPreviewing(true);
    const { data } = await supabase
      .from("clinical_protocol_versions")
      .select("indication, titration, max_dose, contraindications, monitoring, red_flags")
      .eq("id", versionId)
      .maybeSingle();
    setPreview(data ?? null);
    setPreviewing(false);
  }

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("clinical_protocols")
        .select("id, title, category, current_version_id, clinical_protocol_versions!clinical_protocols_current_version_fk(id, version_number, signed_by_name, signed_at)")
        .not("current_version_id", "is", null)
        .order("title");
      const rows: ActiveVersion[] = [];
      for (const p of (data ?? []) as any[]) {
        const v = p.clinical_protocol_versions;
        if (v) {
          rows.push({
            id: v.id, version_number: v.version_number, protocol_id: p.id,
            signed_by_name: v.signed_by_name, signed_at: v.signed_at,
            protocol: { id: p.id, title: p.title, category: p.category },
          });
        }
      }
      setVersions(rows);
      if (rows[0]) setVersionId(rows[0].id);
      setLoading(false);
    })();
  }, [open]);

  async function apply() {
    if (!versionId) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("generate-protocol-pdf", {
      body: {
        version_id: versionId,
        client_email: clientEmail,
        client_first_name: clientFirstName,
        client_last_name: clientLastName,
        client_dob: clientDob ?? null,
        appointment_id: appointmentId ?? null,
        starting_week: Number(startingWeek) || 1,
        prescriber_notes: notes.trim() || null,
      },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    const r = data as any;
    if (r?.error) { toast.error(r.error); return; }
    setResult({ clinical_pdf_url: r?.clinical_pdf_url ?? null, handout_pdf_url: r?.handout_pdf_url ?? null });
    toast.success("Protocol applied to chart");
    onApplied?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Apply protocol to chart</DialogTitle></DialogHeader>
        {loading ? (
          <div className="py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : versions.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">
            No published protocols yet. Author and sign one from Charts → Protocols.
          </div>
        ) : result ? (
          <div className="space-y-3">
            <p className="text-sm">The protocol PDFs have been attached to this patient's chart and an audit row was written.</p>
            <div className="flex flex-col gap-2">
              {result.clinical_pdf_url && (
                <a href={result.clinical_pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                  <FileText className="h-4 w-4" /> Open clinical protocol PDF <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {result.handout_pdf_url && (
                <a href={result.handout_pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                  <FileText className="h-4 w-4" /> Open patient handout PDF <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Protocol</Label>
              <select value={versionId} onChange={e => { setVersionId(e.target.value); setPreview(null); }} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.protocol.title} · v{v.version_number} (signed {v.signed_by_name ?? "—"})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={loadPreview}
                disabled={previewing || !versionId}
                className="text-xs text-primary hover:underline disabled:text-muted-foreground"
              >
                {previewing ? "Loading preview…" : preview ? "Refresh preview" : "Preview protocol details"}
              </button>
            </div>
            {preview && (
              <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs space-y-2 max-h-64 overflow-auto">
                {preview.indication && <p><span className="font-semibold">Indication: </span>{preview.indication}</p>}
                {preview.titration && <p><span className="font-semibold">Titration: </span>{preview.titration}</p>}
                {preview.max_dose && <p><span className="font-semibold">Max dose: </span>{preview.max_dose}</p>}
                {Array.isArray(preview.contraindications) && preview.contraindications.length > 0 && (
                  <p><span className="font-semibold">Contraindications: </span>{preview.contraindications.join("; ")}</p>
                )}
                {Array.isArray(preview.monitoring) && preview.monitoring.length > 0 && (
                  <p><span className="font-semibold">Monitoring: </span>{preview.monitoring.join("; ")}</p>
                )}
                {Array.isArray(preview.red_flags) && preview.red_flags.length > 0 && (
                  <p><span className="font-semibold">Red flags: </span>{preview.red_flags.join("; ")}</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Starting week of titration</Label>
              <Input type="number" min="1" value={startingWeek} onChange={e => setStartingWeek(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Prescriber notes for this patient</Label>
              <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Patient-specific medical necessity, prior dose history, lab considerations..." />
            </div>
            <div className="text-xs text-muted-foreground">
              Patient: {clientFirstName} {clientLastName} · {clientEmail}{clientDob ? ` · DOB ${clientDob}` : ""}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={apply} disabled={submitting || !versionId}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply & generate PDFs"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
