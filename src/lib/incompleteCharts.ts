import { clinicalService } from "@/services/api";

export type IncompleteChart = {
  appointment: {
    id: string;
    client_email: string | null;
    client_first_name: string | null;
    client_last_name: string | null;
    start_at: string;
    end_at: string;
    status: string;
    staff_id: string | null;
    staff_name: string | null;
  };
  missingNote: boolean;
  unsignedConsents: number;
};

export async function fetchIncompleteCharts(_options?: { canSeeAll?: boolean; staffId?: string | null }): Promise<IncompleteChart[]> {
  try {
    const charts = await clinicalService.getChartNotes();
    return charts.map((c) => ({
      appointment: {
        id: c.id,
        client_email: c.client_email,
        client_first_name: "Patient",
        client_last_name: "User",
        start_at: c.created_at,
        end_at: c.created_at,
        status: c.status,
        staff_id: c.provider_id,
        staff_name: "Staff Provider",
      },
      missingNote: c.status === "draft",
      unsignedConsents: 0,
    }));
  } catch (e) {
    return [];
  }
}