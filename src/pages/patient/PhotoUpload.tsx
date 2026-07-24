import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { PortalCTA } from "@/components/PortalCTA";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Standardized capture angles. Picking an angle prepends a tag to the caption
// so the provider can sort the gallery by angle later. A ghost outline appears
// over the preview as a framing guide so clients line their face up the same
// way every visit.
const ANGLES = [
  { id: "front", label: "Front" },
  { id: "left", label: "Left profile" },
  { id: "right", label: "Right profile" },
  { id: "ol", label: "¾ left" },
  { id: "or", label: "¾ right" },
] as const;
type Angle = typeof ANGLES[number]["id"] | null;

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      resolve(s.split(",")[1] || "");
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });

function AngleGuide({ angle }: { angle: Angle }) {
  if (!angle) return null;
  // Lightweight SVG silhouette pinned over the preview as a translucent ghost.
  // The shape rotates / mirrors to hint at the requested pose.
  const transforms: Record<string, string> = {
    front: "",
    left: "rotate(-15deg) scaleX(0.9)",
    right: "rotate(15deg) scaleX(-0.9) translate(0,0)",
    ol: "rotate(-25deg) scaleX(0.85)",
    or: "rotate(25deg) scaleX(-0.85)",
  };
  const t = transforms[angle] ?? "";
  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="xMidYMid meet"
      style={{ opacity: 0.55 }}
    >
      <g style={{ transformOrigin: "50% 55%", transform: t }} fill="none" stroke="white" strokeWidth="0.6" strokeDasharray="1.5 1.5">
        <ellipse cx="50" cy="55" rx="26" ry="36" />
        <path d="M22 40 Q50 12 78 40" />
        <ellipse cx="38" cy="55" rx="3.5" ry="1.8" />
        <ellipse cx="62" cy="55" rx="3.5" ry="1.8" />
        <path d="M50 56 L46 70 Q50 73 54 70 Z" />
        <path d="M40 80 Q50 76 60 80" />
      </g>
    </svg>
  );
}

export default function PhotoUpload() {
  const { token } = useParams();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [angle, setAngle] = useState<Angle>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter(f => ACCEPTED.includes(f.type) && f.size <= 10 * 1024 * 1024);
    if (incoming.length === 0) { toast.error("Please choose a JPG/PNG/HEIC under 10MB"); return; }
    const next = [...files, ...incoming].slice(0, 5);
    setFiles(next);
    setPreviews(next.map(f => URL.createObjectURL(f)));
  };

  const remove = (i: number) => {
    const n = files.filter((_, idx) => idx !== i);
    setFiles(n);
    setPreviews(n.map(f => URL.createObjectURL(f)));
  };

  const submit = async () => {
    if (files.length === 0) { toast.error("Add at least one photo"); return; }
    setSubmitting(true);
    try {
      const angleTag = angle ? `[${ANGLES.find(a => a.id === angle)?.label}] ` : "";
      const fullCaption = `${angleTag}${caption}`.trim() || undefined;
      for (const f of files) {
        const b64 = await fileToBase64(f);
        const { data, error } = await supabase.functions.invoke("client-upload-photo", {
          body: { token, fileBase64: b64, mimeType: f.type, caption: fullCaption },
        });
        if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      }
      setDone(true);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-xl">
        {done ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-primary/10 mb-4">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <h1 className="font-serif text-4xl">Thank you!</h1>
            <p className="text-muted-foreground mt-3">Your photo has been added to your chart.</p>
            <PortalCTA tab="photos" label="View my photos" />
          </div>
        ) : (
          <div>
            <h1 className="font-serif text-4xl">Share your progress</h1>
            <p className="text-muted-foreground mt-2">
              Upload a photo so your provider can see how you're healing. Stored privately in your chart.
            </p>

            <div className="mt-8 space-y-6">
              <div>
                <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">
                  Pick an angle <span className="font-normal normal-case tracking-normal">(optional, helps us compare visits)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ANGLES.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAngle(angle === a.id ? null : a.id)}
                      className={`text-xs rounded-full px-3 py-1.5 border transition ${angle === a.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-secondary/40"}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:bg-secondary/40 transition">
                <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <div className="text-sm font-medium">Tap to choose photos</div>
                <div className="text-xs text-muted-foreground mt-1">Up to 5 · JPG, PNG, or HEIC · max 10MB each</div>
                <input
                  type="file"
                  accept={ACCEPTED.join(",")}
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
              </label>

              {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {previews.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                      <img src={src} alt={`upload ${i + 1}`} className="w-full h-full object-cover" />
                      <AngleGuide angle={angle} />
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
                        aria-label="Remove photo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label htmlFor="caption" className="text-sm font-medium block mb-2">
                  Note for your provider <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Textarea
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Anything you'd like your provider to know?"
                />
              </div>

              <Button onClick={submit} disabled={submitting || files.length === 0} size="lg" className="w-full rounded-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send to my provider"}
              </Button>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
