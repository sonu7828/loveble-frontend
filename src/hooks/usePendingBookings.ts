import { useEffect, useState } from "react";
import { appointmentService } from "@/services/api";

export function usePendingBookings(enabled: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    async function loadCount() {
      const pendingCount = await appointmentService.getPendingCount();
      if (active) {
        setCount(pendingCount);
      }
    }

    loadCount();
    const interval = setInterval(loadCount, 60000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [enabled]);

  return count;
}
