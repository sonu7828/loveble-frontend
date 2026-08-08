import { useState } from "react";

/**
 * Hook for sale completion state (manual navigation enabled).
 */
export function usePaidRedirect(saleStatus: string | undefined, appointmentId?: string) {
  const [redirectSecs] = useState(0);
  return redirectSecs;
}
