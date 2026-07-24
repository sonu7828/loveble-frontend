import { useEffect, useState } from "react";
import { X, Share, Plus } from "lucide-react";

/**
 * Lightweight "Add to Home Screen" nudge.
 * - iOS Safari: shows manual instructions (no beforeinstallprompt event).
 * - Android Chrome / Edge: shows native install button via beforeinstallprompt.
 * - Hidden once installed, dismissed, or running in standalone mode.
 */
type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const STORAGE_KEY = "rka_install_prompt_dismissed_at";
const COOLDOWN_DAYS = 14;

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS
    (window.navigator as unknown as { standalone?: boolean }).standalone === true);

const isIos = () =>
  typeof navigator !== "undefined" &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios|edgios/i.test(navigator.userAgent); // only Safari supports A2HS

const isMobile = () =>
  typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches;

const recentlyDismissed = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return false;
    const ts = Number(v);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  } catch { return false; }
};

const InstallAppPrompt = () => {
  const [show, setShow] = useState(false);
  const [bipEvent, setBipEvent] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || !isMobile() || recentlyDismissed()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setBipEvent(e as BIPEvent);
      // Delay a beat so it doesn't compete with first paint
      setTimeout(() => setShow(true), 1500);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS path — no event, just show after a short delay
    if (isIos()) {
      const t = setTimeout(() => { setIosHint(true); setShow(true); }, 4000);
      return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", onBIP); };
    }

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* noop */ }
    setShow(false);
  };

  const install = async () => {
    if (!bipEvent) return;
    await bipEvent.prompt();
    const { outcome } = await bipEvent.userChoice;
    if (outcome === "accepted" || outcome === "dismissed") dismiss();
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Radiantilyk app"
      className="fixed inset-x-3 bottom-3 z-50 md:hidden rounded-2xl border border-border bg-card/95 backdrop-blur shadow-elegant px-4 py-3 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4"
    >
      <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-tight">Install Radiantilyk</div>
        {iosHint ? (
          <p className="text-xs text-muted-foreground mt-1 leading-snug">
            Tap <Share className="inline h-3 w-3 align-[-1px]" /> Share, then{" "}
            <span className="whitespace-nowrap">
              <Plus className="inline h-3 w-3 align-[-1px]" /> Add to Home Screen
            </span>{" "}
            for a one-tap app experience.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1 leading-snug">
            Add to your home screen for one-tap booking, faster check-ins, and an app-like experience.
          </p>
        )}
        {bipEvent && !iosHint && (
          <button
            onClick={install}
            className="mt-2 inline-flex items-center rounded-full bg-primary text-primary-foreground text-xs px-4 py-1.5 hover:opacity-90"
          >
            Install app
          </button>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="text-muted-foreground hover:text-foreground -mr-1 -mt-1 p-1"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default InstallAppPrompt;
