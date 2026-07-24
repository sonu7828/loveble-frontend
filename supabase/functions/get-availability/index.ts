// Computes available time slots for (serviceId, staffId, locationId, date)
// Public endpoint — no auth required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchStaffBusy } from "../_shared/google-calendar-busy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLOT_GRANULARITY_MIN = 15;

interface Body {
  serviceId: string;
  staffId: string;
  locationId: string;
  date: string; // YYYY-MM-DD (interpreted as Pacific Time)
  includeConflicts?: boolean;
}

// Pacific timezone helpers ----------------------------------------------------
const TZ = "America/Los_Angeles";

function ptDateParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  return parts as Record<string, string>;
}

function localDateToUtc(dateStr: string, hh: number, mm: number): Date {
  // Interpret dateStr (YYYY-MM-DD) at HH:MM in America/Los_Angeles, return UTC Date.
  // Iterative offset solver (handles DST boundaries).
  const [y, m, d] = dateStr.split("-").map(Number);
  let guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  for (let i = 0; i < 3; i++) {
    const parts = ptDateParts(guess);
    const seenY = +parts.year, seenMo = +parts.month, seenD = +parts.day;
    const seenH = +parts.hour, seenMi = +parts.minute;
    const target = Date.UTC(y, m - 1, d, hh, mm);
    const seen = Date.UTC(seenY, seenMo - 1, seenD, seenH, seenMi);
    const drift = target - seen;
    if (drift === 0) break;
    guess = new Date(guess.getTime() + drift);
  }
  return guess;
}

