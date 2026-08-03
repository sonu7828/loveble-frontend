import { useCallback, useState, useEffect, useRef } from "react";
import { authService } from "@/services/api";

const IDLE_TIMEOUT_MS = 14 * 60 * 1000; // 14 minutes
const COUNTDOWN_SECONDS = 60; // 60 seconds

export function useIdleLogout(enabled: boolean) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use a ref to track if warning is showing to avoid dependency cycle in handleActivity
  const showWarningRef = useRef(showWarning);
  useEffect(() => {
    showWarningRef.current = showWarning;
  }, [showWarning]);

  const handleIdle = useCallback(() => {
    setShowWarning(true);
    setCountdown(COUNTDOWN_SECONDS);
  }, []);

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    // Do not automatically reset if the warning is showing.
    // The user MUST explicitly click "Stay Signed In".
    if (showWarningRef.current) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(handleIdle, IDLE_TIMEOUT_MS);
  }, [enabled, handleIdle]);

  const staySignedIn = useCallback(() => {
    setShowWarning(false);
    setCountdown(COUNTDOWN_SECONDS);
    // Explicitly reset the timer after dismissing the warning
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(handleIdle, IDLE_TIMEOUT_MS);
  }, [handleIdle]);

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      return;
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    // Throttle the event listeners to reduce performance overhead
    let throttleTimeout: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      if (throttleTimeout) return;

      resetTimer();

      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
      }, 1000); // 1 second throttle
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    resetTimer();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (throttleTimeout) clearTimeout(throttleTimeout);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, resetTimer]);

  useEffect(() => {
    if (showWarning) {
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!);

            authService.logout().then(() => {
              window.location.href = "/staff/login?reason=idle";
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [showWarning]);

  return { showWarning, countdown, staySignedIn };
}
