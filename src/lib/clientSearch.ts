import { supabase } from "@/integrations/supabase/client";

export type ClientHit = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
  /** Number of past appointments matched (0 = imported only). */
  visits: number;
  /** Most recent appointment timestamp, if any. */
  last_seen: string | null;
};

const dedupeKey = (h: { email: string | null; first_name: string | null; last_name: string | null; phone: string | null }) =>
  (h.email || `${h.first_name ?? ""} ${h.last_name ?? ""} ${h.phone ?? ""}`).toLowerCase().trim();

/**
 * Canonical client search across `imported_clients` + `appointments`.
 * Dedupes by lowercased email (falling back to name+phone), preserves most-recent appointment data.
 */
export async function searchClients(query: string, limit = 8): Promise<ClientHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;

  const [imp, appts] = await Promise.all([
    supabase
      .from("imported_clients")
      .select("first_name, last_name, email, phone, dob")
      .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .limit(40),
    supabase
      .from("appointments")
      .select("client_first_name, client_last_name, client_email, client_phone, client_dob, start_at")
      .or(`client_first_name.ilike.${like},client_last_name.ilike.${like},client_email.ilike.${like},client_phone.ilike.${like}`)
      .order("start_at", { ascending: false })
      .limit(80),
  ]);

  const map = new Map<string, ClientHit>();

  // Seed with imported clients (no visit history attached here).
  for (const r of (imp.data ?? []) as any[]) {
    const hit: ClientHit = {
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      phone: r.phone,
      dob: r.dob,
      visits: 0,
      last_seen: null,
    };
    const k = dedupeKey(hit);
    if (k && !map.has(k)) map.set(k, hit);
  }

  // Layer appointment history on top — most recent wins for name fields.
  for (const a of (appts.data ?? []) as any[]) {
    const candidate: ClientHit = {
      first_name: a.client_first_name,
      last_name: a.client_last_name,
      email: a.client_email,
      phone: a.client_phone,
      dob: a.client_dob,
      visits: 1,
      last_seen: a.start_at,
    };
    const k = dedupeKey(candidate);
    if (!k) continue;
    const existing = map.get(k);
    if (existing) {
      existing.visits += 1;
      if (!existing.last_seen || (a.start_at && a.start_at > existing.last_seen)) {
        existing.last_seen = a.start_at;
      }
    } else {
      map.set(k, candidate);
    }
  }

  return [...map.values()].slice(0, limit);
}