function dowInPT(dateStr: string): number {
  // 0=Sun..6=Sat
  const noon = localDateToUtc(dateStr, 12, 0);
  const map: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  return map[ptDateParts(noon).weekday] ?? 0;
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
  if (dowInPT(dateStr) !== sched.day_of_week) return false;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body & { serviceIds?: string[] };
    const serviceIds = Array.isArray(body?.serviceIds) && body.serviceIds.length > 0
      ? body.serviceIds.filter((x: any) => typeof x === "string" && x)
      : (body?.serviceId ? [body.serviceId] : []);
    if (serviceIds.length === 0 || !body?.staffId || !body?.locationId || !body?.date) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return json({ error: "Invalid date format" }, 400);
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      console.error("get-availability: SUPABASE_SERVICE_ROLE_KEY missing");
      return json({ error: "Server not configured" }, 500);
    }
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

    let includeBusySlots = false;
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (token) {
      const { data: userData } = await supa.auth.getUser(token);
      const userId = userData?.user?.id;
      if (userId) {
        const { data: isAdmin } = await supa.rpc("is_admin", { _user_id: userId });
        includeBusySlots = Boolean(isAdmin && body.includeConflicts);
      }
    }

    const { data: services, error: sErr } = await supa
      .from("services").select("id, duration_minutes, buffer_minutes, promo_group, stack_numbing_minutes").in("id", serviceIds);
    if (sErr || !services || services.length !== serviceIds.length) return json({ error: "Service not found" }, 404);
    const totalDur = services.reduce((sum: number, s: any) => sum + (s.duration_minutes + (s.buffer_minutes ?? 0)), 0);
    const service = { duration_minutes: totalDur, buffer_minutes: 0 };
    // New booking is stackable only if EVERY requested service has a numbing window.
    const newStackNumb = services.every((s: any) => (s.stack_numbing_minutes ?? 0) > 0)
      ? Math.min(...services.map((s: any) => s.stack_numbing_minutes as number))
      : 0;

    // Verify provider offers ALL these services at this location
    const { data: sps } = await supa
      .from("service_providers").select("service_id")
      .in("service_id", serviceIds).eq("staff_id", body.staffId).eq("location_id", body.locationId);
    const offered = new Set((sps ?? []).map((r: any) => r.service_id));
    if (serviceIds.some((id) => !offered.has(id))) return json({ slots: [] });

    // Promo services follow the same provider weekly schedules as regular services,
    // but are bookable only within the promo's calendar window.
    const promoGroup = (services[0] as any)?.promo_group as string | null;
    if (promoGroup && promoGroup.startsWith("june-2026") && !body.date.startsWith("2026-06")) {
      return json({ slots: [] });
    }




    // Weekly schedules for this staff+location on this dow
    const dow = dowInPT(body.date);
    const { data: schedules } = await supa
      .from("weekly_schedules").select("*")
      .eq("staff_id", body.staffId).eq("location_id", body.locationId).eq("day_of_week", dow);

    const applicable = (schedules ?? []).filter(s => scheduleAppliesOnDate(s, body.date));

    // Day window in UTC
    const dayStart = localDateToUtc(body.date, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);

    // Existing pending+approved appointments for this staff that overlap the day.
    // Join service stack_numbing_minutes so we can mark stackable busy windows.
    const { data: appts } = await supa
      .from("appointments").select("start_at, end_at, status, service_id, services(stack_numbing_minutes)")
      .eq("staff_id", body.staffId)
      .in("status", ["pending", "approved"])
      .gte("end_at", dayStart.toISOString()).lt("start_at", dayEnd.toISOString());

    // Overrides for this staff overlapping the day
    const { data: overrides } = await supa
      .from("schedule_overrides").select("*")
      .eq("staff_id", body.staffId)
      .gte("end_at", dayStart.toISOString()).lt("start_at", dayEnd.toISOString());

    const blocks = (overrides ?? []).filter(o => o.override_type === "block" && (!o.location_id || o.location_id === body.locationId))
      .map(o => [new Date(o.start_at).getTime(), new Date(o.end_at).getTime()] as [number, number]);
    const extras = (overrides ?? []).filter(o => o.override_type === "extra_availability" && (!o.location_id || o.location_id === body.locationId))
      .map(o => [new Date(o.start_at).getTime(), new Date(o.end_at).getTime()] as [number, number]);

    // Google Calendar busy times for this staff (fail-open if unavailable)
    let gcalBusy: [number, number][] = [];
    if (!includeBusySlots) {
      const { data: staffRow } = await supa
        .from("staff_profiles").select("calendar_email").eq("id", body.staffId).maybeSingle();
      const busyMap = await fetchStaffBusy(
        [{ id: body.staffId, calendarEmail: staffRow?.calendar_email ?? null }],
        dayStart.toISOString(),
        dayEnd.toISOString(),
        supa,
      );
      gcalBusy = busyMap.get(body.staffId) ?? [];
    }

    // Busy intervals: [start, end, stackUntil?]. stackUntil is set only for appointments
    // whose service has a numbing window — another stackable booking may overlap up to that time.
    type Busy = [number, number, number?];
    const apptBusy: Busy[] = (appts ?? []).map((a: any) => {
      const s = new Date(a.start_at).getTime();
      const e = new Date(a.end_at).getTime();
      const numb = a.services?.stack_numbing_minutes ?? 0;
      return numb > 0 ? [s, e, s + numb * 60_000] : [s, e];
    });
    const busy: Busy[] = [
      ...apptBusy,
      ...blocks.map(([s, e]) => [s, e] as Busy),
      ...gcalBusy.map(([s, e]) => [s, e] as Busy),
    ];

    const dur = service.duration_minutes + (service.buffer_minutes ?? 0);

    // Generate windows from weekly schedules + extras (clipped to date)
    const windows: [number, number][] = [
      ...applicable.map(s => {
        const [sh, sm] = s.start_time.split(":").map(Number);
        const [eh, em] = s.end_time.split(":").map(Number);
        return [
          localDateToUtc(body.date, sh, sm).getTime(),
          localDateToUtc(body.date, eh, em).getTime(),
        ] as [number, number];
      }),
      ...extras,
    ];

    // Generate slot candidates at SLOT_GRANULARITY_MIN
    const now = Date.now();
    const slots: string[] = [];
    for (const [ws, we] of windows) {
      let t = ws;
      while (t + dur * 60 * 1000 <= we) {
        const slotEnd = t + dur * 60 * 1000;
        if (t > now + 60 * 60 * 1000) { // require booking at least 1h ahead
          let overlap = false;
          if (!includeBusySlots) {
            const conflicts = busy.filter(([bs, be]) => t < be && slotEnd > bs);
            if (conflicts.length === 0) {
              overlap = false;
            } else if (conflicts.length === 1 && newStackNumb > 0) {
              // Single conflict: allow if it's a stackable appt AND this slot fits inside its numbing window
              const [bs, , stackUntil] = conflicts[0];
              overlap = !(stackUntil && t >= bs && slotEnd <= stackUntil);
            } else {
              overlap = true;
            }
          }
          if (!overlap) slots.push(new Date(t).toISOString());
        }
        t += SLOT_GRANULARITY_MIN * 60 * 1000;
      }
    }

    // De-dupe & sort
    const unique = Array.from(new Set(slots)).sort();
    return json({ slots: unique });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
