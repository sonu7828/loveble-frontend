import { Stethoscope } from "lucide-react";
import { toast } from "sonner";

/**
 * Floating compact announcement badge for the nurse discount (15% off w/ code NURSE15).
 * Fits compactly near the top header without acting as a full block tile.
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
    <div className={`flex justify-center w-full ${className}`}>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/95 dark:bg-card/90 backdrop-blur px-3.5 py-1.5 shadow-xs hover:shadow-md hover:border-primary/50 text-xs text-foreground transition-all duration-200 active:scale-[0.98] group"
        aria-label="Nurses get 15 percent off your visit. Click to copy code NURSE15."
      >
        <span className="p-1 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
          <Stethoscope className="h-3.5 w-3.5" />
        </span>
        <span className="font-medium">
          Nurses get 15% off <span className="hidden sm:inline">your visit</span>
        </span>
        <span className="text-muted-foreground/60">•</span>
        <span className="text-muted-foreground">
          Code <span className="font-mono font-semibold text-primary">{code}</span>
        </span>
        <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full group-hover:text-foreground">
          Copy
        </span>
      </button>
    </div>
  );
}
