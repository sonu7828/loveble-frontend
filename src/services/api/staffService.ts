/**
 * Staff & Locations Service for Express REST API Backend.
 */
import { ApiClient } from "./client";

export interface StaffProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  phone?: string;
  title?: string;
  color?: string;
  hourly_rate_cents?: number | null;
  commission_percent?: number | null;
}

export interface Location {
  id: string;
  name: string;
  short_name: string;
  city: string;
  address: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface MedicalService {
  id: string;
  name: string;
  category_id?: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
}

const MOCK_LOCATIONS: Location[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "San Jose Studio",
    short_name: "San Jose",
    city: "San Jose",
    address: "2100 Curtner Ave, Ste 1B",
  },
];

const MOCK_STAFF: StaffProfile[] = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    full_name: "Administrator Kiem",
    email: "admin@radiantilyk.com",
    role: "admin",
    is_active: true,
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    full_name: "Nurse Jessica Smith, NP",
    email: "jessica@radiantilyk.com",
    role: "nurse_practitioner",
    is_active: true,
  },
];

const MOCK_SERVICES: MedicalService[] = [
  { id: "srv-1", name: "Botox Cosmetic", price: 14, duration_minutes: 30, is_active: true },
  { id: "srv-2", name: "Juvederm Voluma XC", price: 800, duration_minutes: 45, is_active: true },
  { id: "srv-3", name: "HydraFacial Deluxe", price: 250, duration_minutes: 60, is_active: true },
];

export const staffService = {
  async getLocations(): Promise<Location[]> {
    const res = await ApiClient.get<Location[]>("/locations");
    return res.data || MOCK_LOCATIONS;
  },

  async getStaffProfiles(activeOnly = false): Promise<StaffProfile[]> {
    const res = await ApiClient.get<any>(`/staff?activeOnly=${activeOnly}&limit=100`);
    const raw = res.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    if (Array.isArray(raw?.data?.staff)) return raw.data.staff;
    return [];
  },

  async createStaffWithUser(data: {
    fullName: string;
    title: string;
    email: string;
    password?: string;
    roleName: string;
    color?: string;
  }): Promise<any> {
    const res = await ApiClient.post<any>("/staff/create-with-user", data);
    return res.data;
  },

  async updateStaff(id: string, data: any): Promise<any> {
    const payload = {
      ...data,
      fullName: data.fullName || data.full_name,
      roleName: data.roleName || data.role,
    };
    const res = await ApiClient.patch<any>(`/staff/${id}`, payload);
    return res.data;
  },

  async deleteStaff(id: string): Promise<any> {
    const res = await ApiClient.delete<any>(`/staff/${id}`);
    return res.data;
  },

  async getServiceCategories(): Promise<ServiceCategory[]> {
    const res = await ApiClient.get<ServiceCategory[]>("/service-categories");
    return res.data || [{ id: "cat-1", name: "Injectables", sort_order: 1 }, { id: "cat-2", name: "Skin Care", sort_order: 2 }];
  },

  async getServices(opts?: { includeInactive?: boolean }): Promise<MedicalService[]> {
    const res = await ApiClient.get<MedicalService[]>(`/services?includeInactive=${!!opts?.includeInactive}`);
    return res.data || MOCK_SERVICES;
  },

  async getUnitServices(): Promise<any[]> {
    const res = await ApiClient.get<any[]>("/unit-services");
    return res.data || [];
  },

  async getProducts(): Promise<any[]> {
    const res = await ApiClient.get<any[]>("/products");
    return res.data || [];
  },

  async getTerminalReaders(): Promise<any[]> {
    const res = await ApiClient.get<any[]>("/terminal-readers");
    return res.data || [];
  }
};
