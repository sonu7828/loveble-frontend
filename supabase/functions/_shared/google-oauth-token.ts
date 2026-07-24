// Shared helper: get a valid Google OAuth access token for a staff member,
// refreshing it via their stored refresh_token if it has expired.

const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

export interface StaffOAuthRow {
  staff_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string;
  calendar_id: string | null;
}

export async function loadStaffOAuth(supa: any, staffId: string): Promise<StaffOAuthRow | null> {
  const { data } = await supa
    .from("staff_google_oauth")
    .select("staff_id, access_token, refresh_token, token_expires_at, calendar_id")
    .eq("staff_id", staffId)
    .maybeSingle();
  return (data as StaffOAuthRow) || null;
}

async function refreshAccessToken(supa: any, row: StaffOAuthRow): Promise<string | null> {
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
      console.warn("[gcal-token] refresh failed", res.status, (await res.text()).slice(0, 200));
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
    console.warn("[gcal-token] refresh error", (e as Error).message);
    return null;
  }
}

export async function getValidStaffAccessToken(supa: any, staffId: string): Promise<{ token: string; calendarId: string } | null> {
  const row = await loadStaffOAuth(supa, staffId);
  if (!row) return null;
  const expiry = new Date(row.token_expires_at).getTime();
  const token = expiry - Date.now() > 30_000
    ? row.access_token
    : await refreshAccessToken(supa, row);
  if (!token) return null;
  return { token, calendarId: row.calendar_id || "primary" };
}
