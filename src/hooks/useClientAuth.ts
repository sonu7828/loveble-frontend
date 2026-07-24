import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export interface ClientAuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  emailVerified: boolean;
}

export async function getClientSession(): Promise<Session | null> {
  const raw = sessionStorage.getItem("rka_demo_session") || localStorage.getItem("rka_demo_session");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const isStaffOrAdmin = Array.isArray(parsed.roles) && parsed.roles.length > 0;
      if (!isStaffOrAdmin) {
        return { user: parsed.user, access_token: "demo-token", refresh_token: "demo-refresh" } as Session;
      }
    } catch (e) {}
  }
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function useClientAuth(): ClientAuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDemo = () => {
      const raw = sessionStorage.getItem("rka_demo_session") || localStorage.getItem("rka_demo_session");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const isStaffOrAdmin = Array.isArray(parsed.roles) && parsed.roles.length > 0;
          if (!isStaffOrAdmin) {
            setSession({ user: parsed.user, access_token: "demo-token", refresh_token: "demo-refresh" } as Session);
            setLoading(false);
            return true;
          }
        } catch (e) {}
      }
      return false;
    };

    const handleDemoChange = () => {
      if (!checkDemo()) {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          setSession(s);
          setLoading(false);
        });
      }
    };

    window.addEventListener("rka_demo_auth_change", handleDemoChange);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => {
      const raw = sessionStorage.getItem("rka_demo_session") || localStorage.getItem("rka_demo_session");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (!parsed.roles || parsed.roles.length === 0) return;
        } catch (e) {}
      }
      setSession(s);
      setLoading(false);
    });

    if (!checkDemo()) {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s);
        setLoading(false);
      });
    }

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("rka_demo_auth_change", handleDemoChange);
    };
  }, []);

  return {
    session,
    user: session?.user ?? null,
    loading,
    emailVerified: !!session?.user?.email_confirmed_at,
  };
}
