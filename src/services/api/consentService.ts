/**
 * Consent Service for Express REST API Backend.
 */
import { ApiClient } from "./client";

export const consentService = {
  async getConsentsByToken(token: string): Promise<any> {
    const res = await ApiClient.get<any>(`/consents?token=${encodeURIComponent(token)}`);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async submitSignedConsents(payload: {
    token: string;
    signatures: any[];
    signingMode?: string;
  }): Promise<any> {
    const res = await ApiClient.post<any>("/public-sign-consents", payload);
    if (res.error) throw new Error(res.error);
    return res.data;
  },
};
