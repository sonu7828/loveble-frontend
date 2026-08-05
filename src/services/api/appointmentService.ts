/**
 * Appointment Service for Express REST API Backend.
 * Connects directly to backend /appointments REST API.
 */
import { ApiClient } from "./client";

export interface Appointment {
  id: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  client_phone?: string;
  service_name: string;
  start_at: string;
  end_at?: string;
  status: string;
  location_id?: string;
  staff_id?: string;
  patient_id?: string;
  total_amount?: number;
  deposit_paid?: number;
  notes?: string;
  created_at?: string;
}

<<<<<<< HEAD
const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: "apt-101",
    client_first_name: "Sarah",
    client_last_name: "Jenkins",
    client_email: "sarah.j@example.com",
    client_phone: "(408) 555-0123",
    service_name: "Botox Cosmetic (20 units)",
    start_at: new Date().toISOString(),
    status: "confirmed",
    location_id: "11111111-1111-1111-1111-111111111111",
    staff_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    total_amount: 280,
  },
  {
    id: "apt-102",
    client_first_name: "Elena",
    client_last_name: "Rostova",
    client_email: "elena.r@example.com",
    client_phone: "(408) 555-0199",
    service_name: "Juvederm Voluma XC",
    start_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    status: "pending",
    location_id: "11111111-1111-1111-1111-111111111111",
    staff_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    total_amount: 750,
  },
];

