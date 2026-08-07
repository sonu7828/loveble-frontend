/**
 * Radiantilyk EMR — Authentication Service
 * Phase 1A: Cookie-based authentication via Node.js/Express backend.
 *
 * All authentication flows go through the REST API.
 * HttpOnly cookies are managed by the browser and backend.
 * Includes compatibility wrappers for existing UI components.
 */
import { ApiClient } from "./client";

// ── Role Types ──

export type AppRole =
  | "admin"
  | "nurse_practitioner"
  | "medical_director"
  | "rn_injector"
  | "privacy_officer"
  | "front_desk"
  | "patient"
  | "owner";

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

export interface GetSessionResult {
  data: {
    session: AuthSession | null;
  };
  session: AuthSession | null;
  user: UserProfile | null;
  error: string | null;
}

// ── Auth Service ──

export const authService = {
  /**
   * Get current session by calling GET /auth/me.
   * Returns data object with nested session for backward compatibility.
   */
  async getSession(): Promise<GetSessionResult> {
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

        const session: AuthSession = { user };

        return {
          data: { session },
          session,
          user,
          error: null,
        };
      }

      return { data: { session: null }, session: null, user: null, error: null };
    } catch {
      return { data: { session: null }, session: null, user: null, error: null };
    }
  },

  /**
   * Login with email and password.
   * Backend sets HttpOnly cookies on success.
   */
  async login(email: string, password?: string): Promise<{
    user: UserProfile | null;
    mfaRequired?: boolean;
    mfaToken?: string;
    mustChangePassword?: boolean;
    error: string | null;
  }> {
    const res = await ApiClient.post<{
      success: boolean;
      data: {
        user?: UserProfile;
        mfaRequired?: boolean;
        mfaToken?: string;
        mustChangePassword?: boolean;
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
      return { user, mustChangePassword: !!res.data.data.mustChangePassword, error: null };
    }

    return { user: null, error: "Login failed" };
  },

  /**
   * Supabase-compatible signInWithPassword wrapper.
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

    if (result.mustChangePassword) {
      return {
        data: { user: result.user, session: { user: result.user }, mustChangePassword: true },
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
   * Register new patient user via REST API.
   */
  async signUp(params: { email: string; password?: string; options?: any }) {
    const clean = (params.email || "").trim().toLowerCase();
    const meta = params.options?.data || {};

    const res = await ApiClient.post<{ success: boolean; data: { user: UserProfile } }>("/auth/register", {
      email: clean,
      password: params.password,
      firstName: meta.first_name || meta.firstName,
      lastName: meta.last_name || meta.lastName,
      phone: meta.phone,
    });

    if (res.error) {
      const is409 = res.status === 409 || res.error.includes("409") || res.error.toLowerCase().includes("already exists");
      return {
        data: { user: null, session: null },
        error: { message: is409 ? "An account with this email address already exists. Please sign in instead." : res.error, statusCode: res.status },
      };
    }

    if (res.data?.data?.user) {
      const user = res.data.data.user;
      return {
        data: { user, session: { user } },
        error: null,
      };
    }

    return {
      data: { user: null, session: null },
      error: { message: "Registration failed" },
    };
  },

  /**
   * Stub for OTP sign-in.
   */
  async signInWithOtp(_params?: any) {
    return { data: { user: null }, error: { message: "OTP login not implemented" } };
  },

  /**
   * Top-level getAuthenticatorAssuranceLevel for MFA compatibility.
   */
  async getAuthenticatorAssuranceLevel() {
    return { data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null };
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
    ApiClient.clearCache();
  },

  /**
   * Alias for logout (Supabase compatibility).
   */
  async signOut(): Promise<void> {
    return this.logout();
  },

  /**
   * Request password reset email via POST /auth/forgot-password.
   * Returns generic message to avoid email enumeration.
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string; error: string | null }> {
    const clean = (email || "").trim().toLowerCase();
    const res = await ApiClient.post<{ success: boolean; message: string }>("/auth/forgot-password", { email: clean });
    if (res.error) {
      return { success: false, message: "If an account exists, password reset instructions have been sent.", error: res.error };
    }
    return {
      success: true,
      message: res.data?.message || "If an account exists, password reset instructions have been sent.",
      error: null,
    };
  },

  /**
   * Reset password using token via POST /auth/reset-password.
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string; error: string | null }> {
    const res = await ApiClient.post<{ success: boolean; message: string }>("/auth/reset-password", { token, newPassword });
    if (res.error) {
      return { success: false, message: "", error: res.error };
    }
    return {
      success: true,
      message: res.data?.message || "Password updated successfully.",
      error: null,
    };
  },

  /**
   * Compatibility alias for requestPasswordReset (Supabase legacy signature).
   */
  async resetPasswordForEmail(email: string, _options?: any): Promise<{ data: any; error: { message: string } | null }> {
    const res = await this.requestPasswordReset(email);
    return { data: res.success ? {} : null, error: res.error ? { message: res.error } : null };
  },

  /**
   * Compatibility listener for auth state changes.
   */
  onAuthStateChange(_callback: (event: string) => void) {
    return { data: { subscription: { unsubscribe: () => {} } } };
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
   * MFA namespace for MFA integration.
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
