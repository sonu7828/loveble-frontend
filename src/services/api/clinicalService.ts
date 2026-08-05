/**
 * Clinical EHR & Charting Service for Express REST API Backend.
 * Connects directly to Node.js / Express live /clinical endpoints.
 * ZERO mock data or localStorage fallbacks.
 */
import { ApiClient } from "./client";

export interface ChartNote {
  id: string;
  encounterId?: string | null;
  patientId: string;
  authorId: string;
  cosignedBy?: string | null;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  status: "draft" | "pending_cosign" | "signed" | "cosigned" | "locked";
  signedAt?: string | null;
  cosignedAt?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  author?: { id: string; fullName: string; title?: string | null };
  cosigner?: { id: string; fullName: string; title?: string | null };
  patient?: { id: string; firstName: string; lastName: string; email: string };
  encounter?: { id: string; encounterType: string; encounterDate: string };
}

export interface CosignQueueItem {
  id: string;
  noteId: string;
  authorId: string;
  assignedToId?: string | null;
  status: "pending" | "resolved" | "rejected";
  requestedAt: string;
  resolvedAt?: string | null;
  note: {
    id: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    status: string;
    createdAt: string;
    signedAt?: string | null;
    patient?: { id: string; firstName: string; lastName: string; email: string };
  };
  author: { id: string; fullName: string; title?: string | null };
}

export const clinicalService = {
<<<<<<< HEAD
  async getChartNotes(input?: string | { patientId?: string; email?: string }): Promise<ChartNote[]> {
    try {
      let email = typeof input === "string" ? input : input?.email;
      let patientId = typeof input === "object" ? input?.patientId : undefined;
      const q = new URLSearchParams();
      if (patientId) q.set("patientId", patientId);
      if (email) q.set("email", email);

      const endpoint = `/clinical/notes${q.toString() ? `?${q.toString()}` : ""}`;
      const res = await ApiClient.get<ChartNote[]>(endpoint);
      if (res.error || !res.data || !Array.isArray(res.data)) {
        return MOCK_CHARTS;
      }
      return res.data;
    } catch {
      return MOCK_CHARTS;
    }
  },

  async getChartNoteById(id: string): Promise<ChartNote | null> {
    try {
      const res = await ApiClient.get<ChartNote>(`/clinical/notes/${id}`);
      if (res.data) return res.data;
    } catch {}
    return MOCK_CHARTS.find((c) => c.id === id) || MOCK_CHARTS[0];
  },

  async saveChartNote(note: Partial<ChartNote>): Promise<ChartNote> {
    const res = await ApiClient.post<ChartNote>("/clinical/notes", note);
    return res.data || { id: `chart-${Date.now()}`, status: "draft", created_at: new Date().toISOString(), ...note } as ChartNote;
  },

  async signChartNote(id: string, signature: string): Promise<boolean> {
    const res = await ApiClient.post(`/clinical/notes/${id}/sign`, { signature });
    return !res.error;
  },

  async getProtocols(): Promise<any[]> {
    const res = await ApiClient.get<any[]>("/clinical/protocols");
=======
  /**
   * Get list of SOAP notes for patient chart or global notes index.
   */
  async getChartNotes(params?: { patientId?: string; email?: string }): Promise<ChartNote[]> {
    const q = new URLSearchParams();
    if (params?.patientId) q.set("patientId", params.patientId);
    if (params?.email) q.set("email", params.email);

    const endpoint = `/clinical/notes${q.toString() ? `?${q.toString()}` : ""}`;
    const res = await ApiClient.get<ChartNote[]>(endpoint);
    if (res.error) throw new Error(res.error);
>>>>>>> bbedfd353a6d705d4d3fdd10a523565f61f1fd0a
    return res.data || [];
  },

  /**
   * Get single encounter with associated SOAP notes.
   */
  async getEncounter(id: string): Promise<any> {
    const res = await ApiClient.get<any>(`/clinical/encounters/${id}`);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  /**
   * Create new SOAP note (Draft or Pending Cosign).
   */
  async createSoapNote(input: {
    encounterId: string;
    patientId: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    status?: "draft" | "pending_cosign" | "signed";
    cosignerId?: string | null;
  }): Promise<ChartNote> {
    const res = await ApiClient.post<ChartNote>("/clinical/soap-notes", input);
    if (res.error) throw new Error(res.error);
    if (!res.data) throw new Error("No data returned from createSoapNote");
    return res.data;
  },

  /**
   * Update existing draft SOAP note (Author only).
   */
  async updateSoapNote(
    id: string,
    input: {
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
      status?: "draft" | "pending_cosign";
      cosignerId?: string | null;
    }
  ): Promise<ChartNote> {
    const res = await ApiClient.patch<ChartNote>(`/clinical/soap-notes/${id}`, input);
    if (res.error) throw new Error(res.error);
    if (!res.data) throw new Error("No data returned from updateSoapNote");
    return res.data;
  },

  /**
   * Author sign own note / submit for cosign.
   */
  async signOwnNote(id: string, lockNote = false, cosignerId?: string | null): Promise<ChartNote> {
    const res = await ApiClient.post<ChartNote>(`/clinical/soap-notes/${id}/sign-own`, {
      lockNote,
      cosignerId: cosignerId || undefined,
    });
    if (res.error) throw new Error(res.error);
    if (!res.data) throw new Error("No data returned from signOwnNote");
    return res.data;
  },

  /**
   * Cosign SOAP note (Supervising MD / NP only).
   */
  async cosignNote(id: string, lockNote = true): Promise<ChartNote> {
    const res = await ApiClient.post<ChartNote>(`/clinical/soap-notes/${id}/cosign`, { lockNote });
    if (res.error) throw new Error(res.error);
    if (!res.data) throw new Error("No data returned from cosignNote");
    return res.data;
  },

  /**
   * Return / reject SOAP note to author for correction (Supervising MD / NP only).
   */
  async rejectNote(id: string, reason: string): Promise<ChartNote> {
    const res = await ApiClient.post<ChartNote>(`/clinical/soap-notes/${id}/reject`, { reason });
    if (res.error) throw new Error(res.error);
    if (!res.data) throw new Error("No data returned from rejectNote");
    return res.data;
  },

  /**
   * Get pending cosign queue (Supervising MD / NP only).
   */
  async getCosignQueue(): Promise<CosignQueueItem[]> {
    const res = await ApiClient.get<CosignQueueItem[]>("/clinical/cosign-queue");
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  /**
   * Add addendum to signed/locked note.
   */
  async addAddendum(id: string, reason: string, addendumText: string): Promise<any> {
    const res = await ApiClient.post(`/clinical/soap-notes/${id}/addendum`, { reason, addendumText });
    if (res.error) throw new Error(res.error);
    return res.data;
  },
};
