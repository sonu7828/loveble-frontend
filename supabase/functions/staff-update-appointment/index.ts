// Approve or deny an appointment as staff. Sends email to client. Optionally syncs to Google Calendar.
// Body: { appointmentId: string; action: "approve" | "deny"; reason?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { invokeServiceFunction } from "../_shared/function-invoke.ts";
import { computeMissingConsents, logValidation } from "../_shared/consent-validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { appointmentId, action, reason } = await req.json();
    if (!appointmentId || !["approve", "deny"].includes(action)) return json({ error: "Invalid input" }, 400);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Authorization: admin/scheduler OR owner of the appointment's staff_id
    const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", user.id);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isPriv = roleSet.has("admin") || roleSet.has("scheduler");

    const { data: appt } = await supa.from("appointments").select("*").eq("id", appointmentId).single();
    if (!appt) return json({ error: "Not found" }, 404);
    if (appt.status !== "pending") return json({ error: "Already actioned" }, 400);

    if (!isPriv) {
      const { data: sp } = await supa.from("staff_profiles").select("id").eq("id", appt.staff_id).eq("user_id", user.id).maybeSingle();
      if (!sp) return json({ error: "Forbidden" }, 403);
    }

    const fromStatus = appt.status;
    const newStatus = action === "approve" ? "approved" : "denied";

    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (action === "approve") {
      updates.approved_at = new Date().toISOString();
      updates.approved_by = user.id;
    } else {
      updates.denial_reason = reason ?? null;
    }

    const { error: uErr } = await supa.from("appointments").update(updates).eq("id", appointmentId);
    if (uErr) return json({ error: uErr.message }, 500);

    await supa.from("appointment_audit_log").insert({
      appointment_id: appointmentId,
      action: action === "approve" ? "approved" : "denied",
      from_status: fromStatus,
      to_status: newStatus,
      actor_user_id: user.id,
      notes: reason ?? null,
    });

    // Send client email
    const [{ data: svc }, { data: staff }, { data: loc }, { data: apsvList }] = await Promise.all([
      supa.from("services").select("name, duration_minutes, slug, service_categories(slug)").eq("id", appt.service_id).single(),
      supa.from("staff_profiles").select("full_name").eq("id", appt.staff_id).single(),
      supa.from("locations").select("name, address, city, state").eq("id", appt.location_id).single(),
      supa.from("appointment_services").select("display_order, services(name)").eq("appointment_id", appointmentId).order("display_order", { ascending: true }),
    ]);
    const allServiceNames = ((apsvList ?? []) as any[]).map((r) => r.services?.name).filter((n: any): n is string => !!n);
    const combinedServiceName = allServiceNames.length > 0 ? allServiceNames.join(" + ") : (svc?.name ?? "your appointment");

    let googleCalendarUrl: string | undefined;
    let icsUrl: string | undefined;
    if (action === "approve") {
      try {
        const start = new Date(appt.start_at);
        const end = new Date(appt.end_at);
        const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
        const title = `Radiantilyk Aesthetic — ${combinedServiceName}`;
        const where = loc ? `${loc.address}, ${loc.city}, ${loc.state}` : "";
        const desc = `Provider: ${staff?.full_name ?? ""}`;
        googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(desc)}&location=${encodeURIComponent(where)}`;
        const ics = [
          "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Radiantilyk Aesthetic//Booking//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",
          "BEGIN:VEVENT",
          `UID:${appointmentId}@rkabook`,
          `DTSTAMP:${fmt(new Date())}`,
          `DTSTART:${fmt(start)}`,
          `DTEND:${fmt(end)}`,
          `SUMMARY:${title}`,
          `DESCRIPTION:${desc}`,
          `LOCATION:${where}`,
          "END:VEVENT","END:VCALENDAR",
        ].join("\r\n");
        const path = `${appointmentId}.ics`;
        await supa.storage.from("calendar-invites").upload(path, new Blob([ics], { type: "text/calendar" }), { upsert: true, contentType: "text/calendar" });
        // Bucket is private; issue a long-lived signed URL (1 year) for the ICS link in the email.
        const { data: signed } = await supa.storage.from("calendar-invites").createSignedUrl(path, 60 * 60 * 24 * 365);
        icsUrl = signed?.signedUrl ?? "";
      } catch (e) { console.error("ics build failed", e); }
    }

    const { getLocationArrival } = await import("../_shared/location-arrival.ts");
    const arrival = getLocationArrival({
      city: (loc as any)?.city, name: loc?.name,
      address: (loc as any)?.address, state: (loc as any)?.state,
    });
    const templateData = {
      clientName: appt.client_first_name,
      clientFirstName: appt.client_first_name,
      serviceName: combinedServiceName,
      providerName: staff?.full_name ?? "",
      locationName: loc?.name ?? "",
      locationAddress: arrival.address || (loc ? `${loc.address}, ${loc.city}, ${loc.state}` : ""),
      arrivalInstructions: arrival.instructions,
      appointmentTime: appt.start_at ? new Date(appt.start_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }) : "",
      startAt: appt.start_at,
      endAt: appt.end_at,
      reason: reason ?? "",
      googleCalendarUrl,
      icsUrl,
      manageUrl: `https://bookrka.com/booking/${appt.public_token}`,
    };
    const isConsult = (svc?.slug === 'complimentary-consultation') ||
      ((svc as any)?.service_categories?.slug === 'consultations') ||
      /consultation/i.test(svc?.name ?? '');
    const templateName = action === "approve"
      ? (isConsult ? "consultation-approved" : "booking-approved")
      : (isConsult ? "consultation-denied" : "booking-denied");
    try {
      await invokeServiceFunction("send-transactional-email", {
        templateName,
        recipientEmail: appt.client_email,
        idempotencyKey: `${action}-${appointmentId}`,
        templateData,
      });
    } catch (e) {
      console.error("email send failed", e);
    }

    // Optional: Google Calendar sync if approved and provider has token
    if (action === "approve") {
      try {
        await invokeServiceFunction("google-calendar-sync", { appointmentId });
      } catch (e) {
        console.error("calendar sync failed", e);
      }
      // Immediately send the pre-visit intake link on approval (then cron resends every 24h)
      try {
        await invokeServiceFunction("send-intake-links", { appointmentId });
      } catch (e) {
        console.error("intake link send failed", e);
      }
    }

    // Auto-assign required consent forms on approval (idempotent), marking any
    // annual/perpetual forms already satisfied by prior valid signatures as signed.
    if (action === "approve") {
      try {
        const { data: apsv } = await supa
          .from("appointment_services")
          .select("service_id")
          .eq("appointment_id", appointmentId);
        const serviceIds = ((apsv ?? []) as any[]).map((r) => r.service_id).filter(Boolean);
        if (!serviceIds.length && appt.service_id) serviceIds.push(appt.service_id);
        const result = await computeMissingConsents(supa, {
          clientEmail: appt.client_email,
          serviceIds,
          appointmentId,
        });
        await logValidation(supa, {
          appointmentId,
          clientEmail: appt.client_email,
          result,
          source: "staff-update-appointment",
        });
        if (result.requiredForms.length) {
          const rows = result.requiredForms.map((f) => ({
            appointment_id: appointmentId,
            consent_form_id: f.id,
            assigned_by: user.id,
            sent_to_email: appt.client_email,
            signed: result.satisfied.has(f.id),
          }));
          await supa.from("appointment_consents")
            .upsert(rows, { onConflict: "appointment_id,consent_form_id" });
        }
      } catch (e) { console.error("auto-assign consents failed", e); }
    }

    // Sync to GoHighLevel for SMS workflows
    try {
      const apptTime = new Date(appt.start_at).toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
      });
      await supa.functions.invoke("ghl-sync-contact", {
        body: {
          email: appt.client_email,
          firstName: appt.client_first_name,
          lastName: appt.client_last_name,
          phone: appt.client_phone,
          tags: ["rkabook", action === "approve" ? "booking-approved" : "booking-denied", ...(action === "approve" ? ["confirmation"] : [])],
          customFields: action === "approve" ? {
            next_appointment_time: apptTime,
            next_appointment_service: svc?.name ?? "",
            next_appointment_staff: staff?.full_name ?? "",
            next_appointment_location: loc?.name ?? "",
          } : {},
        },
      });
    } catch (e) { console.error("ghl sync failed", e); }

    // Confirmation SMS (gated on appointment.sms_opt_in inside the function)
    if (action === "approve") {
      try {
        await supa.functions.invoke("sms-appointment-confirmation", {
          body: { appointmentId },
        });
      } catch (e) { console.error("confirmation sms failed", e); }
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
