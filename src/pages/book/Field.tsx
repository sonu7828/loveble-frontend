import { Label } from "@/components/ui/label";

export const Field = ({ label, children, className = "", error, hint }: { label: string; children: React.ReactNode; className?: string; error?: string; hint?: string }) => (
  <div className={className}>
    <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
    <div className="mt-1.5">{children}</div>
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    {!error && hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
  </div>
);
