import { clientService } from "@/services/api";

export type ClientHit = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
  visits: number;
  last_seen: string | null;
};

/**
 * Canonical client search API service call.
 */
export async function searchClients(query: string, limit = 8): Promise<ClientHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const clients = await clientService.getClients(q);
  return clients.map((c) => ({
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    phone: c.phone || null,
    dob: c.dob || null,
    visits: 1,
    last_seen: c.created_at || null,
  })).slice(0, limit);
}
