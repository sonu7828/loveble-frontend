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
  }
};
