// Single name + signature pad reused across every consent form on the
// streamlined remote signing page. Designed thumb-first for mobile.
import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eraser } from "lucide-react";

interface Props {
  defaultName?: string;
  name: string;
  signaturePng: string;
  onNameChange: (v: string) => void;
  onSignatureChange: (png: string) => void;
}

export function SharedConsentSigner({ defaultName, name, signaturePng, onNameChange, onSignatureChange }: Props) {
  const sigRef = useRef<SignatureCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [penColor, setPenColor] = useState("#0f172a");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setPenColor(isDark ? "#f8fafc" : "#0f172a");
  }, []);

  const signatureRef = useRef(signaturePng);
  signatureRef.current = signaturePng;

  useEffect(() => {
    const resize = () => {
      const canvas = sigRef.current?.getCanvas();
      const wrap = containerRef.current;
      if (!canvas || !wrap) return;
      const w = wrap.clientWidth || 500;
      const h = 224;
      canvas.width = w;
      canvas.height = h;

      const png = signatureRef.current;
      if (png && sigRef.current) {
        try {
          sigRef.current.fromDataURL(png, { width: w, height: h });
        } catch {}
      }
    };

    const timer = setTimeout(resize, 50);
    window.addEventListener("resize", resize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Scroll lock while drawing
  const scrollYRef = useRef(0);
  const lockScroll = () => {
    scrollYRef.current = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollYRef.current}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  };
  const unlockScroll = () => {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, scrollYRef.current);
  };
  useEffect(() => () => { unlockScroll(); }, []);

  const handleEnd = () => {
    unlockScroll();
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    try {
      onSignatureChange(sigRef.current.getCanvas().toDataURL("image/png"));
    } catch {}
  };

  const clear = () => {
    sigRef.current?.clear();
    onSignatureChange("");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Your full legal name</Label>
        <Input
          className="mt-1.5"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={defaultName ?? "Jane Smith"}
          maxLength={120}
          autoComplete="name"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Draw your signature once</Label>
          <button
            type="button"
            onClick={clear}
            className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Eraser className="h-3 w-3" /> Clear
          </button>
        </div>
        <div ref={containerRef} className="rounded-lg border border-border bg-background touch-none overflow-hidden select-none">
          <SignatureCanvas
            ref={sigRef}
            penColor={penColor}
            minWidth={1.5}
            maxWidth={3.5}
            onBegin={lockScroll}
            onEnd={handleEnd}
            canvasProps={{
              className: "w-full h-56 cursor-crosshair block",
              style: { touchAction: "none" }
            }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          By typing your name and signing above, you confirm you have read each
          consent listed and agree to the terms — your signature is applied to
          every form you accepted.
        </p>
      </div>
    </div>
  );
}