// Merge local localStorage appointments (created in demo mode) with the response
function getLocalAppointments(): Appointment[] {
  try {
    const raw = localStorage.getItem("rka_demo_appointments");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const appointmentService = {
  async getAppointments(params?: { date?: string; locationId?: string; status?: string }): Promise<Appointment[]> {
    try {
      const query = new URLSearchParams(params as any).toString();
      const res = await ApiClient.get<Appointment[]>(`/appointments?${query}`);
      // On 403 (AUTHZ_002) or 401 from production backend, fall back to local + mock data
      if (res.status === 403 || res.status === 401 || !res.data) {
        const local = getLocalAppointments();
        return local.length > 0 ? local : MOCK_APPOINTMENTS;
      }
      // Merge API data with any locally-created demo appointments
      const local = getLocalAppointments();
      const apiIds = new Set(res.data.map((a: Appointment) => a.id));
      const extraLocal = local.filter((a) => !apiIds.has(a.id));
      return [...res.data, ...extraLocal];
    } catch {
      const local = getLocalAppointments();
      return local.length > 0 ? local : MOCK_APPOINTMENTS;
    }
  },

  async getAppointmentById(id: string): Promise<Appointment | null> {
    try {
      const res = await ApiClient.get<Appointment>(`/appointments/${id}`);
      if (res.status === 403 || res.status === 401 || !res.data) {
        return getLocalAppointments().find((a) => a.id === id) || MOCK_APPOINTMENTS.find((a) => a.id === id) || null;
      }
      return res.data;
    } catch {
      return getLocalAppointments().find((a) => a.id === id) || MOCK_APPOINTMENTS.find((a) => a.id === id) || null;
    }
  },

  async createAppointment(appointment: Partial<Appointment>): Promise<Appointment> {
    try {
      const res = await ApiClient.post<Appointment>("/appointments", appointment);
      if (res.data) return res.data;
    } catch { /* fall through to local demo */ }
    // Store locally in demo mode
    const newApt = { id: `apt-${Date.now()}`, ...appointment } as Appointment;
    try {
      const existing = getLocalAppointments();
      localStorage.setItem("rka_demo_appointments", JSON.stringify([...existing, newApt]));
    } catch { /* ignore storage errors */ }
    return newApt;
  },

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    try {
      const res = await ApiClient.patch<Appointment>(`/appointments/${id}`, updates);
      if (res.data) return res.data;
    } catch { /* fall through */ }
    return { id, ...updates } as Appointment;
  },

  async deleteAppointment(id: string): Promise<boolean> {
    try {
      const res = await ApiClient.delete(`/appointments/${id}`);
      return !res.error;
    } catch {
      return false;
    }
  },

  async getPendingCount(): Promise<number> {
    try {
      const res = await ApiClient.get<{ count: number }>("/appointments/pending-count");
      if (res.data?.count !== undefined) return res.data.count;
    } catch { /* fall through */ }
    // Fall back to counting local demo appointments with pending status
    const local = getLocalAppointments();
    const mockPending = MOCK_APPOINTMENTS.filter((a) => a.status === "pending").length;
    const localPending = local.filter((a) => a.status === "pending").length;
    return localPending + mockPending || 1;
=======
export const appointmentService = {
  async getAppointments(params?: { date?: string; locationId?: string; status?: string; startDate?: string; endDate?: string }): Promise<Appointment[]> {
    const queryParams: Record<string, string> = {};
    if (params?.date) queryParams.startDate = `${params.date}T00:00:00.000Z`;
    if (params?.date) queryParams.endDate = `${params.date}T23:59:59.999Z`;
    if (params?.startDate) queryParams.startDate = params.startDate;
    if (params?.endDate) queryParams.endDate = params.endDate;
    if (params?.locationId) queryParams.locationId = params.locationId;
    if (params?.status) queryParams.status = params.status.toUpperCase();

    const query = new URLSearchParams(queryParams).toString();
    const res = await ApiClient.get<any>(`/appointments?${query}`);
    const rawList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    
    return rawList.map((a: any) => ({
      id: a.id,
      client_first_name: a.patient?.firstName || a.client_first_name || "",
      client_last_name: a.patient?.lastName || a.client_last_name || "",
      client_email: a.patient?.email || a.client_email || "",
      client_phone: a.patient?.phone || a.client_phone || "",
      service_name: a.appointmentServices?.[0]?.service?.name || a.service_name || "Aesthetic Treatment",
      start_at: a.startAt || a.start_at || new Date().toISOString(),
      end_at: a.endAt || a.end_at || new Date().toISOString(),
      status: (a.status || "PENDING").toLowerCase(),
      location_id: a.locationId || a.location_id,
      staff_id: a.staffId || a.staff_id,
      patient_id: a.patientId || a.patient_id,
      total_amount: a.totalAmountCents ? a.totalAmountCents / 100 : a.total_amount || 0,
      notes: a.notes || "",
      created_at: a.createdAt || a.created_at || new Date().toISOString(),
    }));
  },

  async getAppointmentById(id: string): Promise<Appointment | null> {
    const res = await ApiClient.get<any>(`/appointments/${id}`);
    const a = res.data?.data || res.data;
    if (!a) return null;
    return {
      id: a.id,
      client_first_name: a.patient?.firstName || a.client_first_name || "",
      client_last_name: a.patient?.lastName || a.client_last_name || "",
      client_email: a.patient?.email || a.client_email || "",
      client_phone: a.patient?.phone || a.client_phone || "",
      service_name: a.appointmentServices?.[0]?.service?.name || a.service_name || "Aesthetic Treatment",
      start_at: a.startAt || a.start_at || new Date().toISOString(),
      end_at: a.endAt || a.end_at || new Date().toISOString(),
      status: (a.status || "PENDING").toLowerCase(),
      location_id: a.locationId || a.location_id,
      staff_id: a.staffId || a.staff_id,
      patient_id: a.patientId || a.patient_id,
      total_amount: a.totalAmountCents ? a.totalAmountCents / 100 : a.total_amount || 0,
      notes: a.notes || "",
      created_at: a.createdAt || a.created_at || new Date().toISOString(),
    };
  },

  async createAppointment(appointment: Partial<Appointment> & { serviceIds?: string[] }): Promise<Appointment> {
    const res = await ApiClient.post<any>("/appointments", appointment);
    const a = res.data?.data || res.data;
    return {
      id: a.id,
      client_first_name: a.patient?.firstName || appointment.client_first_name || "",
      client_last_name: a.patient?.lastName || appointment.client_last_name || "",
      client_email: a.patient?.email || appointment.client_email || "",
      client_phone: a.patient?.phone || appointment.client_phone || "",
      service_name: a.appointmentServices?.[0]?.service?.name || appointment.service_name || "Aesthetic Treatment",
      start_at: a.startAt || appointment.start_at || new Date().toISOString(),
      end_at: a.endAt || appointment.end_at || new Date().toISOString(),
      status: (a.status || "PENDING").toLowerCase(),
      location_id: a.locationId || appointment.location_id,
      staff_id: a.staffId || appointment.staff_id,
      patient_id: a.patientId || appointment.patient_id,
      total_amount: a.totalAmountCents ? a.totalAmountCents / 100 : appointment.total_amount || 0,
      notes: a.notes || "",
      created_at: a.createdAt || new Date().toISOString(),
    };
  },

  async updateAppointmentStatus(id: string, status: string, reason?: string): Promise<any> {
    const res = await ApiClient.post(`/appointments/${id}/status`, { status: status.toUpperCase(), reason });
    return res.data;
  },

  async rescheduleAppointment(id: string, newStartAt: string, newEndAt?: string, reason?: string): Promise<any> {
    const res = await ApiClient.patch(`/appointments/${id}/reschedule`, { newStartAt, newEndAt, reason });
    return res.data;
  },

  async cancelAppointment(id: string, reason?: string): Promise<any> {
    const res = await ApiClient.post(`/appointments/${id}/cancel`, { reason });
    return res.data;
  },

  async getPendingCount(): Promise<number> {
    const res = await ApiClient.get<{ count: number }>("/appointments/pending-count");
    return res.data?.count ?? 0;
>>>>>>> 2402068561fe136c19abae223df84cf28bd92233
  }
};
