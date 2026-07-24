// Creates a pending appointment as a guest booking. Validates inputs and rejects double-bookings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { invokeServiceFunction } from "../_shared/function-invoke.ts";
import { computeMissingConsents, computeExpiresAt, getDefaultValidityMonths, logValidation } from "../_shared/consent-validation.ts";
import { getLocationArrival } from "../_shared/location-arrival.ts";
import { hasTelevisit, televisitLocationName, TELEVISIT_ARRIVAL_INSTRUCTIONS, TELEVISIT_ADDRESS_LINE } from "../_shared/televisit.ts";


// Deposits removed: clients are not charged at booking. The card on file is only used for no-show fees.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  serviceId?: string;
  serviceIds?: string[];
  staffId: string;
  locationId: string;
  startAt: string; // ISO
  client: {
    firstName: string; lastName: string; email: string; phone: string;
    dob?: string; notes?: string; smsOptIn?: boolean; marketingOptIn?: boolean;
  };
  stripeCustomerId?: string;
  stripePaymentMethodId?: string;
  stripeSetupIntentId?: string;
  signatures?: Array<{
    consentFormId: string;
    formVersion: number;
    signedFullName: string;
    signaturePng: string; // data URL (empty when declining)
    decision?: "consent" | "decline";
  }>;
  referralCode?: string;
  rescheduleAppointmentId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const b = (await req.json()) as Body;
    const serviceIds: string[] = Array.isArray(b?.serviceIds) && b.serviceIds.length > 0
      ? b.serviceIds.filter((x: any) => typeof x === "string" && x)
      : (b?.serviceId ? [b.serviceId] : []);
    const primaryServiceId = serviceIds[0];
    const required = [primaryServiceId, b?.staffId, b?.locationId, b?.startAt,
      b?.client?.firstName, b?.client?.lastName, b?.client?.email, b?.client?.phone];
    if (required.some(v => !v)) return json({ error: "Missing required fields" }, 400);

    const email = String(b.client.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email" }, 400);
    if (b.client.firstName.length > 60 || b.client.lastName.length > 60) {
      return json({ error: "Name too long" }, 400);
    }
    if ((b.client.notes ?? "").length > 1000) return json({ error: "Notes too long" }, 400);

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      console.error("[create-booking] SUPABASE_SERVICE_ROLE_KEY missing — refusing to fall back to anon key");
      return json({ error: "Server misconfigured" }, 500);
    }
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
    );

    // Block list check
    const { data: blocked } = await supa.from("blocked_clients")
      .select("email").eq("email", email).maybeSingle();
    if (blocked) {
      return json({ error: "We're unable to book this appointment online. Please contact us at (408) 351-1873." }, 403);
    }

    const { data: svcRows, error: svcErr } = await supa
      .from("services").select("id, duration_minutes, buffer_minutes, name, price_cents, deposit_cents, promo_group").in("id", serviceIds);
    if (svcErr || !svcRows || svcRows.length !== serviceIds.length) return json({ error: "One or more services not found" }, 404);
    const svcMap = new Map(svcRows.map((s: any) => [s.id, s]));
    const orderedSvcs = serviceIds.map((id) => svcMap.get(id)!);
    const svc = orderedSvcs[0];

    const startMs = new Date(b.startAt).getTime();
    if (!Number.isFinite(startMs) || startMs < Date.now()) return json({ error: "Invalid start time" }, 400);
    const totalMinutes = orderedSvcs.reduce((sum: number, s: any) => sum + (s.duration_minutes + (s.buffer_minutes ?? 0)), 0);
    const endMs = startMs + totalMinutes * 60 * 1000;

    // AUTO-ROUTE: if the requested location doesn't match the provider's actual
    // schedule for that date, switch to the one they're actually working at.
    // Prevents online bookings landing at the wrong studio when a client only
    // sees one location in the public UI.
    try {
      const dateStr = ptDateString(new Date(startMs));
      const dayStart = localDateToUtc(dateStr, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
      const [{ data: schedsAll }, { data: ovAll }] = await Promise.all([
        supa.from("weekly_schedules").select("*")
          .eq("staff_id", b.staffId)
          .eq("day_of_week", dowInPT(new Date(startMs))),
        supa.from("schedule_overrides").select("*")
          .eq("staff_id", b.staffId)
          .gte("end_at", dayStart.toISOString())
          .lt("start_at", dayEnd.toISOString()),
      ]);
      const actualLocations = new Set<string>();
      for (const s of schedsAll ?? []) {
        if (!s.location_id) continue;
        if (scheduleAppliesOnDate(s, dateStr)) {
          const [sh, sm] = s.start_time.split(":").map(Number);
          const [eh, em] = s.end_time.split(":").map(Number);
          const ws = localDateToUtc(dateStr, sh, sm).getTime();
          const we = localDateToUtc(dateStr, eh, em).getTime();
          if (startMs >= ws && endMs <= we) actualLocations.add(s.location_id);
        }
      }
      for (const o of ovAll ?? []) {
        if (o.override_type !== "extra_availability" || !o.location_id) continue;
        const os = new Date(o.start_at).getTime();
        const oe = new Date(o.end_at).getTime();
        if (startMs >= os && endMs <= oe) actualLocations.add(o.location_id);
      }
      if (actualLocations.size > 0 && !actualLocations.has(b.locationId)) {
        // Prefer a location that also offers all selected services with this provider
        for (const cand of actualLocations) {
          const { data: candSps } = await supa.from("service_providers").select("service_id")
            .in("service_id", serviceIds).eq("staff_id", b.staffId).eq("location_id", cand);
          const candOffered = new Set((candSps ?? []).map((r: any) => r.service_id));
          if (serviceIds.every((id) => candOffered.has(id))) {
            console.log(`[create-booking] auto-routed location ${b.locationId} -> ${cand} for staff ${b.staffId} on ${dateStr}`);
            b.locationId = cand;
            break;
          }
        }
      }
    } catch (e) { console.error("[create-booking] auto-route failed", e); }

    // Verify mapping: provider must offer ALL selected services at this location
    const { data: sps } = await supa.from("service_providers").select("service_id")
      .in("service_id", serviceIds).eq("staff_id", b.staffId).eq("location_id", b.locationId);
    const offered = new Set((sps ?? []).map((r: any) => r.service_id));
    if (serviceIds.some((id) => !offered.has(id))) return json({ error: "Provider does not offer one or more selected services at this location" }, 400);


    // PROMO services: validate slot_at exists & is open in promo_slots
    const promoGroups = Array.from(new Set(orderedSvcs.map((s: any) => s.promo_group).filter(Boolean)));
    const isPromo = promoGroups.length > 0;
    if (isPromo) {
      if (promoGroups.length > 1 || orderedSvcs.some((s: any) => !s.promo_group)) {
        return json({ error: "Cannot combine promo and non-promo services" }, 400);
      }
    }

    let promoSlotId: string | null = null;
    let enforcePromoSlots = false;
    if (isPromo) {
      const { count: promoSlotCount } = await supa.from("promo_slots")
        .select("id", { count: "exact", head: true })
        .eq("promo_group", promoGroups[0])
        .eq("location_id", b.locationId);
      enforcePromoSlots = (promoSlotCount ?? 0) > 0;
    }

    if (isPromo && enforcePromoSlots) {
      // Promo groups with configured promo_slots are restricted to those exact slots.
      const { data: ps } = await supa.from("promo_slots")
        .select("id, slot_at, claimed_appointment_id")
        .eq("promo_group", promoGroups[0])
        .eq("location_id", b.locationId)
        .eq("slot_at", new Date(startMs).toISOString())
        .is("claimed_appointment_id", null)
        .limit(1);
      if (!ps || ps.length === 0) {
        return json({ error: "Promo slot no longer available" }, 409);
      }
      promoSlotId = ps[0].id;
      // Still block double-booking the same staff
      const { data: conflicts } = await supa.from("appointments")
        .select("id").eq("staff_id", b.staffId).in("status", ["pending", "approved"])
        .lt("start_at", new Date(endMs).toISOString())
        .gt("end_at", new Date(startMs).toISOString());
      if ((conflicts ?? []).length > 0) return json({ error: "Provider is busy at this time" }, 409);
    } else {
      // Promo groups without promo_slots (including Everesse July/package links) use
      // normal live availability so a time shown to clients can also be confirmed.
      const dateStr = ptDateString(new Date(startMs));
      const dayStart = localDateToUtc(dateStr, 0, 0);
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
        ...(schedules ?? []).filter((s: any) => scheduleAppliesOnDate(s, dateStr)).map((s: any) => {
          const [sh, sm] = s.start_time.split(":").map(Number);
          const [eh, em] = s.end_time.split(":").map(Number);
          return [localDateToUtc(dateStr, sh, sm).getTime(), localDateToUtc(dateStr, eh, em).getTime()] as [number, number];
        }),
        ...extras,
      ];
      const fitsAvailability = windows.some(([ws, we]) => startMs >= ws && endMs <= we)
        && !blocks.some(([bs, be]) => startMs < be && endMs > bs);
      if (!fitsAvailability) return json({ error: "Slot no longer available" }, 409);

      // Conflict check
      const { data: conflicts } = await supa.from("appointments")
        .select("id").eq("staff_id", b.staffId).in("status", ["pending", "approved"])
        .lt("start_at", new Date(endMs).toISOString())
        .gt("end_at", new Date(startMs).toISOString());
      if ((conflicts ?? []).length > 0) return json({ error: "Slot no longer available" }, 409);
    }

    // Centralized consent validation: returns which forms are required and which are
    // already satisfied by prior valid signatures for this client.
    const consentResult = await computeMissingConsents(supa, {
      clientEmail: email,
      serviceIds,
    });
    const requiredFormMap = new Map(consentResult.requiredForms.map((f) => [f.id, f]));
    const provided = new Map<string, NonNullable<typeof b.signatures>[number]>();
    for (const s of b.signatures ?? []) provided.set(s.consentFormId, s);

    // Validate any signatures the client did provide
    for (const [formId, form] of requiredFormMap) {
      const sig = provided.get(formId);
      if (sig) {
        if (sig.formVersion !== form.version) return json({ error: "Consent form was updated. Please re-sign." }, 409);
        if (!sig.signedFullName?.trim()) return json({ error: "Invalid signature data" }, 400);
        const decision = sig.decision === "decline" ? "decline" : "consent";
        if (decision === "decline" && !form.is_optional) {
          return json({ error: "This consent is required and cannot be declined" }, 400);
        }
        if (decision === "consent" && !sig.signaturePng?.startsWith("data:image/")) {
          return json({ error: "Invalid signature data" }, 400);
        }
      }
    }

    // For anything still missing AND not satisfied by a prior valid signature, reject
    const stillMissing = consentResult.missing
      .filter((f) => !provided.has(f.id))
      .map((f) => f.id);
    if (stillMissing.length) {
      return json({ error: "Required consents not signed", missing: stillMissing }, 400);
    }

    // Validate referral code (if provided): must exist, must not be self-referral
    let referralCode: string | null = null;
    const rawCode = (b.referralCode || "").trim().toUpperCase();
    if (rawCode && /^[A-Z0-9]{4,16}$/.test(rawCode)) {
      const { data: rc } = await supa.from("referral_codes")
        .select("owner_email").eq("code", rawCode).maybeSingle();
      if (rc && rc.owner_email.toLowerCase() !== email) {
        referralCode = rawCode;
      }
    }

    const { data: inserted, error: insErr } = await supa.from("appointments").insert({
      service_id: primaryServiceId, staff_id: b.staffId, location_id: b.locationId,
      start_at: new Date(startMs).toISOString(), end_at: new Date(endMs).toISOString(),
      client_first_name: b.client.firstName.trim(),
      client_last_name: b.client.lastName.trim(),
      client_email: email,
      client_phone: b.client.phone.trim(),
      client_dob: b.client.dob || null,
      client_notes: (b.client.notes || "").trim() || null,
      sms_opt_in: !!b.client.smsOptIn,
      sms_opt_in_at: b.client.smsOptIn ? new Date().toISOString() : null,
      stripe_customer_id: b.stripeCustomerId || null,
      stripe_payment_method_id: b.stripePaymentMethodId || null,
      stripe_setup_intent_id: b.stripeSetupIntentId || null,
      status: "pending",
      referral_code: referralCode,
    }).select("id, public_token").single();
    if (insErr) return json({ error: insErr.message }, 500);

    // Atomically claim the promo slot. If someone else claimed it first, roll back.
    if (isPromo && promoSlotId) {
      const { data: claimed, error: claimErr } = await supa.from("promo_slots")
        .update({ claimed_appointment_id: inserted!.id, claimed_at: new Date().toISOString() })
        .eq("id", promoSlotId)
        .is("claimed_appointment_id", null)
        .select("id");
      if (claimErr || !claimed || claimed.length === 0) {
        await supa.from("appointments").delete().eq("id", inserted!.id);
        return json({ error: "Promo slot was just taken by another client. Please pick a different time." }, 409);
      }
    }

    // Insert appointment_services rows for all selected services
    await supa.from("appointment_services").insert(
      orderedSvcs.map((s: any, i: number) => ({
        appointment_id: inserted!.id,
        service_id: s.id,
        duration_minutes: s.duration_minutes + (s.buffer_minutes ?? 0),
        display_order: i,
      }))
    );

    // Auto-save card on file when client captured one via SetupIntent during booking
    if (b.stripeCustomerId && b.stripePaymentMethodId) {
      try {
        const { saveCardOnFile } = await import("../_shared/save-card-on-file.ts");
        const { currentEnv } = await import("../_shared/stripe.ts");
        await saveCardOnFile(supa, currentEnv(), {
          clientEmail: email,
          stripeCustomerId: b.stripeCustomerId,
          stripePaymentMethodId: b.stripePaymentMethodId,
          cardholderName: `${b.client.firstName} ${b.client.lastName}`.trim(),
        });
      } catch (e) { console.error("auto-save card failed", e); }
    }



    // Persist new signatures (best effort — if it fails, roll back the appointment)
    const newSigs = (b.signatures ?? []).filter(s => requiredFormMap.has(s.consentFormId));
    if (newSigs.length) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
      const ua = req.headers.get("user-agent") || null;
      const defaultMonths = await getDefaultValidityMonths(supa);
      const now = new Date();
      const { error: sigErr } = await supa.from("consent_signatures").insert(
        newSigs.map(s => {
          const form = requiredFormMap.get(s.consentFormId)!;
          const isConsent = s.decision !== "decline";
          return {
            appointment_id: inserted!.id,
            consent_form_id: s.consentFormId,
            form_version: s.formVersion,
            client_email: email,
            signed_full_name: s.signedFullName.trim(),
            signature_png: isConsent ? s.signaturePng : null,
            decision: isConsent ? "consent" : "decline",
            ip_address: ip,
            user_agent: ua,
            expires_at: isConsent ? computeExpiresAt(form, defaultMonths, now) : null,
          };
        })
      );
      if (sigErr) {
        await supa.from("appointments").delete().eq("id", inserted!.id);
        return json({ error: `Could not save signatures: ${sigErr.message}` }, 500);
      }
    }

    // Audit: record the consent validation decision for this appointment
    await logValidation(supa, {
      appointmentId: inserted!.id,
      clientEmail: email,
      result: consentResult,
      source: "create-booking",
      extra: { providedSignatures: (b.signatures ?? []).map((s) => s.consentFormId) },
    });

    // Generate signed-consent PDF receipt and email a copy to the client (best effort)
    let pdfUrl: string | undefined;
    try {
      const pdfData = await invokeServiceFunction("generate-consent-pdf", { appointmentId: inserted!.id });
      pdfUrl = pdfData?.url;
    } catch (e) {
      console.error("consent pdf generation failed", e);
    }

    try {
      await invokeServiceFunction("send-transactional-email", {
        templateName: "consent-receipt",
        recipientEmail: email,
        idempotencyKey: `consent-receipt-${inserted!.id}`,
        templateData: {
          clientName: b.client.firstName,
          serviceName: orderedSvcs.map((s: any) => s.name).join(" + "),
          pdfUrl: pdfUrl ?? "",
        },
      });
    } catch (e) {
      console.error("consent email failed", e);
    }

    // Notify the assigned staff provider + admins (best effort)
    try {
      const [{ data: staff }, { data: loc }, { data: adminRows }] = await Promise.all([
        supa.from("staff_profiles").select("full_name, email").eq("id", b.staffId).maybeSingle(),
        supa.from("locations").select("name, address, city, state").eq("id", b.locationId).maybeSingle(),
        supa.from("user_roles").select("user_id").eq("role", "admin"),
      ]);
      const adminIds = (adminRows ?? []).map((r: any) => r.user_id);
      const recipients = new Map<string, string>(); // email -> name
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
      const reviewUrl = `${origin}/staff/appointments/${inserted!.id}`;

      const isTelevisit = hasTelevisit(orderedSvcs.map((s: any) => s.id));
      const serviceLabelForStaff = orderedSvcs.map((s: any) => s.name).join(" + ");

      await Promise.all([...recipients.entries()].map(([to, name]) =>
        invokeServiceFunction("send-transactional-email", {
          templateName: "staff-booking-notification",
          recipientEmail: to,
          idempotencyKey: `staff-notify-${inserted!.id}-${to}`,
          templateData: {
            staffName: name,
            clientName: `${b.client.firstName} ${b.client.lastName}`.trim(),
            clientEmail: email,
            clientPhone: b.client.phone,
            serviceName: isTelevisit ? `TELEVISIT — ${serviceLabelForStaff}` : serviceLabelForStaff,
            appointmentTime,
            locationName: isTelevisit ? televisitLocationName(loc?.name) : (loc?.name ?? ""),
            reviewUrl,
          },
        }).catch((e) => console.error("staff notify failed", to, e))
      ));

      // Booking-received confirmation to the client (best effort)
      try {
        const arrival = isTelevisit
          ? { address: TELEVISIT_ADDRESS_LINE, instructions: TELEVISIT_ARRIVAL_INSTRUCTIONS }
          : getLocationArrival({
              city: (loc as any)?.city, name: loc?.name,
              address: (loc as any)?.address, state: (loc as any)?.state,
            });
        await invokeServiceFunction("send-transactional-email", {
          templateName: "booking-received",
          recipientEmail: email,
          idempotencyKey: `booking-received-${inserted!.id}`,
          templateData: {
            clientName: b.client.firstName,
            serviceName: isTelevisit ? `TELEVISIT — ${serviceLabelForStaff}` : serviceLabelForStaff,
            requestedTime: appointmentTime,
            providerName: staff?.full_name ?? "",
            locationAddress: arrival.address,
            arrivalInstructions: arrival.instructions,
          },
        });
      } catch (e) {
        console.error("booking-received email failed", e);
      }
    } catch (e) {
      console.error("staff notify outer failed", e);
    }

    // Sync to Google Calendar (best-effort) so the booking shows up immediately,
    // even while still pending — staff can see incoming requests on their calendar.
    try {
      await invokeServiceFunction("google-calendar-sync", { appointmentId: inserted!.id });
    } catch (e) { console.error("calendar sync failed", e); }

    // Sync to GoHighLevel (best-effort)
    try {
      await supa.functions.invoke("ghl-sync-contact", {
        body: {
          email,
          firstName: b.client.firstName,
          lastName: b.client.lastName,
          phone: b.client.phone,
          dob: b.client.dob || undefined,
          source: "rkabook booking",
          tags: ["rkabook", "booking"],
        },
      });
    } catch (e) { console.error("ghl sync failed", e); }

    // Newsletter subscription (best-effort)
    if (b.client.marketingOptIn) {
      try {
        await supa.from("suppressed_emails").delete().eq("email", email);
        const { error: subErr } = await supa.from("newsletter_subscribers").insert({ email, source: "booking" });
        if (subErr && !/duplicate|unique/i.test(subErr.message)) {
          console.error("newsletter opt-in failed", subErr);
        }
      } catch (e) {
        console.error("newsletter opt-in failed", e);
      }
    }

    // Auto-send pre-op instructions (best-effort, idempotent)
    try {
      await invokeServiceFunction("send-pre-op-instructions", { appointmentId: inserted!.id });
    } catch (e) { console.error("pre-op send failed", e); }

    // Reschedule cancel — only if the old appointment belongs to the same client_email.
    // (Prevents the previous client-side cancel that allowed any visitor with a UUID to cancel any appointment.)
    if (b.rescheduleAppointmentId) {
      try {
        const { data: oldAppt } = await supa.from("appointments")
          .select("id, client_email, status")
          .eq("id", b.rescheduleAppointmentId)
          .maybeSingle();
        if (oldAppt && (oldAppt.client_email ?? "").toLowerCase() === email
            && ["pending", "approved"].includes(oldAppt.status)) {
          await supa.from("appointments").update({
            status: "cancelled", updated_at: new Date().toISOString(),
          }).eq("id", oldAppt.id);
          await supa.from("appointment_audit_log").insert({
            appointment_id: oldAppt.id, action: "rescheduled_by_client",
            from_status: oldAppt.status, to_status: "cancelled",
            notes: `Rescheduled to ${inserted!.id}`,
          });
          // Remove the old appointment from the shared + personal Google Calendars
          // so the stale slot doesn't linger after a client-initiated reschedule.
          try {
            await invokeServiceFunction("google-calendar-sync", { appointmentId: oldAppt.id, action: "delete" });
          } catch (e) { console.error("[create-booking] gcal delete on reschedule failed", e); }
        } else {
          console.warn("[create-booking] reschedule cancel skipped — ownership or status check failed", { rescheduleAppointmentId: b.rescheduleAppointmentId });
        }
      } catch (e) { console.error("reschedule cancel failed", e); }
    }

    return json({ id: inserted!.id, token: inserted!.public_token, serviceName: orderedSvcs.map((s: any) => s.name).join(" + ") });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
