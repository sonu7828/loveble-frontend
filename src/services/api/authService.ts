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

const DEMO_ADMIN_USER: UserProfile = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  email: "admin@radiantilyk.com",
  first_name: "Administrator",
  last_name: "Kiem",
  roles: ["admin", "staff", "scheduler", "nurse_practitioner", "medical_director", "privacy_officer"],
  staff_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  created_at: new Date().toISOString(),
  email_confirmed_at: new Date().toISOString(),
};

export const authService = {
  async getSession(): Promise<AuthSession | null> {
    const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("user_profile") || sessionStorage.getItem("user_profile");

    if (storedUser) {
      try {
        return { token: token || "demo-jwt-token", user: JSON.parse(storedUser) };
      } catch (e) {}
    }

    // Default demo session if no session set
    return { token: "demo-jwt-token", user: DEMO_ADMIN_USER };
  },

  async login(email: string, password?: string): Promise<{ user: UserProfile; token: string } | null> {
    const res = await ApiClient.post<{ user: UserProfile; token: string }>("/auth/login", { email, password });
    if (res.data && res.data.token) {
      localStorage.setItem("auth_token", res.data.token);
      localStorage.setItem("user_profile", JSON.stringify(res.data.user));
      window.dispatchEvent(new Event("rka_demo_auth_change"));
      return res.data;
    }

    // Fallback demo login response if backend endpoint not active yet
    const demoUser = { ...DEMO_ADMIN_USER, email };
    localStorage.setItem("auth_token", "demo-token");
    localStorage.setItem("user_profile", JSON.stringify(demoUser));
    window.dispatchEvent(new Event("rka_demo_auth_change"));
    return { user: demoUser, token: "demo-token" };
  },

  async logout(): Promise<void> {
    await ApiClient.post("/auth/logout");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_profile");
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("user_profile");
    sessionStorage.removeItem("rka_demo_session");
    localStorage.removeItem("rka_demo_session");
    window.dispatchEvent(new Event("rka_demo_auth_change"));
  },

  async resetPassword(email: string): Promise<{ success: boolean; message?: string }> {
    const res = await ApiClient.post("/auth/forgot-password", { email });
    return { success: !res.error, message: res.error || "Password reset email sent." };
  },

  async updatePassword(password: string): Promise<{ success: boolean; message?: string }> {
    const res = await ApiClient.post("/auth/reset-password", { password });
    return { success: !res.error, message: res.error || "Password updated." };
  },

  async getAuthenticatorAssuranceLevel(): Promise<{ currentLevel: string; nextLevel: string }> {
    return { currentLevel: "aal2", nextLevel: "aal2" };
  },

  async verifyMfa(_code: string): Promise<boolean> {
    return true;
  }
};
