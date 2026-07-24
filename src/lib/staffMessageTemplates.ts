// Canonical client helper for the unified staff_message_templates table.
// One row per (staff_id, message_type). `delay_minutes` is normalized;
// UI may surface hours/weeks/days but the table stores minutes.
import { supabase } from "@/integrations/supabase/client";

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
  const { data, error } = await supabase
    .from("staff_message_templates")
    .select("staff_id, message_type, enabled, template, delay_minutes, config")
    .eq("staff_id", staffId);
  if (error) throw error;
  const map = new Map<StaffMessageType, StaffMessageTemplate>();
  for (const row of (data ?? []) as StaffMessageTemplate[]) {
    map.set(row.message_type as StaffMessageType, row);
  }
  return map;
}

export async function upsertStaffMessageTemplate(row: StaffMessageTemplate) {
  const { error } = await supabase
    .from("staff_message_templates")
    .upsert(
      [
        {
          staff_id: row.staff_id,
          message_type: row.message_type,
          enabled: row.enabled,
          template: row.template ?? undefined,
          delay_minutes: row.delay_minutes ?? undefined,
          config: (row.config ?? {}) as never,
        },
      ],
      { onConflict: "staff_id,message_type" },
    );
  if (error) throw error;
}
