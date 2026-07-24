// Small status pill for the chart editor: shows online/offline state plus
// the last local-autosave timestamp. Reassures providers that work isn't lost
// if the iPad drops Wi-Fi mid-visit.
import { useEffect, useState } from "react";
import { Cloud, CloudOff, Check } from "lucide-react";

interface Props {
  savedAt: Date | null;
  className?: string;
}

function timeAgo(d: Date): string {
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function OfflineSaveBadge({ savedAt, className = "" }: Props) {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  // Re-render every 20s so "Xs ago" stays accurate without spamming.
  const [, force] = useState(0);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const t = window.setInterval(() => force((n) => n + 1), 20000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.clearInterval(t);
    };
  }, []);

  if (!online) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning-soft text-warning-soft-foreground px-2.5 py-1 text-[11px] font-medium ${className}`}
        title={savedAt ? `Last local save: ${savedAt.toLocaleTimeString()}` : "Offline"}
      >
        <CloudOff className="h-3 w-3" />
        {savedAt ? `Saved locally · will sync` : "Offline — will sync when back online"}
      </span>
    );
  }

  if (!savedAt) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 text-muted-foreground px-2.5 py-1 text-[11px] ${className}`}
      >
        <Cloud className="h-3 w-3" />
        Online · autosave on
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-soft text-success-soft-foreground px-2.5 py-1 text-[11px] font-medium ${className}`}
      title={`Last autosave: ${savedAt.toLocaleTimeString()}`}
    >
      <Check className="h-3 w-3" />
      Autosaved {timeAgo(savedAt)}
    </span>
  );
}
