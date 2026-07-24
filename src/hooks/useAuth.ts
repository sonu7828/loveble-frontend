import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "staff" | "scheduler" | "nurse_practitioner" | "medical_director" | "receptionist" | "privacy_officer";

export interface AuthState {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  staffId: string | null;
  loading: boolean;
  isAdmin: boolean;
  isScheduler: boolean;
  isReceptionist: boolean;
  isStaff: boolean;
  isNP: boolean;
  isMedicalDirector: boolean;
  isPrivacyOfficer: boolean;
  isClinicalStaff: boolean;
  isPrivileged: boolean; // admin OR provider (staff) OR nurse_practitioner OR medical_director
  canSeeAll: boolean; // admin OR scheduler OR receptionist OR nurse practitioner OR medical_director
  canOverride: boolean; // admin OR scheduler OR receptionist OR nurse practitioner OR medical_director
}

export function setDemoAuthSession(email: string, roles: AppRole[], staffId?: string) {
  const KIEM_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const STAFF_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const targetId = staffId || (roles.includes("admin") ? KIEM_ID : STAFF_ID);
  
  const isClient = roles.length === 0 || email === "user@gmail.com";
  const firstName = isClient ? "Patient" : (roles.includes("admin") ? "Administrator" : "Staff");
  const lastName = isClient ? "User" : (roles.includes("admin") ? "Kiem" : "Member");

  const demoData = {
    user: {
      id: targetId,
      email,
      aud: "authenticated",
      role: "authenticated",
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { first_name: firstName, last_name: lastName },
      created_at: new Date().toISOString(),
    } as User,
    roles,
    staffId: targetId,
  };

  const jsonStr = JSON.stringify(demoData);
  sessionStorage.setItem("rka_demo_session", jsonStr);
  localStorage.setItem("rka_demo_session", jsonStr);
  window.dispatchEvent(new Event("rka_demo_auth_change"));
}

export function clearDemoAuthSession() {
  sessionStorage.removeItem("rka_demo_session");
  localStorage.removeItem("rka_demo_session");
  window.dispatchEvent(new Event("rka_demo_auth_change"));
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDemo = () => {
      const raw = sessionStorage.getItem("rka_demo_session") || localStorage.getItem("rka_demo_session");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setSession({ user: parsed.user, access_token: "demo-token", refresh_token: "demo-refresh" } as Session);
          setRoles(parsed.roles);
          setStaffId(parsed.staffId);
          setLoading(false);
          return true;
        } catch (e) {}
      }
      return false;
    };

    const handleDemoChange = () => {
      if (!checkDemo()) {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          setSession(s);
          if (s?.user) loadProfile(s.user.id);
          else { setRoles([]); setStaffId(null); setLoading(false); }
        });
      }
    };

    window.addEventListener("rka_demo_auth_change", handleDemoChange);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (sessionStorage.getItem("rka_demo_session") || localStorage.getItem("rka_demo_session")) return;
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setRoles([]);
        setStaffId(null);
        setLoading(false);
      }
    });

    if (!checkDemo()) {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (sessionStorage.getItem("rka_demo_session") || localStorage.getItem("rka_demo_session")) return;
        setSession(s);
        if (s?.user) loadProfile(s.user.id);
        else setLoading(false);
      });
    }

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("rka_demo_auth_change", handleDemoChange);
    };
  }, []);

  async function loadProfile(uid: string) {
    const { data: access, error: accessError } = await (supabase as any).rpc("get_my_staff_access");
    if (!accessError && access?.[0]) {
      setRoles((access[0].roles ?? []) as AppRole[]);
      setStaffId(access[0].staff_id ?? null);
      setLoading(false);
      return;
    }

    const [{ data: r }, { data: sp }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("staff_profiles").select("id").eq("user_id", uid).maybeSingle(),
    ]);
    setRoles((r ?? []).map((x) => x.role as AppRole));
    setStaffId(sp?.id ?? null);
    setLoading(false);
  }

  const isAdmin = roles.includes("admin");
  const isScheduler = roles.includes("scheduler");
  const isReceptionist = roles.includes("receptionist");
  const isStaff = roles.includes("staff");
  const isNP = roles.includes("nurse_practitioner");
  const isMedicalDirector = roles.includes("medical_director");
  const isPrivacyOfficer = isAdmin || roles.includes("privacy_officer");
  const isClinicalStaff = isAdmin || isStaff || isScheduler || isNP || isMedicalDirector;
  const isPrivileged = isAdmin || isStaff || isNP || isMedicalDirector || isPrivacyOfficer;
  const canOverride = isAdmin || isScheduler || isReceptionist || isNP || isMedicalDirector;
  const canSeeAll = canOverride || isNP || isMedicalDirector;
  return {
    session,
    user: session?.user ?? null,
    roles,
    staffId,
    loading,
    isAdmin,
    isScheduler,
    isReceptionist,
    isStaff,
    isNP,
    isMedicalDirector,
    isPrivacyOfficer,
    isClinicalStaff,
    isPrivileged,
    canSeeAll,
    canOverride,
  };
}
