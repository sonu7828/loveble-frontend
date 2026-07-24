// Reschedule an appointment as staff/admin/scheduler. Updates start/end, audits, emails client, resyncs calendar.
// Body: { appointmentId: string; newStartAt: string (ISO); overrideConflict?: boolean }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getLocationArrival } from "../_shared/location-arrival.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { appointmentId, newStartAt, newLocationId, newStaffId, overrideConflict } = await req.json();
    if (!appointmentId || !newStartAt) return json({ error: "Invalid input" }, 400);
    const newStart = new Date(newStartAt);
    if (isNaN(newStart.getTime())) return json({ error: "Invalid date" }, 400);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", user.id);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isAdmin = roleSet.has("admin");
    const isPriv = isAdmin || roleSet.has("scheduler") || roleSet.has("receptionist");

    const { data: appt } = await supa.from("appointments").select("*").eq("id", appointmentId).single();
    if (!appt) return json({ error: "Not found" }, 404);
    if (["cancelled", "denied", "no_show", "completed"].includes(appt.status)) {
      return json({ error: "Cannot reschedule a finalized appointment" }, 400);
    }

    if (!isPriv) {
      const { data: sp } = await supa.from("staff_profiles").select("id").eq("id", appt.staff_id).eq("user_id", user.id).maybeSingle();
      if (!sp) return json({ error: "Forbidden" }, 403);
      // Non-privileged staff cannot reassign the appointment to another provider.
      if (newStaffId && newStaffId !== appt.staff_id) {
        return json({ error: "Only schedulers or admins can change the provider on an appointment." }, 403);
      }
    }

    const effectiveLocationId = newLocationId || appt.location_id;
    const effectiveStaffId = newStaffId || appt.staff_id;
    if (newLocationId && newLocationId !== appt.location_id) {
      const { data: locExists } = await supa.from("locations").select("id").eq("id", newLocationId).maybeSingle();
      if (!locExists) return json({ error: "Invalid location" }, 400);
    }
    if (newStaffId && newStaffId !== appt.staff_id) {
      const { data: staffExists } = await supa.from("staff_profiles").select("id, is_active").eq("id", newStaffId).maybeSingle();
      if (!staffExists || staffExists.is_active === false) return json({ error: "Invalid provider" }, 400);
      // Verify the new provider offers every service on this appointment at the effective location.
      const { data: apsv } = await supa.from("appointment_services").select("service_id").eq("appointment_id", appointmentId);
      const svcIds = ((apsv ?? []) as any[]).map((r) => r.service_id).filter(Boolean);
      const requiredSvcIds = svcIds.length > 0 ? svcIds : [appt.service_id];
      const { data: prov } = await supa
        .from("service_providers")
        .select("service_id")
        .eq("staff_id", newStaffId)
        .eq("location_id", effectiveLocationId)
        .in("service_id", requiredSvcIds);
      const offered = new Set(((prov ?? []) as any[]).map((r) => r.service_id));
      const missing = requiredSvcIds.filter((id) => !offered.has(id));
      if (missing.length > 0 && !(isPriv && overrideConflict)) {
        return json({ error: "Selected provider does not offer all services on this appointment at this location. Toggle override to force it." }, 409);
      }
    }

    const durationMs = new Date(appt.end_at).getTime() - new Date(appt.start_at).getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);
    const dateStr = ptDateString(newStart);
    const dayStart = localDateToUtc(dateStr, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
    const [{ data: schedules }, { data: overrides }] = await Promise.all([
      supa.from("weekly_schedules")
        .select("*")
        .eq("staff_id", effectiveStaffId)
        .eq("location_id", effectiveLocationId)
        .eq("day_of_week", dowInPT(newStart)),
      supa.from("schedule_overrides")
        .select("*")
        .eq("staff_id", effectiveStaffId)
        .gte("end_at", dayStart.toISOString())
        .lt("start_at", dayEnd.toISOString()),
    ]);
    const blocks = (overrides ?? []).filter((o: any) => o.override_type === "block" && (!o.location_id || o.location_id === effectiveLocationId))
      .map((o: any) => [new Date(o.start_at).getTime(), new Date(o.end_at).getTime()] as [number, number]);
    const extras = (overrides ?? []).filter((o: any) => o.override_type === "extra_availability" && (!o.location_id || o.location_id === effectiveLocationId))
      .map((o: any) => [new Date(o.start_at).getTime(), new Date(o.end_at).getTime()] as [number, number]);
    const windows: [number, number][] = [
      ...(schedules ?? []).filter((s: any) => scheduleAppliesOnDate(s, dateStr)).map((s: any) => {
        const [sh, sm] = s.start_time.split(":").map(Number);
        const [eh, em] = s.end_time.split(":").map(Number);
        return [localDateToUtc(dateStr, sh, sm).getTime(), localDateToUtc(dateStr, eh, em).getTime()] as [number, number];
      }),
      ...extras,
    ];
    const newStartMs = newStart.getTime();
    const newEndMs = newEnd.getTime();
    const fitsAvailability = windows.some(([ws, we]) => newStartMs >= ws && newEndMs <= we)
      && !blocks.some(([bs, be]) => newStartMs < be && newEndMs > bs);

    // Admins and schedulers may intentionally override conflicts or availability. Everyone else must use open slots.
    if (!(isPriv && overrideConflict)) {
      if (!fitsAvailability) {
        return json({ error: "Time slot is outside this provider's available schedule. Only admins or schedulers can override availability." }, 409);
      }
      const { data: conflicts } = await supa
        .from("appointments")
        .select("id, start_at, end_at, status")
        .eq("staff_id", effectiveStaffId)
        .neq("id", appointmentId)
        .in("status", ["pending", "approved"])
        .lt("start_at", newEnd.toISOString())
        .gt("end_at", newStart.toISOString());
      if ((conflicts ?? []).length > 0) {
        return json({ error: "Time conflicts with another appointment", conflict: true }, 409);
      }
    }

    const oldStart = appt.start_at;
    const oldLocationId = appt.location_id;
    const oldStaffId = appt.staff_id;
    const updatePayload: Record<string, unknown> = {
      start_at: newStart.toISOString(),
      end_at: newEnd.toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (newLocationId && newLocationId !== oldLocationId) {
      updatePayload.location_id = newLocationId;
    }
    if (newStaffId && newStaffId !== oldStaffId) {
      updatePayload.staff_id = newStaffId;
    }
    let uErr: any = null;
    if (isPriv && overrideConflict) {
      // Call the override RPC with the staff user's JWT, not the service role,
      // so auth.uid() inside the database function can validate their scheduler/admin role.
      const { error } = await userClient.rpc("force_reschedule_appointment", {
        p_appointment_id: appointmentId,
        p_start_at: newStart.toISOString(),
        p_end_at: newEnd.toISOString(),
        p_location_id: (newLocationId && newLocationId !== oldLocationId) ? newLocationId : null,
        p_staff_id: (newStaffId && newStaffId !== oldStaffId) ? newStaffId : null,
      });
      uErr = error;
    } else {
      const { error } = await supa.from("appointments").update(updatePayload).eq("id", appointmentId);
      uErr = error;
    }
    if (uErr) {
      const msg = uErr.message || String(uErr);
      // Bubble overlap-trigger errors as a 409 so the UI can surface them clearly.
      if (/overlapping appointment/i.test(msg)) {
        return json({ error: "This time conflicts with another appointment on this provider. Toggle 'override conflict' to force it.", conflict: true }, 409);
      }
      return json({ error: msg }, 500);
    }


    const changeNotes: string[] = [];
    if (newLocationId && newLocationId !== oldLocationId) changeNotes.push("location changed");
    if (newStaffId && newStaffId !== oldStaffId) changeNotes.push("provider changed");
    await supa.from("appointment_audit_log").insert({
      appointment_id: appointmentId,
      action: "rescheduled",
      from_status: appt.status,
      to_status: appt.status,
      actor_user_id: user.id,
      notes: `From ${oldStart} to ${newStart.toISOString()}${changeNotes.length ? ` (${changeNotes.join(", ")})` : ""}`,
    });

    // Email client
    const [{ data: svc }, { data: staff }, { data: loc }, { data: apsvList }] = await Promise.all([
      supa.from("services").select("name").eq("id", appt.service_id).single(),
      supa.from("staff_profiles").select("full_name").eq("id", effectiveStaffId).single(),
      supa.from("locations").select("name, address, city, state").eq("id", effectiveLocationId).single(),
      supa.from("appointment_services").select("display_order, services(name)").eq("appointment_id", appointmentId).order("display_order", { ascending: true }),
    ]);
    const allServiceNames = ((apsvList ?? []) as any[]).map((r) => r.services?.name).filter((n: any): n is string => !!n);
    const combinedServiceName = allServiceNames.length > 0 ? allServiceNames.join(" + ") : (svc?.name ?? "your appointment");

    const arrival = getLocationArrival({ city: loc?.city, name: loc?.name, address: loc?.address, state: loc?.state });
    const templateData = {
      clientName: appt.client_first_name,
      clientFirstName: appt.client_first_name,
      serviceName: combinedServiceName,
      providerName: staff?.full_name ?? "",
      locationName: loc?.name ?? "",
      locationAddress: arrival.address || (loc ? `${loc.address}, ${loc.city}, ${loc.state}` : ""),
      arrivalInstructions: arrival.instructions,
      appointmentTime: newStart.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }),
      startAt: newStart.toISOString(),
      endAt: newEnd.toISOString(),
      manageUrl: `https://bookrka.com/booking/${appt.public_token}`,
    };
    try {
      const { error: emailErr } = await supa.functions.invoke("send-transactional-email", {
        body: {
          templateName: "booking-approved",
          recipientEmail: appt.client_email,
          idempotencyKey: `reschedule-${appointmentId}-${newStart.getTime()}`,
          templateData,
        },
      });
      if (emailErr) console.error("reschedule email failed", emailErr);
    } catch (e) { console.error("reschedule email failed", e); }

    // Always re-sync so the shared calendar AND the staff member's personal
    // calendar (via ICS) stay consistent on reschedule.
    try {
      await supa.functions.invoke("google-calendar-sync", { body: { appointmentId } });
    } catch (e) { console.error("cal sync failed", e); }

    // Old slot is now free — notify matching waitlist entries.
    try {
      await supa.functions.invoke("process-waitlist-fill", {
        body: {
          appointmentId,
          slotOverride: {
            serviceId: appt.service_id,
            locationId: oldLocationId,
            staffId: oldStaffId,
            startAt: oldStart,
          },
        },
      });
    } catch (e) { console.error("waitlist fill failed", e); }

    return json({ ok: true, startAt: newStart.toISOString(), endAt: newEnd.toISOString() });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

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
