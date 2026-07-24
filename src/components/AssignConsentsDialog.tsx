import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appointmentId: string;
  clientEmail: string;
  onAssigned: () => void;
}

export function AssignConsentsDialog({ open, onOpenChange, appointmentId, clientEmail, onAssigned }: Props) {
  const [forms, setForms] = useState<any[]>([]);
  const [already, setAlready] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      supabase.from("consent_forms").select("id, title, slug, is_optional, is_universal").eq("is_active", true).order("title"),
      supabase.from("appointment_consents").select("consent_form_id").eq("appointment_id", appointmentId),
    ]).then(([f, a]) => {
      setForms(f.data ?? []);
      setAlready(new Set((a.data ?? []).map((x: any) => x.consent_form_id)));
      setPicked(new Set());
      setLoading(false);
    });
  }, [open, appointmentId]);

  const submit = async () => {
    if (picked.size === 0) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("assign-consent-forms", {
      body: { appointmentId, consentFormIds: [...picked] },
    });
    setBusy(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Could not assign"); return; }
    toast.success(`Sent ${picked.size} consent form${picked.size > 1 ? "s" : ""} to ${clientEmail}`);
    onAssigned(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send consent forms to client</DialogTitle>
          <DialogDescription>An email with a secure signing link goes to {clientEmail}.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {forms.map((f) => {
              const isAlready = already.has(f.id);
              const isPicked = picked.has(f.id);
              return (
                <label key={f.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
                    isAlready ? "bg-muted/40 border-border opacity-60" : isPicked ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/30"
                  }`}>
                  <Checkbox
                    checked={isAlready || isPicked}
                    disabled={isAlready}
                    onCheckedChange={(v) => {
                      const next = new Set(picked);
                      v ? next.add(f.id) : next.delete(f.id);
                      setPicked(next);
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{f.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex gap-2">
                      {f.is_universal && <span>Universal</span>}
                      {f.is_optional && <span>Optional</span>}
                      {isAlready && <span className="text-success-soft-foreground">Already assigned</span>}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button onClick={submit} disabled={busy || picked.size === 0} className="rounded-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-3.5 w-3.5 mr-1.5" />Send to client</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
