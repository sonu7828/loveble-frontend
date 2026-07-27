import { Stethoscope } from "lucide-react";
import { toast } from "sonner";

/**
 * Announcement badge for the nurse discount (15% off w/ code NURSE15).
 * Fits compactly in the top-right header or flex row.
 */
export function NurseDiscountBanner({ className = "" }: { className?: string }) {
  const code = "NURSE15";
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Code ${code} copied`);
    } catch {
      toast.info(`Use code ${code} at checkout`);
    }
  }

  return (
    <div className={`inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-background/95 dark:bg-card/90 backdrop-blur px-2.5 py-1 shadow-2xs hover:shadow-xs hover:border-primary/50 text-[11px] text-foreground transition-all duration-200 active:scale-[0.98] group cursor-pointer"
        aria-label="Nurses get 15 percent off your visit. Click to copy code NURSE15."
      >
        <span className="p-0.5 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
          <Stethoscope className="h-3 w-3" />
        </span>
        <span className="font-medium">
          Nurses get 15% off <span className="hidden md:inline">your visit</span>
        </span>
        <span className="text-muted-foreground/60">•</span>
        <span className="text-muted-foreground font-mono text-[10px]">
          Code <span className="font-semibold text-primary">{code}</span>
        </span>
        <span className="text-[9px] text-muted-foreground bg-secondary px-1.5 py-0.2 rounded-full group-hover:text-foreground font-medium">
          Copy
        </span>
      </button>
    </div>
  );
}
