import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PenTool, Eraser, Type, Sparkles } from "lucide-react";

type Props = {
  directorName: string;
  onSignatureComplete: (sigData: { name: string; signaturePng: string }) => void;
  accentColor?: "emerald" | "purple";
};

export function MdSignatureBoard({
  directorName,
  onSignatureComplete,
  accentColor = "emerald",
}: Props) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState(directorName);
  const [signaturePng, setSignaturePng] = useState("");
  const sigRef = useRef<SignatureCanvas | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const isEmerald = accentColor === "emerald";
  const borderAcc = isEmerald ? "border-emerald-500/30 bg-emerald-500/5" : "border-purple-500/30 bg-purple-500/5";
  const textAcc = isEmerald ? "text-emerald-800 dark:text-emerald-300" : "text-purple-800 dark:text-purple-300";
  const iconAcc = isEmerald ? "text-emerald-600" : "text-purple-600";
  const penColor = isEmerald ? "#047857" : "#6B21A8";

  const cbRef = useRef(onSignatureComplete);
  cbRef.current = onSignatureComplete;

  useEffect(() => {
    cbRef.current({
      name: typedName,
      signaturePng: mode === "draw" ? signaturePng : "",
    });
  }, [typedName, signaturePng, mode]);

  const handleDrawEnd = () => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      const png = sigRef.current.getCanvas().toDataURL("image/png");
      setSignaturePng(png);
    }
  };

  const handleClear = () => {
    sigRef.current?.clear();
    setSignaturePng("");
  };

  return (
    <div className={`p-4 rounded-xl border ${borderAcc} space-y-3`}>
      <div className="flex items-center justify-between">
        <Label className={`text-xs font-semibold uppercase tracking-wider ${textAcc} flex items-center gap-1.5`}>
          <PenTool className={`h-4 w-4 ${iconAcc}`} /> Medical Director Signature Board
        </Label>

        {/* Mode Switcher: Draw vs Type */}
        <div className="flex items-center gap-1 bg-background/80 p-1 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setMode("draw")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition ${
              mode === "draw"
                ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PenTool className="h-3 w-3" /> Draw Sign Board
          </button>
          <button
            type="button"
            onClick={() => setMode("type")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition ${
              mode === "type"
                ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Type className="h-3 w-3" /> Type Name
          </button>
        </div>
      </div>

      {mode === "draw" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Sign using Mouse, Touchpad, Touchscreen, or Apple Pencil below:</span>
            {signaturePng && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClear} className="h-6 text-[11px] text-destructive hover:bg-destructive/10 px-2">
                <Eraser className="h-3 w-3 mr-1" /> Clear Canvas
              </Button>
            )}
          </div>

          <div
            ref={wrapRef}
            className="relative rounded-xl border-2 border-dashed border-primary/30 bg-background overflow-hidden shadow-2xs"
            style={{ touchAction: "none" }}
          >
            <SignatureCanvas
              ref={(r) => { sigRef.current = r; }}
              penColor={penColor}
              minWidth={1.5}
              maxWidth={3.5}
              velocityFilterWeight={0.7}
              onEnd={handleDrawEnd}
              canvasProps={{
                className: "w-full h-[150px] touch-none cursor-crosshair",
                style: { touchAction: "none" },
              }}
            />

            {!signaturePng && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 text-xs font-serif italic text-muted-foreground gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Sign here with finger, mouse, or stylus
              </div>
            )}
            
            <div className="absolute right-2.5 bottom-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 pointer-events-none">
              SIGNATURE BOARD
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Type full legal name below:
          </Label>
          <div className="relative">
            <Input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="e.g. Dr. Dhruva (MD)"
              className="h-11 font-serif text-base italic text-foreground shadow-2xs"
            />
            <span className="absolute right-2.5 top-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 pointer-events-none">
              TYPED SIGNATURE
            </span>
          </div>
        </div>
      )}

      {/* Name confirmation */}
      <div className="pt-1 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>Signing as: <strong className="text-foreground font-serif">{typedName}</strong></span>
        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
          {mode === "draw" ? (signaturePng ? "✓ Draw Signature Captured" : "⚠️ Please draw signature on board above") : (typedName.trim() ? "✓ Typed Name Ready" : "⚠️ Enter name")}
        </span>
      </div>
    </div>
  );
}
