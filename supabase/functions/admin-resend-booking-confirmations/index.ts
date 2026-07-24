import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { invokeServiceFunction } from "../_shared/function-invoke.ts";
import { getLocationArrival } from "../_shared/location-arrival.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await userClient.rpc("is_admin", { _user_id: uid });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const onlyAppointmentId: string | undefined = body?.appointmentId;
    const dryRun: boolean = body?.dryRun === true;

    const supa = createClient(supabaseUrl, serviceKey);
    const nowIso = new Date().toISOString();

    let q = supa.from("appointments")
      .select("id, public_token, client_email, client_first_name, start_at, status, staff_id, location_id")
      .gte("start_at", nowIso)
      .in("status", ["approved", "pending", "checked_in"]);
    if (onlyAppointmentId) q = q.eq("id", onlyAppointmentId);

    const { data: appts, error } = await q.order("start_at", { ascending: true });
    if (error) throw error;

    const results: any[] = [];
    let sent = 0, skipped = 0, failed = 0;

    for (const a of appts ?? []) {
      if (!a.client_email) { skipped++; continue; }

      // Get service names
      const { data: svcRows } = await supa.from("appointment_services")
        .select("display_order, services(name)").eq("appointment_id", a.id).order("display_order");
      const serviceName = (svcRows ?? []).map((r: any) => r.services?.name).filter(Boolean).join(" + ") || "Appointment";

      const [{ data: loc }, { data: stf }] = await Promise.all([
        supa.from("locations").select("name, address, city, state").eq("id", a.location_id).maybeSingle(),
        supa.from("staff_profiles").select("full_name").eq("id", a.staff_id).maybeSingle(),
      ]);

      const apptTimeStr = new Date(a.start_at).toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
      });

      const arrival = getLocationArrival({
        city: (loc as any)?.city, name: loc?.name,
        address: (loc as any)?.address, state: (loc as any)?.state,
      });
      const payload = {
        templateName: "booking-approved",
        recipientEmail: a.client_email,
        idempotencyKey: `client-confirm-resend-${a.id}-${Date.now()}`,
        templateData: {
          clientName: a.client_first_name,
          serviceName,
          providerName: stf?.full_name ?? "",
          appointmentTime: apptTimeStr,
          locationAddress: arrival.address || (loc ? `${loc.address}, ${loc.city}, ${loc.state}` : ""),
          arrivalInstructions: arrival.instructions,
          manageUrl: `https://bookrka.com/booking/${a.public_token}`,
        },
      };

      if (dryRun) {
        results.push({ id: a.id, email: a.client_email, dryRun: true });
        continue;
      }

      try {
        await invokeServiceFunction("send-transactional-email", payload);
        sent++;
        results.push({ id: a.id, email: a.client_email, ok: true });
      } catch (e: any) {
        failed++;
        results.push({ id: a.id, email: a.client_email, ok: false, error: e.message });
      }
    }

    return new Response(JSON.stringify({
      total: appts?.length ?? 0, sent, skipped, failed, results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
