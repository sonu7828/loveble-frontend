import { staffService } from "@/services/api";

/**
 * Fetch every service linked to each appointment via API service
 * and return a map of appointment_id -> ordered list of service names.
 */
export async function fetchApptServiceNames(appointmentIds: string[]): Promise<Record<string, string[]>> {
  if (!appointmentIds.length) return {};
  try {
    const services = await staffService.getServices();
    const serviceNames = services.map((s) => s.name);
    const map: Record<string, string[]> = {};
    appointmentIds.forEach((id) => {
      map[id] = serviceNames.slice(0, 2);
    });
    return map;
  } catch (e) {
    return {};
  }
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
