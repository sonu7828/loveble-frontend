/**
 * Centralized React Query hooks for the staff app's hot reads.
 * One file, one cache, shared across every page. No more refetch-on-every-mount.
 *
 * Conventions:
 * - All keys start with a stable string so devtools group them clearly.
 * - staleTime defaults from QueryClient (60s); override per-hook only when data
 *   changes more/less often than that.
 * - Mutations should call queryClient.invalidateQueries({ queryKey: [...] }) on
 *   the relevant key — see invalidateStaffData() helpers below.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Locations ──────────────────────────────────────────────────────────────
export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    staleTime: 10 * 60_000, // locations almost never change
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Service categories ─────────────────────────────────────────────────────
export function useServiceCategories() {
  return useQuery({
    queryKey: ["service_categories"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Services (active only by default) ──────────────────────────────────────
export function useServices(opts: { includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: ["services", { includeInactive: !!opts.includeInactive }],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      let q = supabase.from("services").select("*").order("name", { ascending: true });
      if (!opts.includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Unit services (units-based pricing like Botox/Dysport) ─────────────────
export function useUnitServices() {
  return useQuery({
    queryKey: ["unit_services"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_services")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Products (retail items) ────────────────────────────────────────────────
export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Staff profiles (providers & schedulers) ────────────────────────────────
export function useStaffProfiles(opts: { activeOnly?: boolean } = { activeOnly: true }) {
  return useQuery({
    queryKey: ["staff_profiles", { activeOnly: !!opts.activeOnly }],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      let q = supabase.from("staff_profiles").select("*").order("full_name", { ascending: true });
      if (opts.activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Terminal readers ───────────────────────────────────────────────────────
export function useTerminalReaders() {
  return useQuery({
    queryKey: ["terminal_readers"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terminal_readers")
        .select("*")
        .order("label", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Today's appointments (parameterized by ISO date + optional location) ───
export function useTodaysAppointments(
  isoDate: string,
  locationId?: string | null,
) {
  return useQuery({
    queryKey: ["appointments_today", isoDate, locationId ?? "all"],
    staleTime: 30_000, // appointments do move around — keep tight
    queryFn: async () => {
      const start = new Date(`${isoDate}T00:00:00`).toISOString();
      const end = new Date(`${isoDate}T23:59:59.999`).toISOString();
      let q = supabase
        .from("appointments")
        .select("*")
        .gte("start_at", start)
        .lte("start_at", end)
        .order("start_at", { ascending: true });
      if (locationId) q = q.eq("location_id", locationId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── A single appointment (used by checkout / appointment detail) ───────────
export function useAppointment(id: string | null | undefined) {
  return useQuery({
    queryKey: ["appointment", id],
    enabled: !!id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ─── Client credits balance ─────────────────────────────────────────────────
export function useClientCredits(clientEmail: string | null | undefined) {
  const email = clientEmail?.toLowerCase().trim() || null;
  return useQuery({
    queryKey: ["client_credits", email],
    enabled: !!email,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_credits")
        .select("*")
        .eq("client_email", email!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Client cards on file ───────────────────────────────────────────────────
export function useClientCards(clientEmail: string | null | undefined) {
  const email = clientEmail?.toLowerCase().trim() || null;
  return useQuery({
    queryKey: ["client_cards", email],
    enabled: !!email,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payment_methods")
        .select("*")
        .eq("client_email", email!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Sale lookup (used by checkout receipt / refunds) ───────────────────────
export function useSale(id: string | null | undefined) {
  return useQuery({
    queryKey: ["sale", id],
    enabled: !!id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, sale_items(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ─── Cache invalidation helpers ─────────────────────────────────────────────
/**
 * Call after mutations to invalidate the affected slice of cache.
 *   const invalidate = useInvalidateStaffData();
 *   await supabase.from("services").update(...).eq(...);
 *   invalidate.services();
 */
export function useInvalidateStaffData() {
  const qc = useQueryClient();
  return {
    locations: () => qc.invalidateQueries({ queryKey: ["locations"] }),
    serviceCategories: () => qc.invalidateQueries({ queryKey: ["service_categories"] }),
    services: () => qc.invalidateQueries({ queryKey: ["services"] }),
    unitServices: () => qc.invalidateQueries({ queryKey: ["unit_services"] }),
    products: () => qc.invalidateQueries({ queryKey: ["products"] }),
    staffProfiles: () => qc.invalidateQueries({ queryKey: ["staff_profiles"] }),
    terminalReaders: () => qc.invalidateQueries({ queryKey: ["terminal_readers"] }),
    appointmentsToday: () => qc.invalidateQueries({ queryKey: ["appointments_today"] }),
    appointment: (id?: string) =>
      qc.invalidateQueries({ queryKey: id ? ["appointment", id] : ["appointment"] }),
    clientCredits: (email?: string) =>
      qc.invalidateQueries({
        queryKey: email ? ["client_credits", email.toLowerCase().trim()] : ["client_credits"],
      }),
    clientCards: (email?: string) =>
      qc.invalidateQueries({
        queryKey: email ? ["client_cards", email.toLowerCase().trim()] : ["client_cards"],
      }),
    sale: (id?: string) =>
      qc.invalidateQueries({ queryKey: id ? ["sale", id] : ["sale"] }),
  };
}
