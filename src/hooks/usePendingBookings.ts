import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function usePendingBookings(enabled: boolean) {
  const [count, setCount] = useState(0);
  const navigate = useNavigate();
  const seenIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    async function loadInitial() {
      const { data, error } = await supabase
        .from("appointments")
        .select("id")
        .eq("status", "pending");
      if (!active || error) return;
      seenIds.current = new Set((data ?? []).map((a) => a.id));
      setCount(seenIds.current.size);
      initialized.current = true;
    }
    loadInitial();

    const channel = supabase
      .channel("staff-pending-appointments")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments" },
        (payload) => {
          const row: any = payload.new;
          if (row?.status !== "pending" || seenIds.current.has(row.id)) return;
          seenIds.current.add(row.id);
          setCount(seenIds.current.size);
          if (initialized.current) {
            const name = `${row.client_first_name ?? ""} ${row.client_last_name ?? ""}`.trim() || "New client";
            toast(`New booking pending approval`, {
              description: `${name} requested an appointment.`,
              action: { label: "Review", onClick: () => navigate("/staff/inbox") },
              duration: 10000,
            });
            try {
              // Soft chime if supported; ignored on failure
              const a = new Audio("data:audio/wav;base64,UklGRkQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSAAAAB/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/");
              a.volume = 0.3;
              a.play().catch(() => {});
            } catch {}
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "appointments" },
        (payload) => {
          const row: any = payload.new;
          const old: any = payload.old;
          if (old?.status === "pending" && row?.status !== "pending") {
            if (seenIds.current.delete(row.id)) setCount(seenIds.current.size);
          } else if (old?.status !== "pending" && row?.status === "pending") {
            if (!seenIds.current.has(row.id)) {
              seenIds.current.add(row.id);
              setCount(seenIds.current.size);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "appointments" },
        (payload) => {
          const id = (payload.old as any)?.id;
          if (id && seenIds.current.delete(id)) setCount(seenIds.current.size);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [enabled, navigate]);

  return count;
}
