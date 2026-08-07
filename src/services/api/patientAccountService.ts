import { ApiClient } from "./client";

export interface PatientAccountItem {
  patientProfileId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  userId: string | null;
  hasUser: boolean;
  isActive: boolean;
  isLocked: boolean;
  lockedUntil: string | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export const patientAccountService = {
  async getPatientAccounts(search?: string, page = 1): Promise<{ accounts: PatientAccountItem[]; meta: any }> {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    query.set("page", page.toString());

    const res = await ApiClient.get<any>(`/patient-accounts?${query.toString()}`);
    if (res.error) throw new Error(res.error);
    return {
      accounts: res.data?.data || res.data?.accounts || [],
      meta: res.data?.meta || {},
    };
  },

  async createPatientLogin(patientProfileId: string): Promise<{
    email: string;
    temporaryPassword?: string;
    mustChangePassword: boolean;
    patientProfileId: string;
  }> {
    const res = await ApiClient.post<any>(`/patient-accounts/${patientProfileId}/create-login`);
    if (res.error) throw new Error(res.error);
    return res.data?.data || res.data;
  },

  async activatePatientLogin(patientProfileId: string): Promise<boolean> {
    const res = await ApiClient.post<any>(`/patient-accounts/${patientProfileId}/activate`);
    if (res.error) throw new Error(res.error);
    return true;
  },

  async deactivatePatientLogin(patientProfileId: string): Promise<boolean> {
    const res = await ApiClient.post<any>(`/patient-accounts/${patientProfileId}/deactivate`);
    if (res.error) throw new Error(res.error);
    return true;
  },

  async unlockPatientAccount(patientProfileId: string): Promise<boolean> {
    const res = await ApiClient.post<any>(`/patient-accounts/${patientProfileId}/unlock`);
    if (res.error) throw new Error(res.error);
    return true;
  },

  async resetPatientAccess(patientProfileId: string): Promise<{
    email: string;
    temporaryPassword: string;
    mustChangePassword: boolean;
  }> {
    const res = await ApiClient.post<any>(`/patient-accounts/${patientProfileId}/reset-access`);
    if (res.error) throw new Error(res.error);
    return res.data?.data || res.data;
  },

  async forcePasswordChange(patientProfileId: string): Promise<boolean> {
    const res = await ApiClient.post<any>(`/patient-accounts/${patientProfileId}/force-password-change`);
    if (res.error) throw new Error(res.error);
    return true;
  },

  async grantManagerAccess(staffId: string): Promise<boolean> {
    const res = await ApiClient.post<any>(`/patient-accounts/grant-manager/${staffId}`);
    if (res.error) throw new Error(res.error);
    return true;
  },

  async revokeManagerAccess(staffId: string): Promise<boolean> {
    const res = await ApiClient.post<any>(`/patient-accounts/revoke-manager/${staffId}`);
    if (res.error) throw new Error(res.error);
    return true;
  },
};
