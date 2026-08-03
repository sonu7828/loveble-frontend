import React from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth, resolveLandingRoute } from "@/hooks/useAuth";

/** Wrap an admin-only route element. Non-admins are routed to their authorized landing page. */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { loading, roles, isAdmin, isMedicalDirector } = useAuth();
  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin && !isMedicalDirector) {
    const landing = resolveLandingRoute(roles);
    return <Navigate to={landing} replace />;
  }
  return <>{children}</>;
}
