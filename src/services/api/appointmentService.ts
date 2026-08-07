/**
 * Appointment Service for Express REST API Backend.
 * Connects directly to backend /appointments REST API.
 * ZERO mock data or localStorage fallbacks.
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

function mapApiAppointment(a: any): Appointment {
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
}

export const appointmentService = {
  async getAppointments(params?: { date?: string; locationId?: string; status?: string; startDate?: string; endDate?: string }): Promise<Appointment[]> {
    const queryParams: Record<string, string> = {};
    if (params?.date) {
      queryParams.startDate = `${params.date}T00:00:00.000Z`;
      queryParams.endDate = `${params.date}T23:59:59.999Z`;
    }
    if (params?.startDate) queryParams.startDate = params.startDate;
    if (params?.endDate) queryParams.endDate = params.endDate;
    if (params?.locationId) queryParams.locationId = params.locationId;
    if (params?.status) queryParams.status = params.status.toUpperCase();

    const query = new URLSearchParams(queryParams).toString();
    const res = await ApiClient.get<any>(`/appointments?${query}`);

    if (res.error) {
      throw new Error(res.error);
    }

    if (!res.data) {
      return [];
    }

    const rawList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    return rawList.map(mapApiAppointment);
  },

  async getAppointmentById(id: string): Promise<Appointment | null> {
    const res = await ApiClient.get<any>(`/appointments/${id}`);

    if (res.status === 404) {
      return null;
    }

    if (res.error) {
      throw new Error(res.error);
    }

    const a = res.data?.data || res.data;
    if (!a) return null;
    return mapApiAppointment(a);
  },

  async createAppointment(appointment: Partial<Appointment> & { serviceIds?: string[] }): Promise<Appointment> {
    const res = await ApiClient.post<any>("/appointments", appointment);

    if (res.error) {
      throw new Error(res.error);
    }

    const a = res.data?.data || res.data;
    if (!a) {
      throw new Error("No data returned from createAppointment");
    }
    return mapApiAppointment(a);
  },

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const res = await ApiClient.patch<any>(`/appointments/${id}`, updates);

    if (res.error) {
      throw new Error(res.error);
    }

    const a = res.data?.data || res.data;
    if (!a) {
      throw new Error("No data returned from updateAppointment");
    }
    return mapApiAppointment(a);
  },

  async updateAppointmentStatus(id: string, status: string, reason?: string): Promise<any> {
    const res = await ApiClient.post(`/appointments/${id}/status`, { status: status.toUpperCase(), reason });

    if (res.error) {
      throw new Error(res.error);
    }

    return res.data;
  },

  async rescheduleAppointment(id: string, newStartAt: string, newEndAt?: string, reason?: string): Promise<any> {
    const res = await ApiClient.patch(`/appointments/${id}/reschedule`, { newStartAt, newEndAt, reason });

    if (res.error) {
      throw new Error(res.error);
    }

    return res.data;
  },

  async cancelAppointment(id: string, reason?: string): Promise<any> {
    const res = await ApiClient.post(`/appointments/${id}/cancel`, { reason });

    if (res.error) {
      throw new Error(res.error);
    }

    return res.data;
  },

  async deleteAppointment(id: string): Promise<boolean> {
    const res = await ApiClient.delete(`/appointments/${id}`);

    if (res.error) {
      throw new Error(res.error);
    }

    return true;
  },

  async getPendingCount(): Promise<number> {
    const res = await ApiClient.get<{ count: number }>("/appointments/pending-count");

    if (res.error) {
      throw new Error(res.error);
    }

    return res.data?.count ?? 0;
  },

  async createPublicBooking(payload: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    staffId: string;
    locationId: string;
    serviceId: string;
    startAt: string;
    notes?: string | null;
  }): Promise<{
    bookingToken: string;
    appointmentId: string;
    patientName: string;
    serviceName: string;
    startAt: string;
    endAt: string;
    status: string;
    existingAccount: boolean;
    temporaryPassword?: string;
    email: string;
    patientId: string;
  }> {
    const res = await ApiClient.post<any>("/appointments/public-booking", payload);

    if (res.error) {
      throw new Error(res.error);
    }

    return res.data?.data || res.data;
  }
};
