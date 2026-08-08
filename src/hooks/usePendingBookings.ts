import { useEffect, useState, useCallback } from "react";
import { apiQuery, appointmentService } from "@/services/api";
import { isTestPatient } from "@/lib/testPatientFilter";

export function usePendingBookings(enabled: boolean) {
  const [count, setCount] = useState(0);

  const loadCount = useCallback(async () => {
    if (!enabled) return;
    try {
      // Direct Live DB query for pending appointments
      const res = await apiQuery("appointments").select("id, status, client_email, client_first_name, client_last_name").eq("status", "pending");
      if (Array.isArray(res.data)) {
        const clean = res.data.filter((x: any) => !isTestPatient(x));
        setCount(clean.length);
      } else {
        const apiCount = await appointmentService.getPendingCount();
        setCount(apiCount);
      }
    } catch {
      setCount(0);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    loadCount();
    const interval = setInterval(loadCount, 15000); // 15s auto polling for live updates

    const handleSync = () => loadCount();
    window.addEventListener("rka_appointment_created", handleSync);
    window.addEventListener("rka_appointment_updated", handleSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener("rka_appointment_created", handleSync);
      window.removeEventListener("rka_appointment_updated", handleSync);
    };
  }, [enabled, loadCount]);

  return count;
}
