import { useEffect, useState } from "react";
import { authService, UserProfile } from "@/services/api/authService";

export interface ClientAuthState {
  session: any;
  user: UserProfile | null;
  loading: boolean;
  emailVerified: boolean;
}

export async function getClientSession(): Promise<any> {
  const session = await authService.getSession();
  return session ? { user: session.user } : null;
}

export function useClientAuth(): ClientAuthState {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClientSession() {
      const session = await authService.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    }

    loadClientSession();

    const handleAuthChange = () => {
      loadClientSession();
    };

    window.addEventListener("rka_demo_auth_change", handleAuthChange);
    return () => {
      window.removeEventListener("rka_demo_auth_change", handleAuthChange);
    };
  }, []);

  return {
    session: user ? { user } : null,
    user,
    loading,
    emailVerified: true,
  };
}
