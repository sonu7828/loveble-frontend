// Quick-edit modal launched from the clinical alerts banner.
// Lets a provider amend the patient's allergies and current medications
// without leaving the chart. Patches the latest submitted intake row;
// if none exists, creates an "amendment" intake submission so the data
// flows back through the alerts banner on next load.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  clientEmail: string;
  onSaved?: () => void;
}

function toArr(s: string): string[] {
  return s.split(/[\n,]+/).map(x => x.trim()).filter(Boolean);
}

export function AllergyMedQuickEdit({ open, onOpenChange, clientEmail, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allergies, setAllergies] = useState("");
  const [meds, setMeds] = useState("");
  const [latestId, setLatestId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const email = (clientEmail || "").toLowerCase().trim();
    if (!email) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("client_intake_submissions")
        .select("id, allergies, allergies_other, current_medications, current_medications_other")
        .ilike("client_email", email)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const a = [...((data as any)?.allergies ?? []), (data as any)?.allergies_other].filter(Boolean);
      const m = [...((data as any)?.current_medications ?? []), (data as any)?.current_medications_other].filter(Boolean);
      setAllergies(a.join("\n"));
      setMeds(m.join("\n"));
      setLatestId((data as any)?.id ?? null);
      setLoading(false);
    })();
  }, [open, clientEmail]);

  const handleSave = async () => {
    const email = (clientEmail || "").toLowerCase().trim();
    if (!email) return;
    setSaving(true);
    try {
      const allergiesArr = toArr(allergies);
      const medsArr = toArr(meds);
      const payload: any = {
        allergies: allergiesArr,
        allergies_other: "",
        current_medications: medsArr,
        current_medications_other: "",
      };
      let error: any = null;
      if (latestId) {
        ({ error } = await supabase
          .from("client_intake_submissions")
          .update(payload)
          .eq("id", latestId));
      } else {
        ({ error } = await supabase
          .from("client_intake_submissions")
          .insert({
            ...payload,
            client_email: email,
            submission_kind: "checkin",
            submitted_at: new Date().toISOString(),
            hipaa_acknowledged: true,
            truthful_acknowledged: true,
          } as any));
      }
      if (error) { toast.error(error.message); return; }
      toast.success("Updated allergies & medications");
      onSaved?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update allergies & medications</DialogTitle>
          <DialogDescription>
            Quick chart amendment. One item per line (or comma-separated).
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-6">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading current values…
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="allergies-qe">Allergies</Label>
              <Textarea
                id="allergies-qe"
                rows={4}
                placeholder="e.g. Penicillin&#10;Sulfa&#10;Latex"
                value={allergies}
                onChange={e => setAllergies(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="meds-qe">Current medications</Label>
              <Textarea
                id="meds-qe"
                rows={5}
                placeholder="e.g. Aspirin 81mg&#10;Lisinopril 10mg"
                value={meds}
                onChange={e => setMeds(e.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save amendment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
