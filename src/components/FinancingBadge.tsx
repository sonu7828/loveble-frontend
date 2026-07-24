import { CreditCard } from "lucide-react";

export default function FinancingBadge({ className }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-3 sm:p-4 ${className ?? ""}`}>
      <CreditCard className="h-4 w-4 text-primary shrink-0" />
      <p className="text-xs sm:text-sm text-foreground/85 leading-snug">
        <span className="font-medium">Financing available.</span>{" "}
        <span className="text-muted-foreground">
          Pay over time with{" "}
          <a href="https://withcherry.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Cherry</a>
          {" "}or{" "}
          <a href="https://www.affirm.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Affirm</a>
          {" "}— soft-credit check, no impact on score. Memberships and custom packages also offered.
        </span>
      </p>
    </div>
  );
}
