// Scheduled: runs every 30 min.
// 1) Sends pre-appointment consent reminder emails at each tier in
//    app_settings.consent_reminder_schedule (default {72,48,24}).
// 2) Generic auto-resend: if a required consent has never been emailed or the
//    last reminder is older than `consent_reminder_hours`, send another.
// In both passes we use computeMissingConsents so previously-signed (valid) forms
// are never re-requested. All sends are idempotent via idempotencyKey.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { computeMissingConsents } from "../_shared/consent-validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings } = await supa
      .from("app_settings")
      .select("consent_reminder_hours, consent_max_reminders, consent_reminder_schedule")
      .eq("id", 1)
      .maybeSingle();
    const reminderHours = Math.max(1, Number(settings?.consent_reminder_hours ?? 24));
    const maxReminders = Math.max(1, Number(settings?.consent_max_reminders ?? 3));
    const schedule: number[] = Array.isArray(settings?.consent_reminder_schedule) && settings!.consent_reminder_schedule.length
      ? settings!.consent_reminder_schedule
      : [72, 48, 24];

    const now = Date.now();
    let totalSent = 0;
    const results: any[] = [];

    // ===== Pass A: pre-appointment buckets (e.g., 72h / 48h / 24h) =====
    // Each cron tick is 30min; use ±30min window so each appt hits exactly once per tier.
    const buckets = schedule.map((h) => ({
      label: `${h}h`,
      start: now + (h * 60 - 15) * 60_000,
      end: now + (h * 60 + 15) * 60_000,
      hoursUntil: h,
    }));

    for (const b of buckets) {
      const { data: appts } = await supa
        .from("appointments")
        .select("id, public_token, client_email, client_first_name, start_at, status, service_id")
        .in("status", ["approved", "pending"])
        .gte("start_at", new Date(b.start).toISOString())
        .lt("start_at", new Date(b.end).toISOString());

      for (const appt of appts ?? []) {
        if (!appt.client_email) continue;

        // Pull service ids (multi-service) + main service fallback
        const { data: apsv } = await supa
          .from("appointment_services")
          .select("service_id")
          .eq("appointment_id", appt.id);
        const serviceIds = ((apsv ?? []) as any[]).map((r) => r.service_id).filter(Boolean);
        if (!serviceIds.length && appt.service_id) serviceIds.push(appt.service_id);

        const { satisfied, missing } = await computeMissingConsents(supa, {
          clientEmail: appt.client_email,
          serviceIds,
          appointmentId: appt.id,
        });
        // Flip any already-satisfied assigned rows to signed=true
        const satisfiedIds = [...satisfied.keys()];
        if (satisfiedIds.length) {
          await supa.from("appointment_consents").update({ signed: true })
            .eq("appointment_id", appt.id).in("consent_form_id", satisfiedIds).eq("signed", false);
        }
        const stillMissing = missing.filter((f) => !f.is_optional);
        if (stillMissing.length === 0) continue;

        // Ensure every still-missing form has an assignment row (so the sign page shows them)
        await supa.from("appointment_consents").upsert(
          stillMissing.map((f) => ({
            appointment_id: appt.id,
            consent_form_id: f.id,
            sent_to_email: appt.client_email,
            signed: false,
          })),
          { onConflict: "appointment_id,consent_form_id" },
        );


        const formList = stillMissing.map((f) => `• ${f.title}`).join("\n");
        const signUrl = `https://bookrka.com/consents/${appt.public_token}`;
        const appointmentTime = new Date(appt.start_at).toLocaleString("en-US", {
          weekday: "short", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
        });

        const idemKey = `consent-reminder-${appt.id}-${b.label}`;
        const logRows = stillMissing.map((f) => ({
          appointment_id: appt.id,
          consent_form_id: f.id,
          recipient_email: appt.client_email,
          template_name: "consent-reminder",
          source: `pre-appointment-${b.label}`,
          idempotency_key: idemKey,
          forms_count: stillMissing.length,
          metadata: { hours_until: b.hoursUntil, form_title: f.title },
        }));
        try {
          await supa.functions.invoke("send-transactional-email", {
            body: {
              templateName: "consent-reminder",
              recipientEmail: appt.client_email,
              idempotencyKey: idemKey,
              templateData: {
                clientFirstName: appt.client_first_name,
                signUrl, formList, appointmentTime,
                hoursUntil: b.hoursUntil,
              },
            },
          });
          totalSent++;
          results.push({ pass: "pre", appointmentId: appt.id, bucket: b.label, missing: stillMissing.length });

          // Touch ALL appointment_consents rows for the missing forms (so reminder_count advances)
          const missingIds = stillMissing.map((f) => f.id);
          const { data: rows } = await supa
            .from("appointment_consents")
            .select("id, reminder_count")
            .eq("appointment_id", appt.id)
            .in("consent_form_id", missingIds);
          for (const r of rows ?? []) {
            await supa
              .from("appointment_consents")
              .update({
                last_reminded_at: new Date().toISOString(),
                reminder_count: (r.reminder_count ?? 0) + 1,
                sent_to_email: appt.client_email,
              })
              .eq("id", r.id);
          }
          await supa.from("consent_email_log").insert(logRows);
        } catch (e) {
          console.error("reminder send failed", appt.id, b.label, e);
          await supa.from("consent_email_log").insert(
            logRows.map((r) => ({ ...r, status: "failed", error_message: String((e as Error).message ?? e) }))
          );
        }
      }
    }

    // ===== Pass B: generic auto-resend for stale unsigned consents =====
    const cutoffIso = new Date(now - reminderHours * 60 * 60_000).toISOString();
    const nowIso = new Date(now).toISOString();

    const { data: stale } = await supa
      .from("appointment_consents")
      .select(`
        id, appointment_id, consent_form_id, sent_to_email, last_reminded_at, reminder_count,
        appointments!inner(id, public_token, client_email, client_first_name, start_at, status, service_id)
      `)
      .eq("signed", false)
      .lt("reminder_count", maxReminders)
      .in("appointments.status", ["pending", "approved"])
      .gte("appointments.start_at", nowIso)
      .or(`sent_to_email.is.null,last_reminded_at.is.null,last_reminded_at.lt.${cutoffIso}`);

    const byAppt = new Map<string, any[]>();
    for (const row of stale ?? []) {
      if (!byAppt.has(row.appointment_id)) byAppt.set(row.appointment_id, []);
      byAppt.get(row.appointment_id)!.push(row);
    }

    for (const [apptId, rows] of byAppt) {
      const appt = (rows[0] as any).appointments;
      if (!appt?.client_email) continue;

      // Pull service ids + recompute missing using validation helper
      const { data: apsv } = await supa
        .from("appointment_services")
        .select("service_id")
        .eq("appointment_id", apptId);
      const serviceIds = ((apsv ?? []) as any[]).map((r) => r.service_id).filter(Boolean);
      if (!serviceIds.length && appt.service_id) serviceIds.push(appt.service_id);

      const { satisfied, missing } = await computeMissingConsents(supa, {
        clientEmail: appt.client_email,
        serviceIds,
        appointmentId: apptId,
      });

      // (1) Sync: any assigned row that is actually satisfied by a prior valid
      // signature should be flipped to signed=true so we stop reminding on it.
      const satisfiedIds = new Set<string>([...satisfied.keys()]);
      const rowsToMarkSigned = rows.filter((r: any) => satisfiedIds.has(r.consent_form_id));
      if (rowsToMarkSigned.length) {
        await supa.from("appointment_consents").update({ signed: true })
          .in("id", rowsToMarkSigned.map((r: any) => r.id));
      }

      const stillMissing = missing.filter((f) => !f.is_optional);
      if (stillMissing.length === 0) continue;

      // (2) Ensure every still-missing form has an appointment_consents row so the
      // sign page actually shows something when the client clicks the link.
      const missingFormIds = stillMissing.map((f) => f.id);
      const { data: existingAssigned } = await supa
        .from("appointment_consents")
        .select("consent_form_id")
        .eq("appointment_id", apptId)
        .in("consent_form_id", missingFormIds);
      const existingIds = new Set((existingAssigned ?? []).map((r: any) => r.consent_form_id));
      const toInsert = stillMissing.filter((f) => !existingIds.has(f.id));
      if (toInsert.length) {
        await supa.from("appointment_consents").upsert(
          toInsert.map((f) => ({
            appointment_id: apptId,
            consent_form_id: f.id,
            sent_to_email: appt.client_email,
            signed: false,
          })),
          { onConflict: "appointment_id,consent_form_id" },
        );
      }

      const startMs = new Date(appt.start_at).getTime();
      const hoursUntil = Math.round((startMs - now) / 3_600_000);
      const formList = stillMissing.map((f) => `• ${f.title}`).join("\n");
      const signUrl = `https://bookrka.com/consents/${appt.public_token}`;
      const appointmentTime = new Date(appt.start_at).toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
      });

      const nextCount = Math.max(...rows.map((r: any) => r.reminder_count ?? 0)) + 1;
      const idemKey = `consent-autoresend-${apptId}-${nextCount}`;
      const logRows = stillMissing.map((f) => ({
        appointment_id: apptId,
        consent_form_id: f.id,
        recipient_email: appt.client_email,
        template_name: "consent-reminder",
        source: "auto-resend",
        idempotency_key: idemKey,
        reminder_number: nextCount,
        forms_count: stillMissing.length,
        metadata: { hours_until: Math.max(0, hoursUntil), form_title: f.title },
      }));


      try {
        await supa.functions.invoke("send-transactional-email", {
          body: {
            templateName: "consent-reminder",
            recipientEmail: appt.client_email,
            idempotencyKey: idemKey,
            templateData: {
              clientFirstName: appt.client_first_name,
              signUrl, formList, appointmentTime,
              hoursUntil: Math.max(0, hoursUntil),
            },
          },
        });
        totalSent++;
        results.push({ pass: "auto", appointmentId: apptId, reminderNumber: nextCount, missing: stillMissing.length });

        const ids = rows.map((r: any) => r.id);
        await supa
          .from("appointment_consents")
          .update({
            last_reminded_at: new Date().toISOString(),
            reminder_count: nextCount,
            sent_to_email: appt.client_email,
          })
          .in("id", ids);
        await supa.from("consent_email_log").insert(logRows);
      } catch (e) {
        console.error("auto-resend send failed", apptId, e);
        await supa.from("consent_email_log").insert(
          logRows.map((r) => ({ ...r, status: "failed", error_message: String((e as Error).message ?? e) }))
        );
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent: totalSent, schedule, reminderHours, maxReminders, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
