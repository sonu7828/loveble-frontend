// Tap-to-scan barcode using the native BarcodeDetector API (Chrome / Android, Safari iOS 17+).
// Falls back gracefully on unsupported browsers (button is hidden).
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScanLine, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  onScan: (text: string) => void;
  /** Optional: also called with a parsed YYYY-MM-DD expiration if the barcode is a GS1 DataMatrix containing AI 17. */
  onExpiration?: (isoDate: string) => void;
  label?: string;
  className?: string;
};

// Best-effort GS1 (AI 17 = exp YYMMDD, AI 10 = lot) parse
function parseGs1(payload: string): { lot?: string; exp?: string } {
  const cleaned = payload.replace(/^\]d2|\u001d/g, "");
  const out: { lot?: string; exp?: string } = {};
  const expM = cleaned.match(/17(\d{6})/);
  if (expM) {
    const yy = expM[1].slice(0, 2);
    const mm = expM[1].slice(2, 4);
    const dd = expM[1].slice(4, 6) === "00" ? "01" : expM[1].slice(4, 6);
    out.exp = `20${yy}-${mm}-${dd}`;
  }
  const lotM = cleaned.match(/10([A-Za-z0-9-]+?)(?:1[7]\d{6}|$)/);
  if (lotM) out.lot = lotM[1];
  return out;
}

export function BarcodeScannerButton({ onScan, onExpiration, label = "Scan", className }: Props) {
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open || !supported) return;
    let cancelled = false;
    setStarting(true);
    (async () => {
      try {
        // @ts-expect-error -- experimental browser API
        const detector = new window.BarcodeDetector({
          formats: ["data_matrix", "code_128", "code_39", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e", "itf"],
        });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setStarting(false);

        const loop = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes && codes.length > 0) {
              const raw = String(codes[0].rawValue ?? "").trim();
              if (raw) {
                const parsed = parseGs1(raw);
                onScan(parsed.lot ?? raw);
                if (parsed.exp && onExpiration) onExpiration(parsed.exp);
                if ("vibrate" in navigator) navigator.vibrate?.(60);
                toast.success(parsed.lot ? `Lot ${parsed.lot}${parsed.exp ? ` · exp ${parsed.exp}` : ""}` : `Scanned: ${raw}`);
                setOpen(false);
                return;
              }
            }
          } catch { /* keep scanning */ }
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (e: any) {
        toast.error(e?.message ?? "Camera unavailable");
        setOpen(false);
        setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [open, supported, onScan, onExpiration]);

  if (!supported) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "h-9 px-2 rounded-md border border-input hover:bg-muted inline-flex items-center gap-1 text-xs"
        }
        title="Scan barcode (GS1 DataMatrix supported)"
      >
        <ScanLine className="h-3.5 w-3.5" />
        {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="text-sm">Aim at the barcode</DialogTitle>
          </DialogHeader>
          <div className="relative bg-black aspect-[3/4] mt-2">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-32 border-2 border-success rounded-md pointer-events-none" />
            {starting && (
              <div className="absolute inset-0 grid place-items-center text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
          <div className="p-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
