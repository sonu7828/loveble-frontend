// Fetches busy time intervals from staff Google Calendars.
//
// Strategy per staff:
//  1) If the staff has connected their own Google account (row in
//     `staff_google_oauth`), use that OAuth access token to call Google
//     Calendar `freeBusy` directly. Refresh the token if it has expired.
//  2) Otherwise, fall back to the shared connector gateway using the
//     `calendar_email` configured on the staff profile (legacy public-share
//     path).
//
// Returns a map of staffId -> array of [startMs, endMs] busy intervals.
// Fails open: if the gateway / key is missing or the API call errors, returns
// an empty map for the affected staff so booking still works.

const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const GOOGLE_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

export type BusyInterval = [number, number];

export interface StaffCalendarLookup {
  id: string;
  calendarEmail: string | null;
}

interface OAuthRow {
  staff_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string;
  calendar_id: string | null;
}

function gatewayHeaders(): Record<string, string> | null {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GCAL_KEY = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
  if (!LOVABLE_API_KEY || !GCAL_KEY) return null;
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GCAL_KEY,
    "Content-Type": "application/json",
  };
}

async function refreshAccessToken(supa: any, row: OAuthRow): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret || !row.refresh_token) return null;
  try {
    const res = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: row.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      console.warn("[gcal-busy] token refresh failed", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const newToken: string = data.access_token;
    const expiresIn: number = data.expires_in ?? 3600;
    const newExpiry = new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();
    await supa.from("staff_google_oauth").update({
      access_token: newToken,
      token_expires_at: newExpiry,
      last_refreshed_at: new Date().toISOString(),
    }).eq("staff_id", row.staff_id);
    return newToken;
  } catch (e) {
    console.warn("[gcal-busy] refresh error", (e as Error).message);
    return null;
  }
}

async function getValidToken(supa: any, row: OAuthRow): Promise<string | null> {
  const expiry = new Date(row.token_expires_at).getTime();
  if (expiry - Date.now() > 30_000) return row.access_token;
  return await refreshAccessToken(supa, row);
}

async function fetchOAuthBusy(
  supa: any,
  row: OAuthRow,
  startIso: string,
  endIso: string,
): Promise<BusyInterval[]> {
  const token = await getValidToken(supa, row);
  if (!token) return [];
  const calId = row.calendar_id || "primary";
  try {
    const res = await fetch(`${GOOGLE_API}/freeBusy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: startIso,
        timeMax: endIso,
        timeZone: "America/Los_Angeles",
        items: [{ id: calId }],
      }),
    });
    if (!res.ok) {
      console.warn("[gcal-busy] oauth freeBusy failed", res.status, (await res.text()).slice(0, 200));
      return [];
    }
    const data = await res.json();
    const entry = data?.calendars?.[calId];
    if (!entry || entry.errors) return [];
    return (entry.busy ?? [])
      .map((b: any) => [new Date(b.start).getTime(), new Date(b.end).getTime()] as BusyInterval)
      .filter(([s, e]: BusyInterval) => Number.isFinite(s) && Number.isFinite(e) && e > s);
  } catch (e) {
    console.warn("[gcal-busy] oauth error", (e as Error).message);
    return [];
  }
}

async function fetchGatewayBusy(
  staff: StaffCalendarLookup[],
  startIso: string,
  endIso: string,
): Promise<Map<string, BusyInterval[]>> {
  const out = new Map<string, BusyInterval[]>();
  const headers = gatewayHeaders();
  if (!headers) return out;
  const withCal = staff.filter(s => s.calendarEmail && s.calendarEmail.includes("@"));
  if (withCal.length === 0) return out;
  const items = withCal.map(s => ({ id: s.calendarEmail!.toLowerCase() }));
  try {
    const res = await fetch(`${GATEWAY}/freeBusy`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        timeMin: startIso,
        timeMax: endIso,
        timeZone: "America/Los_Angeles",
        items,
      }),
    });
    if (!res.ok) {
      console.warn("[gcal-busy] gateway freeBusy failed", res.status, (await res.text()).slice(0, 200));
      return out;
    }
    const data = await res.json();
    const calendars = data?.calendars ?? {};
    for (const s of withCal) {
      const key = s.calendarEmail!.toLowerCase();
      const entry = calendars[key];
      if (!entry || entry.errors) continue;
      const busy: BusyInterval[] = (entry.busy ?? [])
        .map((b: any) => [new Date(b.start).getTime(), new Date(b.end).getTime()] as BusyInterval)
        .filter(([s, e]: BusyInterval) => Number.isFinite(s) && Number.isFinite(e) && e > s);
      if (busy.length) out.set(s.id, busy);
    }
  } catch (e) {
    console.warn("[gcal-busy] gateway error", (e as Error).message);
  }
  return out;
}

/**
 * Fetch freeBusy intervals for staff in [startIso, endIso).
 * Pass a Supabase client (with read access to `staff_google_oauth`) to enable
 * the per-staff OAuth path. Without it, only the gateway fallback runs.
 */
export async function fetchStaffBusy(
  staff: StaffCalendarLookup[],
  startIso: string,
  endIso: string,
  supa?: any,
): Promise<Map<string, BusyInterval[]>> {
  const out = new Map<string, BusyInterval[]>();
  if (staff.length === 0) return out;

  // Look up OAuth rows for these staff (if supa provided).
  let oauthRows: OAuthRow[] = [];
  if (supa) {
    try {
      const ids = staff.map(s => s.id);
      const { data } = await supa
        .from("staff_google_oauth")
        .select("staff_id, access_token, refresh_token, token_expires_at, calendar_id")
        .in("staff_id", ids);
      oauthRows = (data ?? []) as OAuthRow[];
    } catch (e) {
      console.warn("[gcal-busy] oauth lookup failed", (e as Error).message);
    }
  }
  const oauthByStaff = new Map(oauthRows.map(r => [r.staff_id, r]));

  // OAuth path (per staff, parallel).
  const oauthStaff = staff.filter(s => oauthByStaff.has(s.id));
  await Promise.all(oauthStaff.map(async (s) => {
    const row = oauthByStaff.get(s.id)!;
    const busy = await fetchOAuthBusy(supa, row, startIso, endIso);
    if (busy.length) out.set(s.id, busy);
  }));

  // Gateway fallback for staff without OAuth rows.
  const fallbackStaff = staff.filter(s => !oauthByStaff.has(s.id));
  if (fallbackStaff.length > 0) {
    const fbMap = await fetchGatewayBusy(fallbackStaff, startIso, endIso);
    for (const [k, v] of fbMap) out.set(k, v);
  }

  return out;
}
