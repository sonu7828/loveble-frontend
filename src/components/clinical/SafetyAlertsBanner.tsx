import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import type { SafetyAlert } from "@/lib/interactionAlerts";

export function SafetyAlertsBanner({ alerts }: { alerts: SafetyAlert[] }) {
  if (!alerts?.length) return null;
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <AlertTriangle className="h-4 w-4" />
        Safety alerts — review before signing
      </div>
      <ul className="space-y-1.5">
        {alerts.map((a, i) => {
          const Icon = a.severity === "critical" ? AlertCircle : a.severity === "warning" ? AlertTriangle : Info;
          const tone =
            a.severity === "critical" ? "text-destructive" :
            a.severity === "warning" ? "text-warning-soft-foreground dark:text-warning" :
            "text-muted-foreground";
          return (
            <li key={i} className={`flex items-start gap-2 text-sm ${tone}`}>
              <Icon className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{a.message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
