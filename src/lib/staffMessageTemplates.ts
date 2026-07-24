import { ApiClient } from "@/services/api";

export type StaffMessageType = "checkin" | "review" | "rebook" | "photo";

export interface StaffMessageTemplate {
  staff_id: string;
  message_type: StaffMessageType;
  enabled: boolean;
  template: string | null;
  delay_minutes: number | null;
  config: Record<string, unknown>;
}

export async function loadStaffMessageTemplates(staffId: string) {
  const res = await ApiClient.get<StaffMessageTemplate[]>(`/staff/message-templates?staff_id=${encodeURIComponent(staffId)}`);
  const map = new Map<StaffMessageType, StaffMessageTemplate>();
  for (const row of (res.data ?? []) as StaffMessageTemplate[]) {
    map.set(row.message_type as StaffMessageType, row);
  }
  return map;
}

export async function upsertStaffMessageTemplate(row: StaffMessageTemplate) {
  const res = await ApiClient.post("/staff/message-templates", row);
  if (res.error) throw new Error(res.error);
}
