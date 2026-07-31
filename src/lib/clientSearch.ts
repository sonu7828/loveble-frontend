import { apiQuery, clientService } from "@/services/api";

export type ClientHit = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
  visits: number;
  last_seen: string | null;
};

async function fetchClientProfiles(): Promise<any[]> {
  try {
    const res = await apiQuery("client_profiles").select("first_name, last_name, email, phone, dob, created_at").limit(500);
    return res?.data ?? [];
  } catch {
    return [];
  }
}

async function fetchImportedClients(): Promise<any[]> {
  try {
    const res = await apiQuery("imported_clients").select("first_name, last_name, email, phone, dob, created_at").limit(500);
    return res?.data ?? [];
  } catch {
    return [];
  }
}

async function fetchAppointments(): Promise<any[]> {
  try {
    const res = await apiQuery("appointments").select("client_first_name, client_last_name, client_email, client_phone, start_at").limit(500);
    return res?.data ?? [];
  } catch {
    return [];
  }
}

async function fetchServiceClients(q: string): Promise<any[]> {
  try {
    const res = await clientService.getClients(q);
    return res ?? [];
  } catch {
    return [];
  }
}

/**
 * Robust canonical client search querying database profiles, imported clients, appointments & localStorage.
 */
export async function searchClients(query: string, limit = 50): Promise<ClientHit[]> {
  const q = query.trim().toLowerCase();

  // Safely fetch database queries with clean async wrappers
  const [cpData, impData, apptData, svcData] = await Promise.all([
    fetchClientProfiles(),
    fetchImportedClients(),
    fetchAppointments(),
    fetchServiceClients(q),
  ]);

  // Safely read all possible localStorage client keys
  const localKeys = ["rka_demo_clients", "rka_demo_client_profiles", "rka_imported_clients", "rka_demo_appointments"];
  const localClients: any[] = [];

  for (const k of localKeys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localClients.push(...parsed);
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  const map = new Map<string, ClientHit>();

  const addOrUpdate = (
    firstName: string | null | undefined,
    lastName: string | null | undefined,
    email: string | null | undefined,
    phone: string | null | undefined,
    dob: string | null | undefined,
    date: string | null | undefined
  ) => {
    const fn = (firstName || "").trim();
    const ln = (lastName || "").trim();
    const em = (email || "").trim().toLowerCase();
    const ph = (phone || "").trim();

    const key = em || ph || `${fn}-${ln}`.toLowerCase();
    if (!key) return;

    if (!map.has(key)) {
      map.set(key, {
        first_name: fn || null,
        last_name: ln || null,
        email: em || null,
        phone: ph || null,
        dob: dob || null,
        visits: 1,
        last_seen: date || null,
      });
    } else {
      const existing = map.get(key)!;
      if (!existing.first_name && fn) existing.first_name = fn;
      if (!existing.last_name && ln) existing.last_name = ln;
      if (!existing.email && em) existing.email = em;
      if (!existing.phone && ph) existing.phone = ph;
      if (!existing.dob && dob) existing.dob = dob;
      existing.visits += 1;
    }
  };

  // Populate from database client_profiles
  cpData.forEach((c: any) => addOrUpdate(c.first_name, c.last_name, c.email, c.phone, c.dob, c.created_at));
  
  // Populate from database imported_clients
  impData.forEach((c: any) => addOrUpdate(c.first_name, c.last_name, c.email, c.phone, c.dob, c.created_at));

  // Populate from database appointments
  apptData.forEach((a: any) => addOrUpdate(a.client_first_name, a.client_last_name, a.client_email, a.client_phone, null, a.start_at));

  // Populate from all localStorage keys
  localClients.forEach((c: any) => {
    const fn = c.first_name || c.firstName || c.client_first_name;
    const ln = c.last_name || c.lastName || c.client_last_name;
    const em = c.email || c.client_email;
    const ph = c.phone || c.client_phone;
    addOrUpdate(fn, ln, em, ph, c.dob, c.created_at || c.start_at);
  });

  // Populate from clientService mock
  svcData.forEach((c: any) => addOrUpdate(c.first_name, c.last_name, c.email, c.phone, c.dob, c.created_at));

  let list = Array.from(map.values());

  if (q) {
    list = list.filter((c) => {
      const fn = (c.first_name || "").toLowerCase();
      const ln = (c.last_name || "").toLowerCase();
      const full = `${fn} ${ln}`;
      const em = (c.email || "").toLowerCase();
      const ph = (c.phone || "").toLowerCase();
      return full.includes(q) || fn.includes(q) || ln.includes(q) || em.includes(q) || ph.includes(q);
    });
  }

  return list.slice(0, limit);
}
