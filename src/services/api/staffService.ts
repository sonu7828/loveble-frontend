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

export const staffService = {
  async getLocations(): Promise<Location[]> {
    const res = await ApiClient.get<Location[]>("/locations");
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  async getStaffProfiles(activeOnly = false): Promise<StaffProfile[]> {
    const res = await ApiClient.get<any>(`/staff?activeOnly=${activeOnly}&limit=100`);
    if (res.error) throw new Error(res.error);
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
    if (res.error) {
      if (res.status === 401 || res.error.toLowerCase().includes("unauthorized") || res.error.toLowerCase().includes("authentication required")) {
        return null;
      }
      throw new Error(res.error);
    }
    return res.data;
  },

  async updateStaff(id: string, data: any): Promise<any> {
    const payload = {
      ...data,
      fullName: data.fullName || data.full_name,
      roleName: data.roleName || data.role,
    };
    const res = await ApiClient.patch<any>(`/staff/${id}`, payload);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async deleteStaff(id: string): Promise<any> {
    const res = await ApiClient.delete<any>(`/staff/${id}`);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async getServiceCategories(): Promise<ServiceCategory[]> {
    const res = await ApiClient.get<ServiceCategory[]>("/service-categories");
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  async getServices(opts?: { includeInactive?: boolean }): Promise<MedicalService[]> {
    const res = await ApiClient.get<MedicalService[]>(`/services?includeInactive=${!!opts?.includeInactive}`);
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  async getUnitServices(): Promise<any[]> {
    const res = await ApiClient.get<any[]>("/unit-services");
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  async getProducts(): Promise<any[]> {
    const res = await ApiClient.get<any[]>("/products");
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  async getTerminalReaders(): Promise<any[]> {
    const res = await ApiClient.get<any[]>("/terminal-readers");
    if (res.error) throw new Error(res.error);
    return res.data || [];
  }
};
