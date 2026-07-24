/**
 * Centralized React Query hooks for API services.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { staffService, appointmentService, clientService } from "@/services/api";

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    staleTime: 10 * 60_000,
    queryFn: () => staffService.getLocations(),
  });
}

export function useServiceCategories() {
  return useQuery({
    queryKey: ["service_categories"],
    staleTime: 10 * 60_000,
    queryFn: () => staffService.getServiceCategories(),
  });
}

export function useServices(opts: { includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: ["services", { includeInactive: !!opts.includeInactive }],
    staleTime: 5 * 60_000,
    queryFn: () => staffService.getServices(opts),
  });
}

export function useUnitServices() {
  return useQuery({
    queryKey: ["unit_services"],
    staleTime: 5 * 60_000,
    queryFn: () => staffService.getUnitServices(),
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    staleTime: 5 * 60_000,
    queryFn: () => staffService.getProducts(),
  });
}

export function useStaffProfiles(opts: { activeOnly?: boolean } = { activeOnly: true }) {
  return useQuery({
    queryKey: ["staff_profiles", { activeOnly: !!opts.activeOnly }],
    staleTime: 5 * 60_000,
    queryFn: () => staffService.getStaffProfiles(opts.activeOnly),
  });
}

export function useTerminalReaders() {
  return useQuery({
    queryKey: ["terminal_readers"],
    staleTime: 5 * 60_000,
    queryFn: () => staffService.getTerminalReaders(),
  });
}

export function useTodaysAppointments(isoDate: string, locationId?: string | null) {
  return useQuery({
    queryKey: ["appointments_today", isoDate, locationId ?? "all"],
    staleTime: 30_000,
    queryFn: () => appointmentService.getAppointments({ date: isoDate, locationId: locationId || undefined }),
  });
}

export function useAppointment(id: string | null | undefined) {
  return useQuery({
    queryKey: ["appointment", id],
    enabled: !!id,
    staleTime: 30_000,
    queryFn: () => (id ? appointmentService.getAppointmentById(id) : null),
  });
}

export function useClientCredits(clientEmail: string | null | undefined) {
  return useQuery({
    queryKey: ["client_credits", clientEmail],
    enabled: !!clientEmail,
    staleTime: 30_000,
    queryFn: () => (clientEmail ? clientService.getClientCredits(clientEmail) : []),
  });
}

export function useClientCards(clientEmail: string | null | undefined) {
  return useQuery({
    queryKey: ["client_cards", clientEmail],
    enabled: !!clientEmail,
    staleTime: 60_000,
    queryFn: () => (clientEmail ? clientService.getClientCards(clientEmail) : []),
  });
}

export function useSale(id: string | null | undefined) {
  return useQuery({
    queryKey: ["sale", id],
    enabled: !!id,
    staleTime: 30_000,
    queryFn: async () => null,
  });
}

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
    appointment: (id?: string) => qc.invalidateQueries({ queryKey: id ? ["appointment", id] : ["appointment"] }),
    clientCredits: (email?: string) => qc.invalidateQueries({ queryKey: ["client_credits", email] }),
    clientCards: (email?: string) => qc.invalidateQueries({ queryKey: ["client_cards", email] }),
    sale: (id?: string) => qc.invalidateQueries({ queryKey: id ? ["sale", id] : ["sale"] }),
  };
}
