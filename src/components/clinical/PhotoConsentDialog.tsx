// One-time photo consent capture. Records signature + signer name into
// `photo_consent_records`. Reused before any photo capture flow.
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { MiniSignaturePad } from "./MiniSignaturePad";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CONSENT_BODY = `I authorize Radiantilyk Aesthetic to capture clinical photographs of me at every visit as part of my medical record.

I understand:
• Photos are stored privately and used by my clinical team to plan and document treatment.
• Photos selected by me may be shown in my patient portal and used for before/after comparisons that I can download.
• Individual photos may be marked private by my provider and will not appear in my portal.
• I may revoke this consent in writing at any time; revocation applies to future portal display and exports only.

This consent is one-time and applies to all future visits until revoked.`;

export function PhotoConsentDialog({
  open, onOpenChange, clientEmail, onSigned, witnessUserId, witnessName,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  clientEmail: string;
  onSigned: () => void;
  witnessUserId?: string;
  witnessName?: string;
}) {
  const [sigPng, setSigPng] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!sigPng || !name.trim()) { toast.error("Signature and full name required."); return; }
    setSaving(true);
    const { error } = await supabase.from("photo_consent_records").insert({
      client_email: clientEmail.toLowerCase(),
      signature_png: sigPng,
      signed_name: name.trim(),
      witness_user_id: witnessUserId ?? null,
      witness_name: witnessName ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Photo consent on file.");
    onSigned();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>One-time photo consent</DialogTitle>
          <DialogDescription>Capture once per client — applies to all future visits.</DialogDescription>
        </DialogHeader>
        <pre className="text-xs whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 max-h-64 overflow-auto">{CONSENT_BODY}</pre>
        <MiniSignaturePad
          fullName={name}
          onFullNameChange={setName}
          signaturePng={sigPng}
          onSignatureChange={setSigPng}
          nameLabel="Patient full legal name"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !sigPng || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save consent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
