import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

const EVENT_TYPES = [
  "bruising","swelling","nodule","granuloma","infection","tyndall",
  "asymmetry","ptosis","headache","vascular_occlusion","necrosis",
  "anaphylaxis","allergic_reaction","other",
] as const;
const SEVERITY = ["mild","moderate","severe","life_threatening"] as const;
const OUTCOME = ["ongoing","improving","resolved","referred","er_sent"] as const;

type Props = {
  clientEmail: string;
  clientFirstName?: string;
  clientLastName?: string;
  clinicalNoteId?: string;
  appointmentId?: string;
  trigger?: React.ReactNode;
  onSaved?: () => void;
};

export function AdverseEventDialog({
  clientEmail, clientFirstName, clientLastName,
  clinicalNoteId, appointmentId, trigger, onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyForm = {
    event_type: "bruising" as typeof EVENT_TYPES[number],
    severity: "mild" as typeof SEVERITY[number],
    body_region: "",
    product_involved: "",
    intervention: "",
    medications_given: "",
    outcome: "ongoing" as typeof OUTCOME[number],
    followup_at: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  // Reset form to defaults whenever the dialog opens. Previously the form held
  // stale values across patients — high risk for documentation errors.
  useEffect(() => {
    if (open) setForm(emptyForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientEmail]);


  async function save() {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = {
      client_email: clientEmail.toLowerCase(),
      client_first_name: clientFirstName,
      client_last_name: clientLastName,
      clinical_note_id: clinicalNoteId ?? null,
      appointment_id: appointmentId ?? null,
      event_type: form.event_type,
      severity: form.severity,
      body_region: form.body_region || null,
      product_involved: form.product_involved || null,
      intervention: form.intervention || null,
      medications_given: form.medications_given ? form.medications_given.split(",").map(s => s.trim()).filter(Boolean) : [],
      outcome: form.outcome,
      followup_at: form.followup_at ? new Date(form.followup_at).toISOString() : null,
      notes: form.notes || null,
      reported_by: u.user?.id ?? null,
    };
    const { error } = await supabase.from("adverse_events").insert(payload as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Adverse event logged");
    setOpen(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline" size="sm"><AlertTriangle className="h-4 w-4 mr-1" />Log adverse event</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Log adverse event</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.event_type} onValueChange={(v: any) => setForm(p => ({ ...p, event_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g," ")}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Severity">
            <Select value={form.severity} onValueChange={(v: any) => setForm(p => ({ ...p, severity: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SEVERITY.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g," ")}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Body region"><Input value={form.body_region} onChange={e => setForm(p => ({ ...p, body_region: e.target.value }))} placeholder="e.g. upper lip" /></Field>
          <Field label="Product involved"><Input value={form.product_involved} onChange={e => setForm(p => ({ ...p, product_involved: e.target.value }))} placeholder="e.g. Juvederm Volbella" /></Field>
          <Field label="Intervention" className="col-span-2"><Textarea rows={2} value={form.intervention} onChange={e => setForm(p => ({ ...p, intervention: e.target.value }))} /></Field>
          <Field label="Medications given (comma-separated)" className="col-span-2"><Input value={form.medications_given} onChange={e => setForm(p => ({ ...p, medications_given: e.target.value }))} placeholder="e.g. ibuprofen 600mg, arnica" /></Field>
          <Field label="Outcome">
            <Select value={form.outcome} onValueChange={(v: any) => setForm(p => ({ ...p, outcome: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{OUTCOME.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g," ")}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Follow-up at">
            <Input type="datetime-local" value={form.followup_at} onChange={e => setForm(p => ({ ...p, followup_at: e.target.value }))} />
          </Field>
          <Field label="Notes" className="col-span-2"><Textarea rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Log event"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function AdverseEventList({ clientEmail }: { clientEmail: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    if (!clientEmail) return;
    (async () => {
      const { data } = await supabase
        .from("adverse_events")
        .select("*")
        .eq("client_email", clientEmail.toLowerCase())
        .order("event_date", { ascending: false });
      setRows(data ?? []);
    })();
  }, [clientEmail]);
  if (rows.length === 0) return <div className="text-sm text-muted-foreground py-6 text-center">No adverse events logged.</div>;
  return (
    <div className="divide-y divide-border rounded-md border border-border">
      {rows.map(r => (
        <div key={r.id} className="p-3 text-sm">
          <div className="flex items-center justify-between">
            <div className="font-medium">{String(r.event_type).replace(/_/g," ")} · <span className={`${r.severity === "severe" || r.severity === "life_threatening" ? "text-destructive" : "text-muted-foreground"}`}>{String(r.severity).replace(/_/g," ")}</span></div>
            <div className="text-xs text-muted-foreground">{new Date(r.event_date).toLocaleString()}</div>
          </div>
          {r.body_region && <div className="text-xs text-muted-foreground">Region: {r.body_region}{r.product_involved ? ` · ${r.product_involved}` : ""}</div>}
          {r.intervention && <div className="mt-1 text-xs">Intervention: {r.intervention}</div>}
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Outcome: {r.outcome}</span>
            {r.followup_at && <span>· Follow-up {new Date(r.followup_at).toLocaleDateString()}</span>}
            {r.followup_complete && <span>✓ done</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
