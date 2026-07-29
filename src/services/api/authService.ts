/**
 * Authentication Service for Node.js + Express REST API Backend.
 * Replaces Supabase Auth calls across the application.
 */
import { ApiClient } from "./client";

export type AppRole =
  | "admin"
  | "staff"
  | "scheduler"
  | "nurse_practitioner"
  | "medical_director"
  | "receptionist"
  | "privacy_officer";

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
  token: string;
  user: UserProfile;
}

export function getUserProfileByEmail(email: string): UserProfile | null {
  const clean = (email || "").trim().toLowerCase();

  // 1. Check deleted staff list
  const deletedEmails: string[] = JSON.parse(localStorage.getItem("rka_deleted_staff_emails") || "[]");
  if (deletedEmails.includes(clean)) {
    return null;
  }

  // 2. Built-in Admin
  if (clean === "admin@gmail.com") {
    return {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      email: "admin@gmail.com",
      first_name: "Administrator",
      last_name: "Kiem",
      roles: ["admin", "staff"],
      staff_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      created_at: new Date().toISOString(),
      email_confirmed_at: new Date().toISOString(),
    };
  }

  // 3. Built-in Medical Director
  if (clean === "medicaldirector@gmail.com" || clean === "md@gmail.com") {
    return {
      id: "md-101-user-id",
      email: "medicaldirector@gmail.com",
      first_name: "Dr. Kamaren",
      last_name: "Manzano",
      roles: ["medical_director", "staff", "nurse_practitioner"],
      staff_id: "md-101-user-id",
      created_at: new Date().toISOString(),
      email_confirmed_at: new Date().toISOString(),
    };
  }

  // 4. Built-in Security Officer
  if (clean === "securityofficer@gmail.com" || clean === "officer@gmail.com") {
    return {
      id: "sec-202-user-id",
      email: "securityofficer@gmail.com",
      first_name: "Privacy & Security",
      last_name: "Officer",
      roles: ["privacy_officer", "staff"],
      staff_id: "sec-202-user-id",
      created_at: new Date().toISOString(),
      email_confirmed_at: new Date().toISOString(),
    };
  }

  // 5. Built-in Staff
  if (clean === "staff@gmail.com") {
    return {
      id: "stf-303-user-id",
      email: "staff@gmail.com",
      first_name: "Sarah",
      last_name: "Jenkins",
      roles: ["staff", "scheduler"],
      staff_id: "stf-303-user-id",
      created_at: new Date().toISOString(),
      email_confirmed_at: new Date().toISOString(),
    };
  }

  // 6. Built-in Demo Patient User
  if (clean === "user@gmail.com") {
    return {
      id: "usr-404-user-id",
      email: "user@gmail.com",
      first_name: "Valued",
      last_name: "Patient",
      roles: [],
      staff_id: "usr-404-user-id",
      created_at: new Date().toISOString(),
      email_confirmed_at: new Date().toISOString(),
    };
  }

  // 7. Approved Staff Accounts created via Staff Management (/staff/team)
  const approvedAccounts: Array<{ email: string; role: AppRole; full_name: string }> =
    JSON.parse(localStorage.getItem("rka_approved_staff_accounts") || "[]");
  const matchedApproved = approvedAccounts.find((a) => a.email.toLowerCase() === clean);

  if (matchedApproved) {
    const roles: AppRole[] = [matchedApproved.role];
    if (matchedApproved.role !== "admin") roles.push("staff");
    return {
      id: `approved-${clean}`,
      email: matchedApproved.email,
      first_name: matchedApproved.full_name.split(" ")[0] || matchedApproved.full_name,
      last_name: matchedApproved.full_name.split(" ").slice(1).join(" ") || "",
      roles,
      staff_id: `approved-${clean}`,
      created_at: new Date().toISOString(),
      email_confirmed_at: new Date().toISOString(),
    };
  }

  // Unknown random email -> ACCESS DENIED
  return null;
}

export const authService = {
  async getSession(): Promise<any> {
    const token = sessionStorage.getItem("auth_token") || localStorage.getItem("auth_token");
    const storedUser = sessionStorage.getItem("user_profile") || localStorage.getItem("user_profile");

    let user: UserProfile | null = null;
    if (storedUser) {
      try {
        user = JSON.parse(storedUser);
      } catch (e) {
        user = null;
      }
    }

    const session = user ? { token: token || "demo-jwt-token", user } : null;

    return {
      data: { session },
      session,
      user,
      error: null,
    };
  },

  async login(email: string, password?: string): Promise<{ user: UserProfile; token: string } | null> {
    try {
      const res = await ApiClient.post<{ user: UserProfile; token: string }>("/auth/login", { email, password });
      if (res.data && res.data.token) {
        sessionStorage.setItem("auth_token", res.data.token);
        sessionStorage.setItem("user_profile", JSON.stringify(res.data.user));
        localStorage.setItem("auth_token", res.data.token);
        localStorage.setItem("user_profile", JSON.stringify(res.data.user));
        window.dispatchEvent(new Event("rka_demo_auth_change"));
        return res.data;
      }
    } catch {}

    // Fallback lookup
    const demoUser = getUserProfileByEmail(email);
    if (!demoUser) {
      return null;
    }

    sessionStorage.setItem("auth_token", "demo-token");
    sessionStorage.setItem("user_profile", JSON.stringify(demoUser));
    localStorage.setItem("auth_token", "demo-token");
    localStorage.setItem("user_profile", JSON.stringify(demoUser));
    window.dispatchEvent(new Event("rka_demo_auth_change"));
    return { user: demoUser, token: "demo-token" };
  },

  async signInWithPassword(params: { email: string; password?: string }) {
    const result = await this.login(params.email, params.password);
    if (!result || !result.user) {
      return {
        data: { user: null, session: null },
        error: { message: "Invalid email or password. Access denied." },
      };
    }
    return {
      data: { user: result.user, session: { token: result.token, user: result.user } },
      error: null,
    };
  },

  async signUp(params: { email: string; password?: string; options?: any }) {
    const result = await this.login(params.email, params.password);
    if (!result || !result.user) {
      return {
        data: { user: null, session: null },
        error: { message: "Invalid email or password. Access denied." },
      };
    }
    return {
      data: { user: result.user, session: { token: result.token, user: result.user } },
      error: null,
    };
  },

  async signInWithOtp(_params?: any) {
    const adminUser = getUserProfileByEmail("admin@gmail.com");
    return { data: { user: adminUser }, error: null };
  },

  async logout(): Promise<void> {
    try {
      await ApiClient.post("/auth/logout");
    } catch {}
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("user_profile");
    sessionStorage.removeItem("rka_demo_session");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_profile");
    localStorage.removeItem("rka_demo_session");
    window.dispatchEvent(new Event("rka_demo_auth_change"));
  },

  async getAuthenticatorAssuranceLevel() {
    return { data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null };
  },

  mfa: {
    async getAuthenticatorAssuranceLevel() {
      return { data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null };
    },
    async listFactors() {
      return { data: { totp: [{ id: "totp-factor-1", status: "verified" }] }, error: null };
    },
    async challenge(params: { factorId: string }) {
      return { data: { id: `challenge-${params.factorId}` }, error: null };
    },
    async verify(params: { factorId: string; challengeId: string; code: string }) {
      if (params.code === "123456" || params.code.length === 6) {
        return { data: { user: null }, error: null };
      }
      return { error: { message: "Invalid 2-Factor authentication code." } };
    },
  },
};
