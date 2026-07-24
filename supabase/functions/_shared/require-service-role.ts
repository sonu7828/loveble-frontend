// Shared helper: require a service-role-claim bearer token on cron endpoints.
// Returns a Response (401/403) if rejected, or null if the caller is authorized.
// Use at the top of cron-only edge functions:
//   const denied = requireServiceRole(req, corsHeaders);
//   if (denied) return denied;

function parseJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const padded = part + "=".repeat((4 - (part.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function requireServiceRole(
  req: Request,
  corsHeaders: Record<string, string>,
): Response | null {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = auth.slice("Bearer ".length).trim();
  // Accept the raw service-role key (used by pg_cron / Supabase internals)
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey && token === serviceKey) return null;
  // Or a JWT whose role claim is service_role
  const claims = parseJwtClaims(token);
  if (claims && (claims as { role?: string }).role === "service_role") return null;
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
