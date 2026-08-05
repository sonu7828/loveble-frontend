/**
 * Clinical EHR & Charting Service for Express REST API Backend.
 */
import { ApiClient } from "./client";

export interface ChartNote {
  id: string;
  client_id?: string;
  client_email: string;
  provider_id: string;
  note_type: string;
  status: "draft" | "signed" | "cosigned";
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  created_at: string;
  signed_at?: string;
}

const MOCK_CHARTS: ChartNote[] = [
  {
    id: "chart-1",
    client_email: "sarah.j@example.com",
    provider_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    note_type: "soap",
    status: "signed",
    subjective: "Patient requests forehead line treatment.",
    objective: "Moderate glabella rhytids present.",
    assessment: "Suitable candidate for Neurotoxin injection.",
    plan: "Administered 20U Botox Cosmetic.",
    created_at: new Date().toISOString(),
    signed_at: new Date().toISOString(),
  },
];

export const clinicalService = {
  async getChartNotes(clientEmail?: string): Promise<ChartNote[]> {
    try {
      const res = await ApiClient.get<ChartNote[]>(`/clinical/notes?email=${encodeURIComponent(clientEmail || "")}`);
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
    return res.data || [];
  },

  async getAdverseEvents(): Promise<any[]> {
    const res = await ApiClient.get<any[]>("/clinical/adverse-events");
    return res.data || [];
  }
};
