// Standardized photo capture flow with angle picker + ghost overlay of the
// patient's last matching-angle photo. Falls back to file picker if camera
// is unavailable. Auto-uploads to clinical-photos bucket, writes meta row
// (angle/region/product/framing_ref_path/exposure), and appends path to the
// parent's pre/post array via onCaptured.
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Camera, Loader2, RefreshCw, Check, AlertTriangle, ShieldCheck, ImagePlus, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PhotoLightingHint } from "./PhotoLightingHint";
import { PhotoConsentDialog } from "./PhotoConsentDialog";

export const PHOTO_ANGLES = [
  { id: "front",        label: "Front" },
  { id: "left_oblique", label: "Left 45°" },
  { id: "left",         label: "Left 90°" },
  { id: "right_oblique",label: "Right 45°" },
  { id: "right",        label: "Right 90°" },
  { id: "chin_up",      label: "Chin up" },
  { id: "chin_down",    label: "Chin down" },
  { id: "closeup",      label: "Close-up" },
] as const;
export type PhotoAngle = typeof PHOTO_ANGLES[number]["id"];

type Props = {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  clientEmail: string;
  clientName?: string;
  noteId: string;
  appointmentId?: string | null;
  kind: "pre" | "post";
  region?: string;
  product?: string;
  onCaptured: (storagePath: string) => void;
};

