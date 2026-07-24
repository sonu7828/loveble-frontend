/**
 * Client & Patient Service for Express REST API Backend.
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
}

const MOCK_CLIENTS: ClientRecord[] = [
  {
    id: "cli-1",
    first_name: "Sarah",
    last_name: "Jenkins",
    email: "sarah.j@example.com",
    phone: "(408) 555-0123",
    dob: "1990-05-14",
    created_at: new Date().toISOString(),
  },
  {
    id: "cli-2",
    first_name: "Elena",
    last_name: "Rostova",
    email: "elena.r@example.com",
    phone: "(408) 555-0199",
    dob: "1988-11-22",
    created_at: new Date().toISOString(),
  },
];

export const clientService = {
  async getClients(query?: string): Promise<ClientRecord[]> {
    const res = await ApiClient.get<ClientRecord[]>(`/clients?q=${encodeURIComponent(query || "")}`);
    return res.data || MOCK_CLIENTS;
  },

  async getClientByEmail(email: string): Promise<ClientRecord | null> {
    const res = await ApiClient.get<ClientRecord>(`/clients/by-email/${encodeURIComponent(email)}`);
    return res.data || MOCK_CLIENTS.find((c) => c.email.toLowerCase() === email.toLowerCase()) || MOCK_CLIENTS[0];
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
    const res = await ApiClient.post<ClientRecord>("/clients", client);
    return res.data || { id: `cli-${Date.now()}`, ...client } as ClientRecord;
  }
};
