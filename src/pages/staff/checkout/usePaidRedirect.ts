import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Counts down from 5 once the sale is paid, then navigates to `dest`.
 */
export function usePaidRedirect(saleStatus: string | undefined, appointmentId?: string) {
  const navigate = useNavigate();
  const [redirectSecs, setRedirectSecs] = useState(5);

  useEffect(() => {
    if (saleStatus !== "paid") { setRedirectSecs(5); return; }
    setRedirectSecs(5);
    const dest = appointmentId ? `/staff/appointments/${appointmentId}` : "/staff/today";
    const tick = setInterval(() => {
      setRedirectSecs((n) => {
        if (n <= 1) { clearInterval(tick); navigate(dest); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [saleStatus, appointmentId, navigate]);

  return redirectSecs;
}
