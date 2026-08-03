/**
 * Radiantilyk EMR — useAuth Hook
 * Phase 1A: Cookie-based session management.
 *
 * Calls GET /api/auth/me on mount to establish session from HttpOnly cookies.
 * No localStorage, sessionStorage, or demo tokens.
 * Listens for 'rka_session_expired' events from the API client's 401 interceptor.
 */

import { useEffect, useState, useCallback } from "react";
import { authService, AppRole, UserProfile } from "@/services/api/authService";

export type { AppRole };

export interface AuthState {
  session: any;
  user: UserProfile | null;
  roles: AppRole[];
  staffId: string | null;
  loading: boolean;
  /** Full platform access */
  isAdmin: boolean;
  /** Front Desk / Scheduler — booking, check-in, calendar, POS */
  isFrontDesk: boolean;
  /** Nurse Practitioner — clinical provider */
  isNP: boolean;
  /** Medical Director — supervising physician, cosign */
  isMedicalDirector: boolean;
  /** Privacy & Security Officer — HIPAA compliance */
  isPrivacyOfficer: boolean;
  /** RN / Injector — clinical notes, treatments, cosign submission */
  isRNInjector: boolean;
  /** True for any clinical provider who can be booked (MD, NP, RN/Injector) */
  isProvider: boolean;
  /** True for any role with access to clinical charts */
  isClinicalStaff: boolean;
  /** True for any privileged role */
  isPrivileged: boolean;
  /** Can view all appointments / clients (not scoped to own) */
  canSeeAll: boolean;
  /** Can override scheduling conflicts */
  canOverride: boolean;

  // ── Backwards-compatible aliases ──
  /** @deprecated Use isFrontDesk */
  isScheduler: boolean;
  /** @deprecated Use isFrontDesk */
  isReceptionist: boolean;
  /** @deprecated Use isAdmin || isFrontDesk */
  isStaff: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserSession = useCallback(async () => {
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
    }
  }, []);

  useEffect(() => {
    loadUserSession();

    // Listen for session expiry events from the API client
    const handleSessionExpired = () => {
      setUser(null);
      setRoles([]);
      setStaffId(null);
    };

    window.addEventListener("rka_session_expired", handleSessionExpired);
    return () => {
      window.removeEventListener("rka_session_expired", handleSessionExpired);
    };
  }, [loadUserSession]);

  // ── Core role flags ──
  const isAdmin = roles.includes("admin");
  const isFrontDesk = roles.includes("front_desk") || isAdmin;
  const isNP = roles.includes("nurse_practitioner") || isAdmin;
  const isMedicalDirector = roles.includes("medical_director");
  const isPrivacyOfficer = roles.includes("privacy_officer");
  const isRNInjector = roles.includes("rn_injector");

  // Provider = any clinical role that can perform and be booked for appointments
  const isProvider = isMedicalDirector || isNP || isRNInjector;

  // Clinical staff = any role that can access clinical charts
  const isClinicalStaff = isAdmin || isNP || isMedicalDirector || isRNInjector;

  // Privileged = any authenticated staff role
  const isPrivileged = isAdmin || isNP || isMedicalDirector || isPrivacyOfficer || isRNInjector || isFrontDesk;

  // Can override scheduling conflicts or view all appointments
  const canOverride = isAdmin || isFrontDesk || isNP || isMedicalDirector;
  const canSeeAll = canOverride;

  // ── Backwards-compatible aliases ──
  const isScheduler = isFrontDesk;
  const isReceptionist = isFrontDesk;
  const isStaff = isAdmin || isFrontDesk;

  return {
    session: user ? { user } : null,
    user,
    roles,
    staffId,
    loading,
    isAdmin,
    isFrontDesk,
    isScheduler,
    isReceptionist,
    isStaff,
    isNP,
    isMedicalDirector,
    isPrivacyOfficer,
    isRNInjector,
    isProvider,
    isClinicalStaff,
    isPrivileged,
    canSeeAll,
    canOverride,
  };
}
