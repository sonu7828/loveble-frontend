/**
 * Radiantilyk EMR — Authentication Service
 * Phase 1A: Cookie-based authentication via Node.js/Express backend.
 *
 * All authentication flows go through the REST API.
 * HttpOnly cookies are managed by the browser and backend.
 * No localStorage, sessionStorage, mock data, or demo tokens.
 */
import { ApiClient } from "./client";

// ── Role Types ──

export type AppRole =
  | "admin"
  | "nurse_practitioner"
  | "medical_director"
  | "rn_injector"
  | "privacy_officer"
  | "front_desk";

/** Roles that represent bookable clinical providers */
export const CLINICAL_PROVIDER_ROLES: AppRole[] = [
  "medical_director",
  "nurse_practitioner",
  "rn_injector",
];

/** Check if a role string represents a clinical provider eligible for booking */
export function isClinicalProviderRole(role: string): boolean {
  const r = (role || "").toLowerCase();
  return r === "medical_director" || r === "nurse_practitioner" || r === "rn_injector";
}

/**
 * Normalize legacy role strings to the finalized 6-role set.
 * 'staff' | 'receptionist' | 'scheduler' → 'front_desk'
 * 'provider' | 'injector' → 'rn_injector'
 */
export function normalizeRole(role: string): AppRole {
  const r = (role || "").toLowerCase();
  if (r === "admin") return "admin";
  if (r === "medical_director") return "medical_director";
  if (r === "nurse_practitioner") return "nurse_practitioner";
  if (r === "rn_injector" || r === "provider" || r === "injector") return "rn_injector";
  if (r === "privacy_officer" || r === "security_officer") return "privacy_officer";
  if (r === "front_desk" || r === "receptionist" || r === "scheduler" || r === "staff") return "front_desk";
  return "front_desk"; // safe default for unknown
}

// ── User Profile Types ──

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  roles: AppRole[];
  staff_id?: string;
  created_at?: string;
  email_confirmed_at?: string;
}

export interface AuthSession {
  user: UserProfile;
}

// ── Auth Service ──

export const authService = {
  /**
   * Get current session by calling GET /auth/me.
   * The browser sends the HttpOnly cookie automatically.
   * Returns null if not authenticated.
   */
  async getSession(): Promise<{ session: AuthSession | null; user: UserProfile | null; error: string | null }> {
    try {
      const res = await ApiClient.get<{ success: boolean; data: { user: UserProfile } }>("/auth/me");

      if (res.status === 200 && res.data?.success && res.data?.data?.user) {
        const rawUser = res.data.data.user;
        const user: UserProfile = {
          id: rawUser.id,
          email: rawUser.email,
          first_name: rawUser.first_name,
          last_name: rawUser.last_name,
          roles: (rawUser.roles || []).map((r: string) => normalizeRole(r)),
          staff_id: rawUser.staff_id || rawUser.id,
        };

        return {
          session: { user },
          user,
          error: null,
        };
      }

      return { session: null, user: null, error: null };
    } catch {
      return { session: null, user: null, error: null };
    }
  },

  /**
   * Login with email and password.
   * Backend sets HttpOnly cookies on success.
   * Returns user profile or error message.
   */
  async login(email: string, password?: string): Promise<{
    user: UserProfile | null;
    mfaRequired?: boolean;
    mfaToken?: string;
    error: string | null;
  }> {
    const res = await ApiClient.post<{
      success: boolean;
      data: {
        user?: UserProfile;
        mfaRequired?: boolean;
        mfaToken?: string;
      };
      message?: string;
    }>("/auth/login", { email, password });

    if (res.error) {
      return { user: null, error: res.error };
    }

    if (res.data?.data?.mfaRequired) {
      return {
        user: null,
        mfaRequired: true,
        mfaToken: res.data.data.mfaToken,
        error: null,
      };
    }

    if (res.data?.success && res.data?.data?.user) {
      const rawUser = res.data.data.user;
      const user: UserProfile = {
        id: rawUser.id,
        email: rawUser.email,
        first_name: rawUser.first_name,
        last_name: rawUser.last_name,
        roles: (rawUser.roles || []).map((r: string) => normalizeRole(r)),
        staff_id: rawUser.staff_id || rawUser.id,
      };
      return { user, error: null };
    }

    return { user: null, error: "Login failed" };
  },

  /**
   * Supabase-compatible signInWithPassword wrapper.
   * Used by existing login components.
   */
  async signInWithPassword(params: { email: string; password?: string }) {
    const result = await this.login(params.email, params.password);

    if (result.error) {
      return {
        data: { user: null, session: null },
        error: { message: result.error },
      };
    }

    if (result.mfaRequired) {
      return {
        data: { user: null, session: null, mfaRequired: true, mfaToken: result.mfaToken },
        error: null,
      };
    }

    if (result.user) {
      return {
        data: { user: result.user, session: { user: result.user } },
        error: null,
      };
    }

    return {
      data: { user: null, session: null },
      error: { message: "Invalid email or password. Access denied." },
    };
  },

  /**
   * Logout — calls backend to clear cookies and revoke session.
   */
  async logout(): Promise<void> {
    try {
      await ApiClient.post("/auth/logout");
    } catch {
      // Always succeed client-side even if backend is unreachable
    }
    // Clear any frontend cache
    ApiClient.clearCache();
  },

  /**
   * Alias for logout (Supabase compatibility).
   */
  async signOut(): Promise<void> {
    return this.logout();
  },

  /**
   * Legacy alias for updatePassword
   */
  async updatePassword(newPassword: string): Promise<{ success: boolean; message?: string }> {
    const res = await this.changePassword("", newPassword);
    return { success: res.success, message: res.error || undefined };
  },

  /**
   * Change password for the authenticated user.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error: string | null }> {
    const res = await ApiClient.post("/auth/password/change", {
      currentPassword,
      newPassword,
    });

    if (res.error) {
      return { success: false, error: res.error };
    }

    return { success: true, error: null };
  },

  /**
   * MFA namespace for future MFA integration (Phase 2+).
   * Currently returns stubs for compatibility.
   */
  mfa: {
    async getAuthenticatorAssuranceLevel() {
      return { data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null };
    },
    async listFactors() {
      return { data: { totp: [] }, error: null };
    },
    async challenge(params: { factorId: string }) {
      return { data: { id: `challenge-${params.factorId}` }, error: null };
    },
    async verify(_params: { factorId: string; challengeId: string; code: string }) {
      return { data: null, error: { message: "MFA not yet implemented" } };
    },
    async enroll(_params: { factorType: string; friendlyName?: string }) {
      return { data: null, error: { message: "MFA enrollment not yet implemented" } };
    },
    async unenroll(_params: { factorId: string }) {
      return { data: null, error: { message: "MFA unenrollment not yet implemented" } };
    },
  },
};
