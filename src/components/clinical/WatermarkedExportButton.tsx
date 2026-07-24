// Renders a watermarked side-by-side before/after PNG and triggers download.
// Requires patient photo consent + the photo to be marked is_shared_with_patient.
// Uses 2D canvas so no external deps. Loads images via signed URLs already fetched.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  beforeUrl: string;
  afterUrl: string;
  clientName: string;
  weeksBetween?: number | null;
  disabled?: boolean;
  disabledReason?: string;
};

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function WatermarkedExportButton({ beforeUrl, afterUrl, clientName, weeksBetween, disabled, disabledReason }: Props) {
  const [busy, setBusy] = useState(false);

  async function exportPng() {
    setBusy(true);
    try {
      const [a, b] = await Promise.all([load(beforeUrl), load(afterUrl)]);
      const h = 1200;
      const aw = Math.round((a.width / a.height) * h);
      const bw = Math.round((b.width / b.height) * h);
      const pad = 40;
      const footer = 120;
      const w = aw + bw + pad * 3;
      const totalH = h + pad * 2 + footer;
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = totalH;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#0b0b0b";
      ctx.fillRect(0, 0, w, totalH);
      ctx.drawImage(a, pad, pad, aw, h);
      ctx.drawImage(b, pad * 2 + aw, pad, bw, h);

      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "600 28px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("BEFORE", pad + 16, pad + 40);
      ctx.fillText("AFTER", pad * 2 + aw + 16, pad + 40);

      // Footer block
      ctx.fillStyle = "#111";
      ctx.fillRect(0, h + pad * 2, w, footer);
      ctx.fillStyle = "#fff";
      ctx.font = "500 22px ui-serif, Cormorant, Georgia, serif";
      ctx.fillText(`Radiantilyk Aesthetic · ${clientName}`, pad, h + pad * 2 + 50);
      ctx.font = "400 16px ui-sans-serif, system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      const sub = `${new Date().toLocaleDateString()}${weeksBetween ? ` · ${weeksBetween} weeks between` : ""} · Shared with patient consent`;
      ctx.fillText(sub, pad, h + pad * 2 + 82);

      // Diagonal subtle watermark
      ctx.save();
      ctx.translate(w / 2, totalH / 2);
      ctx.rotate(-Math.PI / 8);
      ctx.globalAlpha = 0.06;
      ctx.font = "700 180px ui-serif, Cormorant, Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.fillText("RADIANTILYK", 0, 0);
      ctx.restore();

      canvas.toBlob((blob) => {
        if (!blob) { toast.error("Export failed"); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${clientName.replace(/\s+/g, "_")}_before_after.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }, "image/png");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not load images");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button" variant="outline" size="sm"
      onClick={exportPng}
      disabled={disabled || busy}
      title={disabled ? disabledReason : "Download watermarked before/after"}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
      Export
    </Button>
  );
}