export function PhotoCaptureFlow(props: Props) {
  const { open, onOpenChange, clientEmail, clientName, noteId, appointmentId, kind, region, product, onCaptured } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [angle, setAngle] = useState<PhotoAngle>("front");
  const [regionInput, setRegionInput] = useState(region ?? "");
  const [productInput, setProductInput] = useState(product ?? "");
  const [showGhost, setShowGhost] = useState(true);
  const [ghostUrl, setGhostUrl] = useState<string | null>(null);
  const [ghostPath, setGhostPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [restartKey, setRestartKey] = useState(0);

  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  // Check consent — accept either a standalone photo_consent_records row
  // OR a signed appointment consent for the photography / photo-release forms.
  // This lets us collect photo consent during normal appointment intake
  // instead of forcing a re-sign at capture time.
  useEffect(() => {
    if (!open || !clientEmail) return;
    let cancelled = false;
    (async () => {
      const email = clientEmail.toLowerCase();
      // 1) Legacy/standalone consent record
      const { data: legacy } = await supabase
        .from("photo_consent_records")
        .select("id, revoked_at")
        .ilike("client_email", email)
        .is("revoked_at", null)
        .limit(1);
      if (legacy?.length) { if (!cancelled) setHasConsent(true); return; }

      // 2) Photography / Photo-Video / Media Release / Image Use consent signed
      //    at any appointment. Match a broader set of slugs/titles so consent
      //    forms named "Media Release", "Image Use Authorization", etc.
      //    are recognized — previously only forms whose slug/title contained
      //    the literal substring "photo" would count, false-blocking capture.
      const { data: forms } = await supabase
        .from("consent_forms")
        .select("id, slug, title")
        .or("slug.ilike.%photo%,slug.ilike.%media%,slug.ilike.%image%,title.ilike.%photo%,title.ilike.%media%,title.ilike.%image%");
      const formIds = (forms ?? []).map(f => f.id);
      // If no recognizable form schema exists, leave hasConsent as null
      // (indeterminate) — capture stays unblocked rather than false-failing.
      if (formIds.length === 0) { if (!cancelled) setHasConsent(null); return; }

      const { data: sigs } = await supabase
        .from("consent_signatures")
        .select("id, expires_at, decision")
        .ilike("client_email", email)
        .in("consent_form_id", formIds)
        .eq("decision", "consent")
        .limit(20);
      const now = Date.now();
      const ok = (sigs ?? []).some(s => !s.expires_at || new Date(s.expires_at).getTime() > now);
      if (!cancelled) setHasConsent(ok);
    })();
    return () => { cancelled = true; };
  }, [open, clientEmail, consentOpen]);

  // Load ghost overlay = last photo of same angle for this client
  useEffect(() => {
    if (!open || !clientEmail) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("clinical_photo_meta")
        .select("storage_path, created_at")
        .ilike("client_email", clientEmail)
        .eq("angle", angle)
        .order("created_at", { ascending: false })
        .limit(1);
      const path = data?.[0]?.storage_path;
      if (!path) { if (!cancelled) { setGhostUrl(null); setGhostPath(null); } return; }
      const { data: s } = await supabase.storage.from("clinical-photos").createSignedUrl(path, 600);
      if (!cancelled) { setGhostUrl(s?.signedUrl ?? null); setGhostPath(path); }
    })();
    return () => { cancelled = true; };
  }, [open, clientEmail, angle]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // Start camera. `restartKey` is bumped by the Restart button so this effect
  // re-runs after stop() — previously the button stopped the stream but the
  // effect never re-fired, leaving the preview blank.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCameraError(null);
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        setCameraError(e?.message ?? "Camera unavailable");
      }
    })();
    return () => { cancelled = true; stop(); };
  }, [open, stop, restartKey]);

  async function uploadBlob(blob: Blob, mime: string) {
    if (hasConsent === false) { toast.error("Photo consent required."); return; }
    setBusy(true);
    try {
      const ext = mime.includes("png") ? "png" : "jpg";
      const key = `${noteId}/${kind}/${Date.now()}-${angle}.${ext}`;
      const { error } = await supabase.storage.from("clinical-photos").upload(key, blob, {
        contentType: mime, upsert: false,
      });
      if (error) throw error;
      const { data: u } = await supabase.auth.getUser();
      const { error: mErr } = await supabase.from("clinical_photo_meta").insert({
        storage_path: key,
        clinical_note_id: noteId,
        appointment_id: appointmentId ?? null,
        client_email: clientEmail.toLowerCase(),
        angle,
        region: regionInput.trim() || null,
        product: productInput.trim() || null,
        kind,
        framing_ref_path: ghostPath,
        created_by: u.user?.id ?? null,
      });
      if (mErr) console.warn("photo meta insert failed", mErr);
      onCaptured(key);
      toast.success(`${PHOTO_ANGLES.find(a => a.id === angle)?.label} captured`);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) { toast.error("Camera not ready"); return; }
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob(b => { if (b) void uploadBlob(b, "image/jpeg"); }, "image/jpeg", 0.92);
  }

  function onFile(files: FileList | null) {
    const f = files?.[0]; if (!f) return;
    if (!/^image\//.test(f.type)) { toast.error("Image only"); return; }
    void uploadBlob(f, f.type);
  }

  return (
    <Dialog open={open} onOpenChange={(b) => { if (!b) stop(); onOpenChange(b); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Standardized capture — {kind === "pre" ? "pre-procedure" : "post-procedure"}
            {clientName && <span className="text-sm font-normal text-muted-foreground">· {clientName}</span>}
          </DialogTitle>
        </DialogHeader>

        {hasConsent === false && (
          <div className="rounded-md border border-warning/40 bg-warning-soft p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
            <div className="flex-1 text-xs">
              <div className="font-medium">Photo consent not on file.</div>
              <div className="text-muted-foreground">Capture once before photographing this patient.</div>
            </div>
            <Button size="sm" onClick={() => setConsentOpen(true)}>Get consent</Button>
          </div>
        )}
        {hasConsent === true && (
          <div className="text-[11px] text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Photo consent on file</div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {PHOTO_ANGLES.map(a => (
            <button
              key={a.id} type="button"
              onClick={() => setAngle(a.id)}
              className={`px-3 py-1 rounded-full text-xs border ${angle === a.id
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:border-primary/50"}`}
            >{a.label}</button>
          ))}
        </div>

        <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
          {cameraError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white text-sm p-4 text-center">
              <AlertTriangle className="h-6 w-6" />
              <div>{cameraError}</div>
              <label className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded border border-white/30 cursor-pointer text-xs">
                <ImagePlus className="h-3 w-3" /> Pick from photos
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onFile(e.target.files)} />
              </label>
            </div>
          ) : (
            <>
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              {ghostUrl && showGhost && (
                <img
                  src={ghostUrl} alt=""
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none mix-blend-screen"
                  style={{ opacity: 0.35 }}
                />
              )}
              {/* Center rule-of-thirds guides */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-1/3 top-0 bottom-0 border-l border-white/20" />
                <div className="absolute left-2/3 top-0 bottom-0 border-l border-white/20" />
                <div className="absolute top-1/3 left-0 right-0 border-t border-white/20" />
                <div className="absolute top-2/3 left-0 right-0 border-t border-white/20" />
              </div>
            </>
          )}
        </div>

        <PhotoLightingHint />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Region</Label>
            <Input value={regionInput} onChange={e => setRegionInput(e.target.value)} placeholder="e.g. Glabella, Chin" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Product</Label>
            <Input value={productInput} onChange={e => setProductInput(e.target.value)} placeholder="e.g. Botox, Volux" />
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
          <Button
            type="button" variant="ghost" size="sm"
            onClick={() => setShowGhost(s => !s)}
            disabled={!ghostUrl}
          >
            {showGhost ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
            {ghostUrl ? (showGhost ? "Hide ghost overlay" : "Show ghost overlay") : "No prior photo at this angle"}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Close</Button>
            <Button type="button" onClick={capture} disabled={busy || hasConsent === false || !!cameraError}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Capture
            </Button>
            <Button type="button" variant="ghost" size="icon" title="Restart camera" onClick={() => { stop(); setCameraError(null); setRestartKey(k => k + 1); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <PhotoConsentDialog
          open={consentOpen}
          onOpenChange={setConsentOpen}
          clientEmail={clientEmail}
          onSigned={() => setHasConsent(true)}
        />
      </DialogContent>
    </Dialog>
  );
}
