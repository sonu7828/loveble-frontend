import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/** Wrap an admin-only route element. Non-admins are bounced to /staff/today. */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { loading, isAdmin } = useAuth();
  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/staff/today" replace />;
  return <>{children}</>;
}
