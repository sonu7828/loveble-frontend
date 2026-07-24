import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  fullName: string;
  onFullNameChange: (n: string) => void;
  signaturePng: string;
  onSignatureChange: (dataUrl: string) => void;
  label?: string;
  nameLabel?: string;
};

export function MiniSignaturePad({
  fullName,
  onFullNameChange,
  signaturePng,
  onSignatureChange,
  label = "Draw your signature",
  nameLabel = "Type your full legal name",
}: Props) {
  const sigRef = useRef<SignatureCanvas | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [_, setRev] = useState(0);

  useEffect(() => {
    const resize = () => {
      const canvas = sigRef.current?.getCanvas();
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const w = wrap.clientWidth;
      const h = 200;
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.getContext("2d")?.scale(ratio, ratio);
      if (signaturePng) sigRef.current?.fromDataURL(signaturePng, { width: w, height: h });
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleEnd() {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    const png = sigRef.current.getCanvas().toDataURL("image/png");
    onSignatureChange(png);
    setRev(v => v + 1);
  }

  function clear() {
    sigRef.current?.clear();
    onSignatureChange("");
    setRev(v => v + 1);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card/40 p-4">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">{nameLabel}</Label>
        <Input value={fullName} onChange={e => onFullNameChange(e.target.value)} placeholder="First Last, credentials (e.g. Jane Doe, NP)" className="h-12 text-base" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
          <Button type="button" size="sm" variant="outline" onClick={clear} className="h-10 px-4">Clear</Button>
        </div>
        <div
          ref={wrapRef}
          className="rounded-md border-2 border-dashed border-border bg-background overflow-hidden"
          style={{ touchAction: "none" }}
        >
          <SignatureCanvas
            ref={(r) => { sigRef.current = r; }}
            penColor="#111"
            minWidth={1.2}
            maxWidth={2.8}
            velocityFilterWeight={0.7}
            onEnd={handleEnd}
            canvasProps={{
              className: "w-full h-[200px] touch-none",
              style: { touchAction: "none" },
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">Sign with your finger or Apple Pencil. Tap Clear to redo.</p>
      </div>
    </div>
  );
}
