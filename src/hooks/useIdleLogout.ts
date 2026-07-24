import { useCallback, useState } from "react";
import { authService } from "@/services/api";

export function useIdleLogout(_enabled: boolean) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown] = useState(60);

  const staySignedIn = useCallback(() => {
    setShowWarning(false);
  }, []);

  return { showWarning, countdown, staySignedIn };
}
