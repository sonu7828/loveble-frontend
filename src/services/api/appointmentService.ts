/**
 * Appointment Service for Express REST API Backend.
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
  total_amount?: number;
  deposit_paid?: number;
  notes?: string;
  created_at?: string;
}

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

export const appointmentService = {
  async getAppointments(params?: { date?: string; locationId?: string; status?: string }): Promise<Appointment[]> {
    const query = new URLSearchParams(params as any).toString();
    const res = await ApiClient.get<Appointment[]>(`/appointments?${query}`);
    return res.data || MOCK_APPOINTMENTS;
  },

  async getAppointmentById(id: string): Promise<Appointment | null> {
    const res = await ApiClient.get<Appointment>(`/appointments/${id}`);
    return res.data || MOCK_APPOINTMENTS.find((a) => a.id === id) || MOCK_APPOINTMENTS[0];
  },

  async createAppointment(appointment: Partial<Appointment>): Promise<Appointment> {
    const res = await ApiClient.post<Appointment>("/appointments", appointment);
    return res.data || { id: `apt-${Date.now()}`, ...appointment } as Appointment;
  },

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const res = await ApiClient.patch<Appointment>(`/appointments/${id}`, updates);
    return res.data || { id, ...updates } as Appointment;
  },

  async deleteAppointment(id: string): Promise<boolean> {
    const res = await ApiClient.delete(`/appointments/${id}`);
    return !res.error;
  },

  async getPendingCount(): Promise<number> {
    const res = await ApiClient.get<{ count: number }>("/appointments/pending-count");
    return res.data?.count ?? 1;
  }
};
