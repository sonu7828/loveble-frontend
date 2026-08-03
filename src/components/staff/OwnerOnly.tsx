import React from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth, resolveLandingRoute } from "@/hooks/useAuth";

/** Owner / Admin-only route guard — restricted to server-returned admin/owner role. */
export function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { loading, roles, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Owner permission comes strictly from server-returned role
  if (!isAdmin && !roles.includes("owner")) {
    const landing = resolveLandingRoute(roles);
    return <Navigate to={landing} replace />;
  }

  return <>{children}</>;
}
