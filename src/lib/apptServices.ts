import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch every service linked to each appointment via `appointment_services`
 * and return a map of appointment_id -> ordered list of service names.
 * Used to render multi-service appointments everywhere in the app.
 *
 * Note: we avoid the PostgREST embed `services(name)` because the FK relationship
 * is not always present in the schema cache. Two simple queries are reliable.
 */
export async function fetchApptServiceNames(appointmentIds: string[]): Promise<Record<string, string[]>> {
  if (!appointmentIds.length) return {};
  const { data: rows } = await supabase
    .from("appointment_services")
    .select("appointment_id, display_order, service_id")
    .in("appointment_id", appointmentIds)
    .order("display_order", { ascending: true });
  const list = (rows ?? []) as any[];
  if (!list.length) return {};
  const svcIds = [...new Set(list.map((r) => r.service_id))];
  const { data: svcs } = await supabase.from("services").select("id, name").in("id", svcIds);
  const nameById: Record<string, string> = {};
  (svcs ?? []).forEach((s: any) => { nameById[s.id] = s.name; });
  const map: Record<string, string[]> = {};
  for (const r of list) {
    const nm = nameById[r.service_id];
    if (!nm) continue;
    (map[r.appointment_id] ||= []).push(nm);
  }
  return map;
}

export function combinedServiceLabel(
  apptId: string,
  apsvMap: Record<string, string[]>,
  fallback?: string,
): string {
  const names = apsvMap[apptId];
  if (names && names.length > 0) return names.join(" + ");
  return fallback ?? "";
}
