import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * HIPAA: auto-logout staff after inactivity.
 * - Idle threshold: 15 minutes
 * - Warning shown at 14 minutes
 * Activity = mouse, keyboard, touch, scroll. Re-arms every interaction.
 */
const IDLE_MS = 15 * 60 * 1000;
const WARN_MS = 14 * 60 * 1000;

export function useIdleLogout(enabled: boolean) {
  const lastActivity = useRef<number>(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const showWarningRef = useRef(false);

  const staySignedIn = useCallback(() => {
    lastActivity.current = Date.now();
    setShowWarning(false);
    showWarningRef.current = false;
    setCountdown(60);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const bump = () => {
      lastActivity.current = Date.now();
      if (showWarningRef.current) {
        setShowWarning(false);
        showWarningRef.current = false;
        setCountdown(60);
      }
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true, capture: true }));

    let isLoggingOut = false;
    const interval = window.setInterval(async () => {
      if (isLoggingOut) return;
      const idle = Date.now() - lastActivity.current;
      
      if (idle >= IDLE_MS) {
        isLoggingOut = true;
        window.clearInterval(interval);
        try { await supabase.auth.signOut(); } catch {}
        window.location.href = "/staff/login?reason=idle";
        return;
      }

      if (idle >= WARN_MS) {
        const remaining = Math.max(0, Math.ceil((IDLE_MS - idle) / 1000));
        if (!showWarningRef.current) {
          setShowWarning(true);
          showWarningRef.current = true;
        }
        setCountdown(remaining);
      } else {
        if (showWarningRef.current) {
          setShowWarning(false);
          showWarningRef.current = false;
        }
      }
    }, 1000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump, { capture: true }));
      window.clearInterval(interval);
    };
  }, [enabled]);

  return { showWarning, countdown, staySignedIn };
}
