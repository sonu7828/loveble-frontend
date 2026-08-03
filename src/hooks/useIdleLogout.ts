/**
 * Radiantilyk EMR — useIdleLogout Hook
 * Phase 1B: Staff Idle-Session Management & Auto-Logout.
 *
 * Requirements & Mandatory Corrections:
 * 1. 15-minute (900s) inactivity timeout for staff/admin portals.
 * 2. Warning shown 60 seconds before logout (at 14 minutes / 840s).
 * 3. Robust activity tracking in React memory (lastActivityTimeRef), recalculated on visibilitychange/focus/tab-restoration.
 * 4. Throttled activity handlers (mousemove, keydown, click, scroll, touchstart).
 * 5. 'Stay signed in' validates server session via GET /api/v1/auth/me before resetting warning.
 * 6. On timeout: calls real authService.logout(), broadcasts logout, dispatches session-expired event, navigates to /staff/login.
 * 7. Applies ONLY to staff/admin portals when enabled (user is logged in).
 * 8. NO timestamp storage in localStorage or sessionStorage.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "@/services/api/authService";
import { toast } from "sonner";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes = 900,000 ms
const WARNING_THRESHOLD_MS = 14 * 60 * 1000; // 14 minutes = 840,000 ms
const THROTTLE_MS = 2000; // Throttle activity updates to once every 2s

export function useIdleLogout(enabled: boolean) {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const lastActivityTimeRef = useRef<number>(Date.now());
  const lastThrottleTimeRef = useRef<number>(0);
  const isLoggingOutRef = useRef<boolean>(false);
  const warningActiveRef = useRef<boolean>(false);

  // Keep warningActiveRef in sync with showWarning
  useEffect(() => {
    warningActiveRef.current = showWarning;
  }, [showWarning]);

  const performIdleLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setShowWarning(false);

    try {
      await authService.logout();
    } catch {
      // Ignore logout errors
    } finally {
      // Broadcast logout to other tabs
      try {
        const bc = new BroadcastChannel("rka_auth_channel");
        bc.postMessage({ type: "LOGOUT", context: "staff", reason: "IDLE_TIMEOUT" });
        bc.close();
      } catch {
        // Fallback if BroadcastChannel not supported
      }

      // Dispatch local session expired event
      window.dispatchEvent(
        new CustomEvent("rka_session_expired", {
          detail: { context: "staff", reason: "IDLE_TIMEOUT" },
        })
      );

      toast.error("Session timed out due to 15 minutes of inactivity. Please sign in again.");
      navigate("/staff/login", { replace: true });
    }
  }, [navigate]);

  const staySignedIn = useCallback(async () => {
    try {
      // Validate server session via GET /api/v1/auth/me before resetting
      const sessionResult = await authService.getSession();
      if (sessionResult.session && sessionResult.user) {
        lastActivityTimeRef.current = Date.now();
        setShowWarning(false);
        setCountdown(60);
        isLoggingOutRef.current = false;
        toast.success("Session extended. You remain signed in.");
      } else {
        performIdleLogout();
      }
    } catch {
      performIdleLogout();
    }
  }, [performIdleLogout]);

  useEffect(() => {
    if (!enabled) {
      setShowWarning(false);
      return;
    }

    lastActivityTimeRef.current = Date.now();
    isLoggingOutRef.current = false;

    // Activity event handler with throttling
    const handleUserActivity = () => {
      const now = Date.now();
      // If warning modal is active, passive mouse movements do NOT reset the timer
      if (warningActiveRef.current) return;

      if (now - lastThrottleTimeRef.current > THROTTLE_MS) {
        lastThrottleTimeRef.current = now;
        lastActivityTimeRef.current = now;
      }
    };

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    activityEvents.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Ticker check every 1000ms
    const timer = setInterval(() => {
      if (isLoggingOutRef.current) return;

      const elapsed = Date.now() - lastActivityTimeRef.current;

      if (elapsed >= IDLE_TIMEOUT_MS) {
        performIdleLogout();
      } else if (elapsed >= WARNING_THRESHOLD_MS) {
        const remaining = Math.max(0, Math.ceil((IDLE_TIMEOUT_MS - elapsed) / 1000));
        setShowWarning(true);
        setCountdown(remaining);
      } else {
        if (warningActiveRef.current) {
          setShowWarning(false);
          setCountdown(60);
        }
      }
    }, 1000);

    // Recalculate elapsed idle time on tab focus or computer sleep wake-up
    const handleVisibilityOrFocusChange = () => {
      if (document.visibilityState === "visible" && !isLoggingOutRef.current) {
        const elapsed = Date.now() - lastActivityTimeRef.current;
        if (elapsed >= IDLE_TIMEOUT_MS) {
          performIdleLogout();
        } else if (elapsed >= WARNING_THRESHOLD_MS) {
          const remaining = Math.max(0, Math.ceil((IDLE_TIMEOUT_MS - elapsed) / 1000));
          setShowWarning(true);
          setCountdown(remaining);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocusChange);
    window.addEventListener("focus", handleVisibilityOrFocusChange);

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      document.removeEventListener("visibilitychange", handleVisibilityOrFocusChange);
      window.removeEventListener("focus", handleVisibilityOrFocusChange);
      clearInterval(timer);
    };
  }, [enabled, performIdleLogout]);

  return { showWarning, countdown, staySignedIn };
}
