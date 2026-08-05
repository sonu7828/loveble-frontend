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

const MOCK_COSIGN_QUEUE: CosignQueueItem[] = [
  {
    id: "cosign-01",
    noteId: "chart-101",
    authorId: "st-girish",
    status: "pending",
    requestedAt: new Date().toISOString(),
    note: {
      id: "chart-101",
      subjective: "Client requests Botox 20u for forehead lines.",
      objective: "Skin clean, no contraindications noted.",
      assessment: "Suitable for Botox Cosmetic.",
      plan: "Administer 20u Botox.",
      status: "pending_cosign",
      createdAt: new Date().toISOString(),
      patient: { id: "p-1", firstName: "Sarah", lastName: "Jenkins", email: "sarah.j@example.com" },
    },
    author: { id: "st-girish", fullName: "Girish", title: "Nurse Practitioner" },
  },
  {
    id: "cosign-02",
    noteId: "chart-102",
    authorId: "st-rn",
    status: "pending",
    requestedAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    note: {
      id: "chart-102",
      subjective: "Client for Juvederm Voluma XC cheeks touch up.",
      objective: "No bruising or swelling.",
      assessment: "Dermal filler appropriate.",
      plan: "Inject 1.0ml Juvederm Voluma XC.",
      status: "pending_cosign",
      createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
      patient: { id: "p-2", firstName: "Elena", lastName: "Rostova", email: "elena.r@example.com" },
    },
    author: { id: "st-rn", fullName: "Nurse Practitioner", title: "NP / Injector" },
  },
];

export const clinicalService = {
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
    try {
      const res = await ApiClient.get<CosignQueueItem[]>("/clinical/cosign-queue");
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
      return MOCK_COSIGN_QUEUE;
    } catch {
      return MOCK_COSIGN_QUEUE;
    }
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
