import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/** Owner-only route guard — restricted to Kiem Vukadinovic. */
const KIEM_STAFF_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

export function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { loading, isAdmin, staffId } = useAuth();
  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin || staffId !== KIEM_STAFF_ID) {
    return <Navigate to="/staff/today" replace />;
  }
  return <>{children}</>;
}
