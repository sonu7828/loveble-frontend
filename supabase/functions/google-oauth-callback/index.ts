// Handles the Google OAuth redirect, exchanges code for tokens, and persists
// them to `staff_google_oauth` for the staff member identified in `state`.
// On success redirects back to the app (or a default profile URL).

import { createClient } from "npm:@supabase/supabase-js@2";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

function htmlResponse(status: number, message: string, returnUrl?: string) {
  const safeReturn = returnUrl && /^https?:\/\//.test(returnUrl) ? returnUrl : "";
  // On success, do an immediate server-side redirect so the user never sees raw markup.
  if (status === 200 && safeReturn) {
    const url = new URL(safeReturn);
    url.searchParams.set("gcal", "connected");
    return new Response(null, { status: 302, headers: { Location: url.toString() } });
  }
  const fallback = safeReturn || "https://bookrka.com/staff/me";
  const redirectScript = `<script>setTimeout(() => { window.location.href = ${JSON.stringify(fallback)}; }, 2500);</script>`;
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Google Calendar</title>
     <style>body{font-family:-apple-system,system-ui,sans-serif;max-width:520px;margin:80px auto;padding:24px;text-align:center;color:#222}</style>
     </head><body><h2>${status === 200 ? "Connected" : "Connection failed"}</h2><p>${message}</p><p><a href="${fallback}">Return to app</a></p>${redirectScript}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff" } },
  );
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) return htmlResponse(400, `Google returned: ${errorParam}`);
    if (!code || !stateRaw) return htmlResponse(400, "Missing code or state.");

    let state: { staff_id?: string; user_id?: string; return_url?: string } = {};
    try { state = JSON.parse(atob(stateRaw)); } catch { return htmlResponse(400, "Invalid state."); }
    if (!state.staff_id) return htmlResponse(400, "Invalid state (no staff).");

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
    if (!clientId || !clientSecret) return htmlResponse(500, "Google OAuth not configured.", state.return_url);

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth-callback`;

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      console.error("[google-oauth-callback] token exchange failed", tokenRes.status, t);
      return htmlResponse(400, "Token exchange failed.", state.return_url);
    }
    const tok = await tokenRes.json();
    const accessToken: string = tok.access_token;
    const refreshToken: string | null = tok.refresh_token ?? null;
    const expiresIn: number = tok.expires_in ?? 3600;
    const scope: string = tok.scope ?? "";

    // Fetch user email for display.
    let googleEmail = "";
    try {
      const uRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (uRes.ok) {
        const u = await uRes.json();
        googleEmail = (u.email ?? "").toLowerCase();
      }
    } catch { /* ignore */ }

    const expiresAt = new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Upsert oauth row. Preserve existing refresh_token if Google didn't send one.
    const { data: existing } = await admin
      .from("staff_google_oauth")
      .select("refresh_token")
      .eq("staff_id", state.staff_id)
      .maybeSingle();

    const finalRefresh = refreshToken ?? existing?.refresh_token ?? null;

    const { error: upErr } = await admin
      .from("staff_google_oauth")
      .upsert({
        staff_id: state.staff_id,
        google_email: googleEmail || "unknown",
        access_token: accessToken,
        refresh_token: finalRefresh,
        token_expires_at: expiresAt,
        scope,
        calendar_id: "primary",
        last_refreshed_at: new Date().toISOString(),
      }, { onConflict: "staff_id" });

    if (upErr) {
      console.error("[google-oauth-callback] upsert failed", upErr);
      return htmlResponse(500, "Could not save calendar connection.", state.return_url);
    }

    // Best-effort: mirror the connected email onto staff_profiles.calendar_email
    // so legacy code paths and admin views see it.
    if (googleEmail) {
      await admin.from("staff_profiles")
        .update({ calendar_email: googleEmail } as any)
        .eq("id", state.staff_id);
    }

    return htmlResponse(200, `Connected ${googleEmail || "Google Calendar"}. You can close this tab.`, state.return_url);
  } catch (e) {
    console.error("[google-oauth-callback] error", e);
    return htmlResponse(500, "Unexpected error.");
  }
});
