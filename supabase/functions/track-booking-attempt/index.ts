// Records/updates a booking attempt so we can recover abandoned bookings.
// Public — uses session_id (client-generated UUID) as the key. No auth required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.sessionId ?? "").trim();
    if (!/^[0-9a-f-]{32,40}$/i.test(sessionId)) return json({ error: "Invalid sessionId" }, 400);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const completed = body?.completed === true;

    const row: Record<string, unknown> = {
      session_id: sessionId,
      updated_at: new Date().toISOString(),
    };
    if (typeof body?.email === "string") row.email = body.email.toLowerCase().trim() || null;
    if (typeof body?.firstName === "string") row.first_name = body.firstName.trim() || null;
    if (typeof body?.lastName === "string") row.last_name = body.lastName.trim() || null;
    if (typeof body?.phone === "string") row.phone = body.phone.trim() || null;
    if (typeof body?.serviceId === "string") row.service_id = body.serviceId || null;
    if (typeof body?.locationId === "string") row.location_id = body.locationId || null;
    if (typeof body?.staffId === "string") row.staff_id = body.staffId || null;
    if (typeof body?.intendedStartAt === "string") row.intended_start_at = body.intendedStartAt;
    if (completed) row.completed_at = new Date().toISOString();

    const { error } = await supa.from("booking_attempts")
      .upsert(row, { onConflict: "session_id" });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
