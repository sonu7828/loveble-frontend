// Scheduled (every 30 min) — sends email appointment reminders at each tier in
// app_settings.appointment_reminder_hours (default {72,24}). Dedupes via
// appointment_reminder_log (unique on appointment_id + reminder_hours + channel).
// GHL/SMS reminders are handled separately by ghl-sync-reminders.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getLocationArrival } from "../_shared/location-arrival.ts";
import { hasTelevisit, televisitLocationName, TELEVISIT_ARRIVAL_INSTRUCTIONS, TELEVISIT_ADDRESS_LINE } from "../_shared/televisit.ts";
import { requireServiceRole } from "../_shared/require-service-role.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const denied = requireServiceRole(req, corsHeaders);
  if (denied) return denied;
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settings } = await supa
      .from("app_settings")
      .select("appointment_reminder_hours")
      .eq("id", 1)
      .maybeSingle();
    const hoursTiers: number[] =
      Array.isArray(settings?.appointment_reminder_hours) && settings!.appointment_reminder_hours.length
        ? settings!.appointment_reminder_hours
        : [72, 24];

    const now = Date.now();
    let sent = 0;
    const results: any[] = [];

    for (const h of hoursTiers) {
      const start = new Date(now + (h * 60 - 30) * 60_000).toISOString();
      const end = new Date(now + (h * 60 + 30) * 60_000).toISOString();

      const { data: appts } = await supa
        .from("appointments")
        .select(
          "id, public_token, client_email, client_first_name, start_at, status, service_id, " +
          "services(name), staff_profiles(full_name), locations(name, address, city, state)"
        )
        .eq("status", "approved")
        .gte("start_at", start)
        .lte("start_at", end);

      const apptIds = (appts ?? []).map((a: any) => a.id);
      const apsvMap: Record<string, string[]> = {};
      const apsvIdsMap: Record<string, string[]> = {};
      if (apptIds.length) {
        const { data: apsvList } = await supa
          .from("appointment_services")
          .select("appointment_id, display_order, service_id, services(name)")
          .in("appointment_id", apptIds)
          .order("display_order", { ascending: true });
        for (const r of (apsvList ?? []) as any[]) {
          (apsvIdsMap[r.appointment_id] ||= []).push(r.service_id);
          const nm = r.services?.name;
          if (!nm) continue;
          (apsvMap[r.appointment_id] ||= []).push(nm);
        }
      }

      for (const a of appts ?? []) {
        if (!a.client_email) continue;

        // Skip if already sent for this tier
        const { data: existing } = await supa
          .from("appointment_reminder_log")
          .select("id")
          .eq("appointment_id", a.id)
          .eq("reminder_hours", h)
          .eq("channel", "email")
          .maybeSingle();
        if (existing) continue;

        const apptTime = new Date(a.start_at).toLocaleString("en-US", {
          weekday: "short", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
        });
        const loc: any = (a as any).locations;
        const locationAddress = loc ? `${loc.address}, ${loc.city}, ${loc.state}` : "";
        const allNames = apsvMap[a.id] ?? [];
        const allIds = apsvIdsMap[a.id] ?? (a.service_id ? [a.service_id] : []);
        const isTelevisit = hasTelevisit(allIds);
        const baseServiceName = allNames.length > 0 ? allNames.join(" + ") : ((a as any).services?.name ?? "your appointment");
        const combinedServiceName = isTelevisit ? `TELEVISIT — ${baseServiceName}` : baseServiceName;

        const arrival = isTelevisit
          ? { address: TELEVISIT_ADDRESS_LINE, instructions: TELEVISIT_ARRIVAL_INSTRUCTIONS }
          : getLocationArrival({
              city: loc?.city, name: loc?.name, address: loc?.address, state: loc?.state,
            });
        const idemKey = `appt-reminder-${a.id}-${h}h`;
        try {
          await supa.functions.invoke("send-transactional-email", {
            body: {
              templateName: "appointment-reminder",
              recipientEmail: a.client_email,
              idempotencyKey: idemKey,
              templateData: {
                clientFirstName: a.client_first_name,
                serviceName: combinedServiceName,
                providerName: (a as any).staff_profiles?.full_name ?? "",
                appointmentTime: apptTime,
                locationName: isTelevisit ? televisitLocationName(loc?.name) : (loc?.name ?? ""),
                locationAddress: arrival.address || locationAddress,
                arrivalInstructions: arrival.instructions,
                hoursUntil: h,
                manageUrl: `https://bookrka.com/booking/${a.public_token}`,
              },
            },
          });
          await supa.from("appointment_reminder_log").insert({
            appointment_id: a.id,
            reminder_hours: h,
            channel: "email",
            recipient: a.client_email,
            metadata: { idempotency_key: idemKey },
          });
          sent++;
          results.push({ id: a.id, tier: `${h}h` });
        } catch (e) {
          console.error("appt reminder failed", a.id, h, e);
          await supa.from("appointment_reminder_log").insert({
            appointment_id: a.id,
            reminder_hours: h,
            channel: "email",
            recipient: a.client_email,
            status: "failed",
            error_message: String((e as Error).message ?? e),
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, tiers: hoursTiers, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
