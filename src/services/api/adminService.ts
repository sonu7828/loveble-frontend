/**
 * Admin & Security Officer Service for Express REST API Backend.
 */
import { ApiClient } from "./client";

export const adminService = {
  async getAuditLogs(params?: { limit?: number; page?: number }): Promise<any[]> {
    const res = await ApiClient.get<any[]>("/admin/audit-logs");
    return res.data || [];
  },

  async getVendors(): Promise<any[]> {
    const res = await ApiClient.get<any[]>("/admin/vendors");
    return res.data || [];
  },

  async getHipaaPolicies(): Promise<any[]> {
    const res = await ApiClient.get<any[]>("/admin/hipaa-policies");
    return res.data || [];
  },

  async getTerminalSettings(): Promise<any> {
    const res = await ApiClient.get<any>("/admin/terminal-settings");
    return res.data || { mode: "standalone", reader_id: "reader_1" };
  },

  async updateTerminalSettings(settings: any): Promise<boolean> {
    const res = await ApiClient.post("/admin/terminal-settings", settings);
    return !res.error;
  }
};
