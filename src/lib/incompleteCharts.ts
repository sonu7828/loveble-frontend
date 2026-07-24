import { supabase } from "@/integrations/supabase/client";

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
  const { data, error } = await supabase.rpc("get_incomplete_charts");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    appointment: {
      id: row.appointment_id,
      client_email: row.client_email,
      client_first_name: row.client_first_name,
      client_last_name: row.client_last_name,
      start_at: row.start_at,
      end_at: row.end_at,
      status: row.status,
      staff_id: row.staff_id,
      staff_name: row.staff_name,
    },
    missingNote: row.missing_note,
    unsignedConsents: row.unsigned_consents,
  }));
}