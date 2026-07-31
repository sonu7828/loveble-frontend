import { useEffect, useState } from "react";
import { authService, AppRole, UserProfile, getUserProfileByEmail } from "@/services/api/authService";

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
  // These map to the new role structure so existing code doesn't break.
  /** @deprecated Use isFrontDesk */
  isScheduler: boolean;
  /** @deprecated Use isFrontDesk */
  isReceptionist: boolean;
  /** @deprecated Use isAdmin || isFrontDesk */
  isStaff: boolean;
}

export function setDemoAuthSession(email: string, roles: AppRole[], staffId?: string) {
  const user = getUserProfileByEmail(email);
  if (roles && roles.length > 0) {
    user.roles = roles;
  }
  sessionStorage.setItem("auth_token", "demo-token");
  sessionStorage.setItem("user_profile", JSON.stringify(user));
  localStorage.setItem("auth_token", "demo-token");
  localStorage.setItem("user_profile", JSON.stringify(user));
  window.dispatchEvent(new Event("rka_demo_auth_change"));
}

export function clearDemoAuthSession() {
  authService.logout();
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUserSession() {
      const session = await authService.getSession();
      const deletedEmails: string[] = JSON.parse(localStorage.getItem("rka_deleted_staff_emails") || "[]");
      const userEmail = (session?.user?.email || "").toLowerCase();

      if (session && session.user && !deletedEmails.includes(userEmail)) {
        setUser(session.user);
        setRoles(session.user.roles || ["admin"]);
        setStaffId(session.user.staff_id || session.user.id);
      } else {
        if (session && session.user && deletedEmails.includes(userEmail)) {
          authService.logout();
        }
        setUser(null);
        setRoles([]);
        setStaffId(null);
      }
      setLoading(false);
    }

    loadUserSession();

    const handleAuthChange = () => {
      loadUserSession();
    };

    window.addEventListener("rka_demo_auth_change", handleAuthChange);
    return () => {
      window.removeEventListener("rka_demo_auth_change", handleAuthChange);
    };
  }, []);

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
