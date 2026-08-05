/**
 * Client & Patient Service for Express REST API Backend.
 * Connects directly to backend /patients REST API.
 */
import { ApiClient } from "./client";

export interface ClientRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  dob?: string;
  created_at?: string;
  notes?: string;
  account_status?: string;
  is_active?: boolean;
}

export const clientService = {
  async getClients(query?: string): Promise<ClientRecord[]> {
    const res = await ApiClient.get<any>(`/patients?search=${encodeURIComponent(query || "")}`);
    const rawList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    return rawList.map((p: any) => ({
      id: p.id,
      first_name: p.firstName || p.first_name || "",
      last_name: p.lastName || p.last_name || "",
      email: p.email || "",
      phone: p.phone || "",
      dob: p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split("T")[0] : (p.dob || ""),
      created_at: p.createdAt || p.created_at || "",
      notes: p.notes || "",
      account_status: p.isActive === false ? "disabled" : "active",
      is_active: p.isActive !== false,
    }));
  },

  async getClientById(id: string): Promise<ClientRecord | null> {
    const res = await ApiClient.get<any>(`/patients/${id}`);
    const p = res.data?.data || res.data;
    if (!p) return null;
    return {
      id: p.id,
      first_name: p.firstName || p.first_name || "",
      last_name: p.lastName || p.last_name || "",
      email: p.email || "",
      phone: p.phone || "",
      dob: p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split("T")[0] : (p.dob || ""),
      created_at: p.createdAt || p.created_at || "",
      notes: p.notes || "",
      account_status: p.isActive === false ? "disabled" : "active",
      is_active: p.isActive !== false,
    };
  },

  async getClientByEmail(email: string): Promise<ClientRecord | null> {
    const res = await ApiClient.get<any>(`/patients?search=${encodeURIComponent(email)}`);
    const rawList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    const found = rawList.find((p: any) => p.email?.toLowerCase() === email.toLowerCase()) || rawList[0];
    if (!found) return null;
    return {
      id: found.id,
      first_name: found.firstName || found.first_name || "",
      last_name: found.lastName || found.last_name || "",
      email: found.email || "",
      phone: found.phone || "",
      dob: found.dateOfBirth ? new Date(found.dateOfBirth).toISOString().split("T")[0] : (found.dob || ""),
      created_at: found.createdAt || found.created_at || "",
      notes: found.notes || "",
      account_status: found.isActive === false ? "disabled" : "active",
      is_active: found.isActive !== false,
    };
  },

  async getClientCredits(email: string): Promise<any[]> {
    const res = await ApiClient.get<any[]>(`/clients/credits?email=${encodeURIComponent(email)}`);
    return res.data || [];
  },

  async getClientCards(email: string): Promise<any[]> {
    const res = await ApiClient.get<any[]>(`/clients/payment-methods?email=${encodeURIComponent(email)}`);
    return res.data || [];
  },

  async saveClient(client: Partial<ClientRecord>): Promise<ClientRecord> {
    const payload = {
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email,
      phone: client.phone,
      dateOfBirth: client.dob,
    };
    const res = client.id && !client.id.startsWith("client-")
      ? await ApiClient.patch(`/patients/${client.id}`, payload)
      : await ApiClient.post("/patients", payload);

    const p = res.data?.data || res.data;
    return {
      id: p.id,
      first_name: p.firstName || p.first_name || "",
      last_name: p.lastName || p.last_name || "",
      email: p.email || "",
      phone: p.phone || "",
      dob: p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split("T")[0] : (p.dob || ""),
      created_at: p.createdAt || p.created_at || "",
      notes: p.notes || "",
      account_status: p.isActive === false ? "disabled" : "active",
      is_active: p.isActive !== false,
    };
  }
};
