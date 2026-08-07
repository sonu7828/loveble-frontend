/**
 * Patient Intake & Profile Service for Express REST API Backend.
 */
import { ApiClient } from "./client";

export const patientService = {
  async getPublicIntake(token: string): Promise<any> {
    const res = await ApiClient.get<any>(`/public-client-intake?token=${encodeURIComponent(token)}`);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async submitPublicIntake(token: string, payload: any): Promise<any> {
    const res = await ApiClient.post<any>("/public-client-intake", { token, payload });
    if (res.error) throw new Error(res.error);
    return res.data;
  },
};
