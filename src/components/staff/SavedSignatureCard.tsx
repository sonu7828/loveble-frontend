import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MiniSignaturePad } from "@/components/clinical/MiniSignaturePad";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm";
import { format } from "date-fns";

type Props = {
  staffId: string;
  defaultName?: string;
};

export function SavedSignatureCard({ staffId, defaultName = "" }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(defaultName);
  const [png, setPng] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("staff_profiles")
        .select("saved_signature_png, saved_signature_name, signature_saved_at")
        .eq("id", staffId)
        .maybeSingle();
      if (cancel) return;
      if (data) {
        setPng(data.saved_signature_png ?? "");
        setName(data.saved_signature_name ?? defaultName);
        setSavedAt(data.signature_saved_at ?? null);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [staffId, defaultName]);

  async function save() {
    if (!png || png.length < 100) { toast.error("Please draw your signature first."); return; }
    if (!name.trim()) { toast.error("Please enter your full legal name."); return; }
    setSaving(true);
    const { error } = await supabase
      .from("staff_profiles")
      .update({
        saved_signature_png: png,
        saved_signature_name: name.trim(),
        signature_saved_at: new Date().toISOString(),
      })
      .eq("id", staffId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setSavedAt(new Date().toISOString());
    toast.success("Signature saved — will auto-fill on chart notes.");
  }

  async function clear() {
    if (!(await confirmDialog({ title: "Remove saved signature?", description: "You will need to draw your signature again manually on chart notes.", destructive: true, confirmLabel: "Remove Signature" }))) return;
    setSaving(true);
    const { error } = await supabase
      .from("staff_profiles")
      .update({
        saved_signature_png: null,
        saved_signature_name: null,
        signature_saved_at: null,
      })
      .eq("id", staffId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setPng("");
    setSavedAt(null);
    toast.success("Saved signature removed.");
  }

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6">
      <div>
        <h2 className="font-serif text-lg">Saved provider signature</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Save your signature once and it will auto-fill every chart note you sign. You can always redraw it on the note if you want.
          {savedAt && (
            <> Last updated {format(new Date(savedAt), "PPP")}.</>
          )}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading…</div>
      ) : (
        <>
          <MiniSignaturePad
            fullName={name}
            onFullNameChange={setName}
            signaturePng={png}
            onSignatureChange={setPng}
            nameLabel="Full legal name (as it should appear on notes)"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving} className="rounded-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save signature
            </Button>
            {savedAt && (
              <Button variant="ghost" onClick={clear} disabled={saving} className="rounded-full text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />Remove saved signature
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
