/**
 * Radiantilyk EMR — AuthContext & AuthProvider
 * Phase 1B: Centralized In-Memory Session & Role State.
 *
 * Requirements & Mandatory Corrections:
 * 1. Calls GET /api/v1/auth/me on app startup (deduplicated via inFlightRef for React StrictMode).
 * 2. Stores user and roles ONLY in React memory (useState). NO localStorage / sessionStorage.
 * 3. Does not render protected routes before initial loading completes (prevents content flashes).
 * 4. Listens for 'rka_session_expired' event from API client.
 * 5. Context-aware redirection:
 *    - /staff/* path → redirect to /staff/login
 *    - /account/* path → redirect to /account/auth
 * 6. Multi-tab sync via BroadcastChannel('rka_auth_channel'): broadcasts LOGOUT and SESSION_EXPIRED (NO PII/tokens).
 * 7. Role normalization & exact landing route resolver:
 *    - admin → /staff/admin
 *    - nurse_practitioner, medical_director, rn_injector, front_desk → /staff/today
 *    - privacy_officer → /staff/security-officer
 *    - patient → /account
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { authService, AppRole, UserProfile } from "@/services/api/authService";
import { toast } from "sonner";

export type { AppRole };

export interface AuthContextType {
  session: { user: UserProfile } | null;
  user: UserProfile | null;
  roles: AppRole[];
  staffId: string | null;
  loading: boolean;
  isAuthenticated: boolean;

  // Role Helpers
  isAdmin: boolean;
  isFrontDesk: boolean;
  isNP: boolean;
  isMedicalDirector: boolean;
  isPrivacyOfficer: boolean;
  isRNInjector: boolean;
  isPatient: boolean;
  isProvider: boolean;
  isClinicalStaff: boolean;
  isPrivileged: boolean;
  canSeeAll: boolean;
  canOverride: boolean;

  // Aliases for compatibility
  isScheduler: boolean;
  isReceptionist: boolean;
  isStaff: boolean;

  // Actions
  login: (credentials: any) => Promise<any>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_CHANNEL = "rka_auth_channel";

export function resolveLandingRoute(roles: AppRole[]): string {
  if (roles.includes("admin")) return "/staff/admin";
  if (roles.includes("privacy_officer")) return "/staff/security-officer";
  if (
    roles.includes("nurse_practitioner") ||
    roles.includes("medical_director") ||
    roles.includes("rn_injector") ||
    roles.includes("front_desk")
  ) {
    return "/staff/today";
  }
  if (roles.includes("patient")) return "/account";
  return "/staff/today";
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInFlightRef = useRef<boolean>(false);
  const toastInFlightRef = useRef<boolean>(false);
  const logoutInFlightRef = useRef<boolean>(false);

  const refreshCurrentUser = useCallback(async () => {
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;

    try {
      const result = await authService.getSession();
      if (result.session && result.user) {
        setUser(result.user);
        setRoles(result.user.roles || []);
        setStaffId(result.user.staff_id || result.user.id);
      } else {
        setUser(null);
        setRoles([]);
        setStaffId(null);
      }
    } catch {
      setUser(null);
      setRoles([]);
      setStaffId(null);
    } finally {
      setLoading(false);
      fetchInFlightRef.current = false;
    }
  }, []);

  const login = useCallback(async (credentials: any) => {
    setLoading(true);
    try {
      const result = await authService.login(credentials);
      if (result.user) {
        setUser(result.user);
        setRoles(result.user.roles || []);
        setStaffId(result.user.staff_id || result.user.id);
      } else {
        await refreshCurrentUser();
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, [refreshCurrentUser]);

  const logout = useCallback(async () => {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;

    try {
      await authService.logout();
    } catch {
      // Ignore logout API errors
    } finally {
      setUser(null);
      setRoles([]);
      setStaffId(null);
      logoutInFlightRef.current = false;

      // Broadcast logout to other open tabs
      try {
        const bc = new BroadcastChannel(AUTH_CHANNEL);
        bc.postMessage({ type: "LOGOUT", time: Date.now() });
        bc.close();
      } catch {
        // BroadcastChannel fallback ignore
      }
    }
  }, []);

  // Initial load on startup
  useEffect(() => {
    refreshCurrentUser();
  }, [refreshCurrentUser]);

  // Session Expired Event Listener (from client.ts 401 interceptor)
  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      setUser(null);
      setRoles([]);
      setStaffId(null);

      if (!toastInFlightRef.current) {
        toastInFlightRef.current = true;
        const currentPath = window.location.pathname;
        if (currentPath.includes("/staff/login") || currentPath.includes("/account/auth")) {
          return;
        }

        // Context-aware redirection & toast message
        if (currentPath.startsWith("/staff")) {
          toast.error("Your staff session has expired. Please sign in again.");
          window.location.href = "/staff/login";
        } else if (currentPath.startsWith("/account")) {
          toast.error("Your session has expired. Please sign in again.");
          window.location.href = "/account/auth";
        }

        setTimeout(() => {
          toastInFlightRef.current = false;
        }, 3000);
      }
    };

    window.addEventListener("rka_session_expired", handleSessionExpired);
    return () => {
      window.removeEventListener("rka_session_expired", handleSessionExpired);
    };
  }, []);

  // Multi-Tab Synchronization via BroadcastChannel
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(AUTH_CHANNEL);
      bc.onmessage = (event) => {
        if (event.data?.type === "LOGOUT" || event.data?.type === "SESSION_EXPIRED") {
          setUser(null);
          setRoles([]);
          setStaffId(null);

          const currentPath = window.location.pathname;
          if (currentPath.startsWith("/staff") && !currentPath.includes("/staff/login")) {
            window.location.href = "/staff/login";
          } else if (currentPath.startsWith("/account") && !currentPath.includes("/account/auth")) {
            window.location.href = "/account/auth";
          }
        }
      };
    } catch {
      // Ignore if BroadcastChannel not supported
    }

    return () => {
      if (bc) bc.close();
    };
  }, []);

  // Core Role Flags
  const isAdmin = roles.includes("admin");
  const isFrontDesk = roles.includes("front_desk") || isAdmin;
  const isNP = roles.includes("nurse_practitioner") || isAdmin;
  const isMedicalDirector = roles.includes("medical_director");
  const isPrivacyOfficer = roles.includes("privacy_officer");
  const isRNInjector = roles.includes("rn_injector");
  const isPatient = roles.includes("patient");

  const isProvider = isMedicalDirector || isNP || isRNInjector;
  const isClinicalStaff = isAdmin || isNP || isMedicalDirector || isRNInjector;
  const isPrivileged = isAdmin || isNP || isMedicalDirector || isPrivacyOfficer || isRNInjector || isFrontDesk;

  const canOverride = isAdmin || isFrontDesk || isNP || isMedicalDirector;
  const canSeeAll = canOverride;

  const isScheduler = isFrontDesk;
  const isReceptionist = isFrontDesk;
  const isStaff = isAdmin || isFrontDesk;

  const isAuthenticated = !!user;

  const contextValue: AuthContextType = {
    session: user ? { user } : null,
    user,
    roles,
    staffId,
    loading,
    isAuthenticated,
    isAdmin,
    isFrontDesk,
    isNP,
    isMedicalDirector,
    isPrivacyOfficer,
    isRNInjector,
    isPatient,
    isProvider,
    isClinicalStaff,
    isPrivileged,
    canSeeAll,
    canOverride,
    isScheduler,
    isReceptionist,
    isStaff,
    login,
    logout,
    refreshCurrentUser,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
