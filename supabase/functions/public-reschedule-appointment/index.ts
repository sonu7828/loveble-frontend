// Reschedule an appointment from the public booking page using public_token (no auth).
// Body: { token: string; newStartAt: string (ISO) }
// Validates against the staff member's availability (weekly + extras) and existing appointments.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { token, newStartAt } = await req.json();
    if (!token || typeof token !== "string" || token.length < 16) return json({ error: "Invalid token" }, 400);
    if (!newStartAt) return json({ error: "Missing time" }, 400);
    const newStart = new Date(newStartAt);
    if (isNaN(newStart.getTime())) return json({ error: "Invalid date" }, 400);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: appt } = await supa.from("appointments").select("*").eq("public_token", token).maybeSingle();
    if (!appt) return json({ error: "Not found" }, 404);
    if (!["pending", "approved"].includes(appt.status)) {
      return json({ error: "This appointment cannot be rescheduled." }, 400);
    }

    const hoursUntilCurrent = (new Date(appt.start_at).getTime() - Date.now()) / 3600000;
    if (hoursUntilCurrent < 48) {
      return json({ error: "Within 48 hours of your appointment, please call us to reschedule." }, 400);
    }
    const hoursUntilNew = (newStart.getTime() - Date.now()) / 3600000;
    if (hoursUntilNew < 24) {
      return json({ error: "New time must be at least 24 hours from now." }, 400);
    }

    const durationMs = new Date(appt.end_at).getTime() - new Date(appt.start_at).getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);
    const dateStr = ptDateString(newStart);
    const dayStart = localDateToUtc(dateStr, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

    const [{ data: schedules }, { data: overrides }] = await Promise.all([
      supa.from("weekly_schedules").select("*").eq("staff_id", appt.staff_id).eq("location_id", appt.location_id).eq("day_of_week", dowInPT(newStart)),
      supa.from("schedule_overrides").select("*").eq("staff_id", appt.staff_id).gte("end_at", dayStart.toISOString()).lt("start_at", dayEnd.toISOString()),
    ]);
    const blocks = (overrides ?? []).filter((o: any) => o.override_type === "block" && (!o.location_id || o.location_id === appt.location_id))
      .map((o: any) => [new Date(o.start_at).getTime(), new Date(o.end_at).getTime()] as [number, number]);
    const extras = (overrides ?? []).filter((o: any) => o.override_type === "extra_availability" && (!o.location_id || o.location_id === appt.location_id))
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
    const fits = windows.some(([ws, we]) => newStartMs >= ws && newEndMs <= we)
      && !blocks.some(([bs, be]) => newStartMs < be && newEndMs > bs);
    if (!fits) return json({ error: "That time is no longer available." }, 409);

    const { data: conflicts } = await supa.from("appointments").select("id").eq("staff_id", appt.staff_id).neq("id", appt.id).in("status", ["pending", "approved"]).lt("start_at", newEnd.toISOString()).gt("end_at", newStart.toISOString());
    if ((conflicts ?? []).length > 0) return json({ error: "That time is no longer available." }, 409);

    const oldStart = appt.start_at;
    const { error: uErr } = await supa.from("appointments").update({
      start_at: newStart.toISOString(),
      end_at: newEnd.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", appt.id);
    if (uErr) return json({ error: uErr.message }, 500);

    await supa.from("appointment_audit_log").insert({
      appointment_id: appt.id,
      action: "rescheduled",
      from_status: appt.status,
      to_status: appt.status,
      notes: `Client self-reschedule via public link: ${oldStart} → ${newStart.toISOString()}`,
    });

    // Email + calendar resync
    const [{ data: svc }, { data: staff }, { data: loc }, { data: apsvList }] = await Promise.all([
      supa.from("services").select("name").eq("id", appt.service_id).single(),
      supa.from("staff_profiles").select("full_name").eq("id", appt.staff_id).single(),
      supa.from("locations").select("name, address, city, state").eq("id", appt.location_id).single(),
      supa.from("appointment_services").select("display_order, services(name)").eq("appointment_id", appt.id).order("display_order", { ascending: true }),
    ]);
    const allServiceNames = ((apsvList ?? []) as any[]).map((r) => r.services?.name).filter((n: any): n is string => !!n);
    const combinedServiceName = allServiceNames.length > 0 ? allServiceNames.join(" + ") : (svc?.name ?? "your appointment");
    const manageUrl = `https://bookrka.com/booking/${appt.public_token}`;
    try {
      await supa.functions.invoke("send-transactional-email", {
        body: {
          templateName: "booking-approved",
          recipientEmail: appt.client_email,
          idempotencyKey: `reschedule-${appt.id}-${newStart.getTime()}`,
          templateData: {
            clientName: appt.client_first_name,
            clientFirstName: appt.client_first_name,
            serviceName: combinedServiceName,
            providerName: staff?.full_name ?? "",
            locationName: loc?.name ?? "",
            locationAddress: loc ? `${loc.address}, ${loc.city}, ${loc.state}` : "",
            appointmentTime: newStart.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }),
            startAt: newStart.toISOString(),
            endAt: newEnd.toISOString(),
            manageUrl,
          },
        },
      });
    } catch (e) { console.error("email failed", e); }
    try { await supa.functions.invoke("google-calendar-sync", { body: { appointmentId: appt.id } }); } catch {}

    // Old slot is now free — notify matching waitlist entries.
    try {
      await supa.functions.invoke("process-waitlist-fill", {
        body: {
          appointmentId: appt.id,
          slotOverride: {
            serviceId: appt.service_id,
            locationId: appt.location_id,
            staffId: appt.staff_id,
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
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, weekday: "short" });
  return Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value])) as Record<string, string>;
}
function ptDateString(date: Date): string { const p = ptDateParts(date); return `${p.year}-${p.month}-${p.day}`; }
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
function nthWeekdayOfMonth(dateStr: string): number { const [, , d] = dateStr.split("-").map(Number); return Math.floor((d - 1) / 7) + 1; }
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
