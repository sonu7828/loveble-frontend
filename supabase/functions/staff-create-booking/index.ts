// Staff-only manual booking. Authenticated staff/scheduler/admin create an appointment
// directly as approved. Optionally attaches a Stripe customer + payment method captured
// via a SetupIntent on the client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { invokeServiceFunction } from "../_shared/function-invoke.ts";
import { computeMissingConsents, logValidation } from "../_shared/consent-validation.ts";
import { hasTelevisit, televisitLocationName, TELEVISIT_ARRIVAL_INSTRUCTIONS, TELEVISIT_ADDRESS_LINE } from "../_shared/televisit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: priv } = await supa.rpc("is_scheduler_or_admin", { _user_id: user.id });
    let allowedStaffId: string | null = null;
    if (!priv) {
      const { data: sp } = await supa.from("staff_profiles").select("id").eq("user_id", user.id).maybeSingle();
      if (!sp) return json({ error: "Forbidden" }, 403);
      allowedStaffId = sp.id;
    }

    const b = await req.json();
    // Accept either a single serviceId or array of serviceIds (first is primary).
    const serviceIds: string[] = Array.isArray(b?.serviceIds) && b.serviceIds.length > 0
      ? b.serviceIds.filter((x: any) => typeof x === "string" && x)
      : (b?.serviceId ? [b.serviceId] : []);
    const primaryServiceId = serviceIds[0];
    const required = [primaryServiceId, b?.staffId, b?.locationId, b?.startAt,
      b?.client?.firstName, b?.client?.lastName, b?.client?.email, b?.client?.phone];
    if (required.some((v) => !v)) return json({ error: "Missing required fields" }, 400);
    if (allowedStaffId && b.staffId !== allowedStaffId) return json({ error: "Can only book for yourself" }, 403);

    const email = String(b.client.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email" }, 400);

    const { data: svcs } = await supa.from("services")
      .select("id, duration_minutes, buffer_minutes, name").in("id", serviceIds);
    if (!svcs || svcs.length !== serviceIds.length) return json({ error: "One or more services not found" }, 404);
    // Preserve ordering as supplied
    const svcMap = new Map(svcs.map((s: any) => [s.id, s]));
    const orderedSvcs = serviceIds.map((id) => svcMap.get(id)!);
    const svc = orderedSvcs[0];

    const startMs = new Date(b.startAt).getTime();
    if (!Number.isFinite(startMs)) return json({ error: "Invalid start time" }, 400);
    const totalMinutes = orderedSvcs.reduce((sum: number, s: any) => sum + (s.duration_minutes + (s.buffer_minutes ?? 0)), 0);
    const endMs = startMs + totalMinutes * 60 * 1000;

    const dayStart = localDateToUtc(ptDateString(new Date(startMs)), 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
    const [{ data: schedules }, { data: overrides }] = await Promise.all([
      supa.from("weekly_schedules")
        .select("*")
        .eq("staff_id", b.staffId)
        .eq("location_id", b.locationId)
        .eq("day_of_week", dowInPT(new Date(startMs))),
      supa.from("schedule_overrides")
        .select("*")
        .eq("staff_id", b.staffId)
        .gte("end_at", dayStart.toISOString())
        .lt("start_at", dayEnd.toISOString()),
    ]);
    const blocks = (overrides ?? []).filter((o: any) => o.override_type === "block" && (!o.location_id || o.location_id === b.locationId))
      .map((o: any) => [new Date(o.start_at).getTime(), new Date(o.end_at).getTime()] as [number, number]);
    const extras = (overrides ?? []).filter((o: any) => o.override_type === "extra_availability" && (!o.location_id || o.location_id === b.locationId))
      .map((o: any) => [new Date(o.start_at).getTime(), new Date(o.end_at).getTime()] as [number, number]);
    const windows: [number, number][] = [
      ...(schedules ?? []).filter((s: any) => scheduleAppliesOnDate(s, ptDateString(new Date(startMs)))).map((s: any) => {
        const [sh, sm] = s.start_time.split(":").map(Number);
        const [eh, em] = s.end_time.split(":").map(Number);
        return [
          localDateToUtc(ptDateString(new Date(startMs)), sh, sm).getTime(),
          localDateToUtc(ptDateString(new Date(startMs)), eh, em).getTime(),
        ] as [number, number];
      }),
      ...extras,
    ];
    const fitsAvailability = windows.some(([ws, we]) => startMs >= ws && endMs <= we)
      && !blocks.some(([bs, be]) => startMs < be && endMs > bs);

    // Admins and schedulers may intentionally override conflicts or availability. Everyone else must use open slots.
    const { data: canOverrideRpc } = await supa.rpc("is_scheduler_or_admin", { _user_id: user.id });
    const canOverride = Boolean(canOverrideRpc && b.overrideConflict === true);
    if (!canOverride) {
      if (!fitsAvailability) {
        return json({ error: "Time slot is outside this provider's available schedule. Only admins or schedulers can override availability." }, 409);
      }
      const { data: conflicts } = await supa
        .from("appointments")
        .select("id")
        .eq("staff_id", b.staffId)
        .in("status", ["pending", "approved"])
        .lt("start_at", new Date(endMs).toISOString())
        .gt("end_at", new Date(startMs).toISOString())
        .limit(1);
      if (conflicts && conflicts.length > 0) {
        return json({ error: "Time slot conflicts with an existing appointment. Only admins or schedulers can double-book." }, 409);
      }
    }

    let inserted: { id: string; public_token: string } | null = null;
    let insErr: any = null;
    if (canOverride) {
      const { data, error } = await userClient.rpc("force_create_appointment", {
        p_service_id: primaryServiceId,
        p_staff_id: b.staffId,
        p_location_id: b.locationId,
        p_start_at: new Date(startMs).toISOString(),
        p_end_at: new Date(endMs).toISOString(),
        p_client_first_name: String(b.client.firstName).trim(),
        p_client_last_name: String(b.client.lastName).trim(),
        p_client_email: email,
        p_client_phone: String(b.client.phone).trim(),
        p_client_dob: b.client.dob || null,
        p_client_notes: (b.client.notes || "").trim() || null,
        p_stripe_customer_id: b.stripeCustomerId || null,
        p_stripe_payment_method_id: b.stripePaymentMethodId || null,
        p_stripe_setup_intent_id: b.stripeSetupIntentId || null,
      });
      inserted = Array.isArray(data) ? data[0] : data;
      insErr = error;
    } else {
      const { data, error } = await supa.from("appointments").insert({
        service_id: primaryServiceId, staff_id: b.staffId, location_id: b.locationId,
        start_at: new Date(startMs).toISOString(), end_at: new Date(endMs).toISOString(),
        client_first_name: String(b.client.firstName).trim(),
        client_last_name: String(b.client.lastName).trim(),
        client_email: email,
        client_phone: String(b.client.phone).trim(),
        client_dob: b.client.dob || null,
        client_notes: (b.client.notes || "").trim() || null,
        stripe_customer_id: b.stripeCustomerId || null,
        stripe_payment_method_id: b.stripePaymentMethodId || null,
        stripe_setup_intent_id: b.stripeSetupIntentId || null,
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      }).select("id, public_token").single();
      inserted = data;
      insErr = error;
    }
    if (insErr) return json({ error: insErr.message }, /overlapping appointment/i.test(insErr.message ?? "") ? 409 : 500);
    if (!inserted) return json({ error: "Appointment could not be created" }, 500);

    // Insert appointment_services rows for all services
    await supa.from("appointment_services").insert(
      orderedSvcs.map((s: any, i: number) => ({
        appointment_id: inserted.id,
        service_id: s.id,
        duration_minutes: s.duration_minutes + (s.buffer_minutes ?? 0),
        display_order: i,
      }))
    );

    // Auto-save card on file when staff captured one via SetupIntent
    if (b.stripeCustomerId && b.stripePaymentMethodId) {
      try {
        const { saveCardOnFile } = await import("../_shared/save-card-on-file.ts");
        const { currentEnv } = await import("../_shared/stripe.ts");
        await saveCardOnFile(supa, currentEnv(), {
          clientEmail: email,
          stripeCustomerId: b.stripeCustomerId,
          stripePaymentMethodId: b.stripePaymentMethodId,
          addedBy: user.id,
          cardholderName: `${b.client.firstName} ${b.client.lastName}`.trim(),
        });
      } catch (e) { console.error("auto-save card failed", e); }
    }



    // Auto-assign required consent forms (universal + per-service) and email signing link.
    // Uses centralized validation so prior valid signatures from earlier appointments satisfy
    // annual/perpetual consents without forcing re-signature.
    try {
      const result = await computeMissingConsents(supa, {
        clientEmail: email,
        serviceIds,
        appointmentId: inserted.id,
      });
      await logValidation(supa, {
        appointmentId: inserted.id,
        clientEmail: email,
        result,
        source: "staff-create-booking",
      });

      if (result.requiredForms.length) {
        await supa.from("appointment_consents").upsert(
          result.requiredForms.map((f) => ({
            appointment_id: inserted.id,
            consent_form_id: f.id,
            assigned_by: user.id,
            sent_to_email: email,
            signed: result.satisfied.has(f.id),
          })),
          { onConflict: "appointment_id,consent_form_id", ignoreDuplicates: true }
        );

        if (result.missing.length) {
          const origin = req.headers.get("origin") || "https://bookrka.com";
          const signUrl = `${origin}/consents/${inserted.public_token}`;
          const formList = result.missing.map((f) => `• ${f.title}`).join("\n");
          const idemKey = `consent-assign-${inserted.id}-${result.missing.map((f) => f.id).sort().join("-")}`;
          const logRows = result.missing.map((f) => ({
            appointment_id: inserted.id,
            consent_form_id: f.id,
            recipient_email: email,
            template_name: "consent-assignment",
            source: "staff-create-booking",
            idempotency_key: idemKey,
            forms_count: result.missing.length,
            metadata: { form_title: f.title, reason: "missing_or_expired" },
          }));
          try {
            await invokeServiceFunction("send-transactional-email", {
              templateName: "consent-assignment",
              recipientEmail: email,
              idempotencyKey: idemKey,
              templateData: { clientFirstName: b.client.firstName, signUrl, formList },
            });
            await supa.from("consent_email_log").insert(logRows);
          } catch (e) {
            console.error("consent assign email failed", e);
            await supa.from("consent_email_log").insert(
              logRows.map((r) => ({ ...r, status: "failed", error_message: String((e as Error).message ?? e) }))
            );
          }
        }
      }
    } catch (e) { console.error("auto consent assign failed", e); }

    await supa.from("appointment_audit_log").insert({
      appointment_id: inserted.id,
      action: "manual_book",
      to_status: "approved",
      actor_user_id: user.id,
      notes: `Created manually by staff (${orderedSvcs.length} service${orderedSvcs.length > 1 ? "s" : ""})`,
    });

    // Send pre-visit intake link immediately (staff bookings are auto-approved)
    try {
      await invokeServiceFunction("send-intake-links", { appointmentId: inserted.id });
    } catch (e) { console.error("intake link send failed", e); }



    // Notify the assigned staff provider + admins (best effort)
    try {
      const [{ data: staff }, { data: loc }, { data: adminRows }] = await Promise.all([
        supa.from("staff_profiles").select("full_name, email").eq("id", b.staffId).maybeSingle(),
        supa.from("locations").select("name").eq("id", b.locationId).maybeSingle(),
        supa.from("user_roles").select("user_id").eq("role", "admin"),
      ]);
      const adminIds = (adminRows ?? []).map((r: any) => r.user_id);
      const recipients = new Map<string, string>();
      if (staff?.email) recipients.set(staff.email.toLowerCase(), staff.full_name ?? "Team");
      if (adminIds.length) {
        const { data: adminStaff } = await supa.from("staff_profiles")
          .select("email, full_name").in("user_id", adminIds);
        for (const s of adminStaff ?? []) {
          if (s.email && !recipients.has(s.email.toLowerCase())) {
            recipients.set(s.email.toLowerCase(), s.full_name ?? "Team");
          }
        }
      }
      const appointmentTime = new Date(startMs).toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
      });
      const origin = req.headers.get("origin") || "https://bookrka.com";
      const reviewUrl = `${origin}/staff/appointments/${inserted.id}`;
      const isTelevisit = hasTelevisit(orderedSvcs.map((s: any) => s.id));
      const baseLabel = orderedSvcs.map((s: any) => s.name).join(" + ");
      const serviceLabel = isTelevisit ? `TELEVISIT — ${baseLabel}` : baseLabel;
      await Promise.all([...recipients.entries()].map(([to, name]) =>
        invokeServiceFunction("send-transactional-email", {
          templateName: "staff-booking-notification",
          recipientEmail: to,
          idempotencyKey: `staff-notify-${inserted.id}-${to}`,
          templateData: {
            staffName: name,
            clientName: `${b.client.firstName} ${b.client.lastName}`.trim(),
            clientEmail: email,
            clientPhone: b.client.phone,
            serviceName: serviceLabel,
            appointmentTime,
            locationName: isTelevisit ? televisitLocationName(loc?.name) : (loc?.name ?? ""),
            reviewUrl,
          },
        }).catch((e) => console.error("staff notify failed", to, e))
      ));
    } catch (e) { console.error("staff notify outer failed", e); }

    // Send confirmation email to the client (staff-created bookings are auto-approved)
    try {
      const isTelevisit = hasTelevisit(orderedSvcs.map((s: any) => s.id));
      const baseLabel = orderedSvcs.map((s: any) => s.name).join(" + ");
      const { data: locFull } = await supa.from("locations")
        .select("name, address, city, state").eq("id", b.locationId).maybeSingle();
      const { data: stfFull } = await supa.from("staff_profiles")
        .select("full_name").eq("id", b.staffId).maybeSingle();
      const apptTimeStr = new Date(startMs).toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
      });
      const { getLocationArrival } = await import("../_shared/location-arrival.ts");
      const arrival = isTelevisit
        ? { address: TELEVISIT_ADDRESS_LINE, instructions: TELEVISIT_ARRIVAL_INSTRUCTIONS }
        : getLocationArrival({
            city: (locFull as any)?.city, name: locFull?.name,
            address: (locFull as any)?.address, state: (locFull as any)?.state,
          });
      await invokeServiceFunction("send-transactional-email", {
        templateName: "booking-approved",
        recipientEmail: email,
        idempotencyKey: `client-confirm-${inserted.id}`,
        templateData: {
          clientName: b.client.firstName,
          serviceName: isTelevisit ? `TELEVISIT — ${baseLabel}` : baseLabel,
          providerName: stfFull?.full_name ?? "",
          appointmentTime: apptTimeStr,
          locationAddress: arrival.address || (locFull ? `${locFull.address}, ${locFull.city}, ${locFull.state}` : ""),
          arrivalInstructions: arrival.instructions,
          manageUrl: `https://bookrka.com/booking/${inserted.public_token}`,
        },
      });
    } catch (e) { console.error("client confirm email failed", e); }

    // Best-effort calendar sync
    try {
      await invokeServiceFunction("google-calendar-sync", { appointmentId: inserted.id });
    } catch (e) { console.error("calendar sync failed", e); }

    // Best-effort GHL sync
    try {
      await supa.functions.invoke("ghl-sync-contact", {
        body: {
          email,
          firstName: b.client.firstName,
          lastName: b.client.lastName,
          phone: b.client.phone,
          dob: b.client.dob || undefined,
          source: "rkabook staff booking",
          tags: ["rkabook", "booking", "staff-created"],
        },
      });
    } catch (e) { console.error("ghl sync failed", e); }

    // Auto-send pre-op instructions (best-effort, idempotent)
    try {
      await invokeServiceFunction("send-pre-op-instructions", { appointmentId: inserted.id });
    } catch (e) { console.error("pre-op send failed", e); }

    return json({ id: inserted.id, token: inserted.public_token });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const TZ = "America/Los_Angeles";

function ptDateParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    weekday: "short",
  });
  return Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value])) as Record<string, string>;
}

function ptDateString(date: Date): string {
  const p = ptDateParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function localDateToUtc(dateStr: string, hh: number, mm: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  let guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  for (let i = 0; i < 3; i++) {
    const parts = ptDateParts(guess);
    const seen = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    const target = Date.UTC(y, m - 1, d, hh, mm);
    const drift = target - seen;
    if (drift === 0) break;
    guess = new Date(guess.getTime() + drift);
  }
  return guess;
}

function dowInPT(date: Date): number {
  const map: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  return map[ptDateParts(date).weekday] ?? 0;
}

function nthWeekdayOfMonth(dateStr: string): number {
  const [, , d] = dateStr.split("-").map(Number);
  return Math.floor((d - 1) / 7) + 1;
}

function weeksBetween(anchor: string, target: string): number {
  const a = localDateToUtc(anchor, 12, 0).getTime();
  const t = localDateToUtc(target, 12, 0).getTime();
  return Math.floor((t - a) / (7 * 86400 * 1000));
}

function scheduleAppliesOnDate(sched: any, dateStr: string): boolean {
  if (!sched.is_active) return false;
  if (sched.effective_from && dateStr < sched.effective_from) return false;
  if (dowInPT(localDateToUtc(dateStr, 12, 0)) !== sched.day_of_week) return false;
  if (sched.recurrence === "weekly") return true;
  if (sched.recurrence === "alternating_weeks") {
    if (!sched.anchor_date) return false;
    const w = weeksBetween(sched.anchor_date, dateStr);
    return w >= 0 && w % 2 === 0;
  }
  if (sched.recurrence === "nth_weekday_of_month") {
    const n = nthWeekdayOfMonth(dateStr);
    return Array.isArray(sched.weeks_of_month) && sched.weeks_of_month.includes(n);
  }
  return false;
}
