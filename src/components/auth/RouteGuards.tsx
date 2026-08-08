import React from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth, resolveLandingRoute } from "@/hooks/useAuth";

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { loading, roles, isAdmin } = useAuth();
  if (loading) return <div className="min-h-[40vh] flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!isAdmin) return <Navigate to={resolveLandingRoute(roles)} replace />;
  return <>{children}</>;
}

export function AdminOrDirectorOnly({ children }: { children: React.ReactNode }) {
  const { loading, roles, isAdmin, isMedicalDirector } = useAuth();
  if (loading) return <div className="min-h-[40vh] flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!isAdmin && !isMedicalDirector) return <Navigate to={resolveLandingRoute(roles)} replace />;
  return <>{children}</>;
}

export function AdminOrPrivacyOnly({ children }: { children: React.ReactNode }) {
  const { loading, roles, isAdmin, isPrivacyOfficer } = useAuth();
  if (loading) return <div className="min-h-[40vh] flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!isAdmin && !isPrivacyOfficer) return <Navigate to={resolveLandingRoute(roles)} replace />;
  return <>{children}</>;
}

export function MedicalDirectorOnly({ children }: { children: React.ReactNode }) {
  const { loading, roles } = useAuth();
  if (loading) return <div className="min-h-[40vh] flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!roles.includes("medical_director")) return <Navigate to={resolveLandingRoute(roles)} replace />;
  return <>{children}</>;
}
