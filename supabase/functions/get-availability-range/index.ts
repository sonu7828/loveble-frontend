// Returns the set of dates with at least one available slot within a range,
// plus the next-available slot. Public endpoint.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchStaffBusy } from "../_shared/google-calendar-busy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLOT_GRANULARITY_MIN = 15;
const TZ = "America/Los_Angeles";

function ptDateParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, weekday: "short",
  });
  return Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value])) as Record<string,string>;
}
function localDateToUtc(dateStr: string, hh: number, mm: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  let guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  for (let i = 0; i < 3; i++) {
    const p = ptDateParts(guess);
    const target = Date.UTC(y, m - 1, d, hh, mm);
    const seen = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    const drift = target - seen;
    if (drift === 0) break;
    guess = new Date(guess.getTime() + drift);
  }
  return guess;
}
function dowInPT(dateStr: string): number {
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
function scheduleAppliesOnDate(s: any, dateStr: string): boolean {
  if (!s.is_active) return false;
  if (s.effective_from && dateStr < s.effective_from) return false;
  if (dowInPT(dateStr) !== s.day_of_week) return false;
  if (s.recurrence === "weekly") return true;
  if (s.recurrence === "alternating_weeks") {
    if (!s.anchor_date) return false;
    const w = weeksBetween(s.anchor_date, dateStr);
    return w >= 0 && w % 2 === 0;
  }
  if (s.recurrence === "nth_weekday_of_month") {
    const n = nthWeekdayOfMonth(dateStr);
    return Array.isArray(s.weeks_of_month) && s.weeks_of_month.includes(n);
  }
  return false;
}
function addDaysISO(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json() as {
      serviceId?: string; serviceIds?: string[];
      staffId: string; locationId: string;
      startDate?: string; days?: number;
    };
    const serviceIds = Array.isArray(body.serviceIds) && body.serviceIds.length
      ? body.serviceIds : (body.serviceId ? [body.serviceId] : []);
    if (!serviceIds.length || !body.staffId || !body.locationId) {
      return json({ error: "Missing required fields" }, 400);
    }
    const startDate = body.startDate ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const days = Math.min(Math.max(body.days ?? 60, 1), 180);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { data: services } = await supa
      .from("services").select("id, duration_minutes, buffer_minutes, promo_group, stack_numbing_minutes").in("id", serviceIds);
    if (!services || services.length !== serviceIds.length) return json({ error: "Service not found" }, 404);
    const dur = services.reduce((sum: number, s: any) => sum + (s.duration_minutes + (s.buffer_minutes ?? 0)), 0);
    const newStackNumb = services.every((s: any) => (s.stack_numbing_minutes ?? 0) > 0)
      ? Math.min(...services.map((s: any) => s.stack_numbing_minutes as number))
      : 0;

    const { data: sps } = await supa
      .from("service_providers").select("service_id")
      .in("service_id", serviceIds).eq("staff_id", body.staffId).eq("location_id", body.locationId);
    const offered = new Set((sps ?? []).map((r: any) => r.service_id));
    if (serviceIds.some(id => !offered.has(id))) return json({ availableDates: [], nextAvailable: null });

    // Promo services follow the same provider weekly schedules as regular services,
    // but are bookable only within the promo's calendar window.
    const promoGroup = (services[0] as any)?.promo_group as string | null;
    const isJune2026Promo = !!(promoGroup && promoGroup.startsWith("june-2026"));



    const { data: schedules } = await supa
      .from("weekly_schedules").select("*")
      .eq("staff_id", body.staffId).eq("location_id", body.locationId);

    const rangeStart = localDateToUtc(startDate, 0, 0);
    const rangeEnd = localDateToUtc(addDaysISO(startDate, days), 0, 0);

    const { data: appts } = await supa
      .from("appointments").select("start_at, end_at, status, service_id, services(stack_numbing_minutes)")
      .eq("staff_id", body.staffId)
      .in("status", ["pending", "approved"])
      .gte("end_at", rangeStart.toISOString()).lt("start_at", rangeEnd.toISOString());

    const { data: overrides } = await supa
      .from("schedule_overrides").select("*")
      .eq("staff_id", body.staffId)
      .gte("end_at", rangeStart.toISOString()).lt("start_at", rangeEnd.toISOString());

    type Busy = [number, number, number?];
    const allBusy: Busy[] = (appts ?? []).map((a: any) => {
      const s = new Date(a.start_at).getTime();
      const e = new Date(a.end_at).getTime();
      const numb = a.services?.stack_numbing_minutes ?? 0;
      return numb > 0 ? [s, e, s + numb * 60_000] : [s, e];
    });
    const allBlocks = (overrides ?? []).filter((o: any) => o.override_type === "block" && (!o.location_id || o.location_id === body.locationId))
      .map((o: any) => [new Date(o.start_at).getTime(), new Date(o.end_at).getTime()] as [number, number]);
    const allExtras = (overrides ?? []).filter((o: any) => o.override_type === "extra_availability" && (!o.location_id || o.location_id === body.locationId))
      .map((o: any) => [new Date(o.start_at).getTime(), new Date(o.end_at).getTime()] as [number, number]);

    // Google Calendar busy times for this staff across the full range (fail-open).
    const { data: staffRow } = await supa
      .from("staff_profiles").select("calendar_email").eq("id", body.staffId).maybeSingle();
    const gcalBusyMap = await fetchStaffBusy(
      [{ id: body.staffId, calendarEmail: staffRow?.calendar_email ?? null }],
      rangeStart.toISOString(),
      rangeEnd.toISOString(),
      supa,
    );
    const allGcalBusy = gcalBusyMap.get(body.staffId) ?? [];

    const now = Date.now();
    const availableDates: string[] = [];
    let nextAvailable: { date: string; slot: string } | null = null;

    for (let i = 0; i < days; i++) {
      const dateStr = addDaysISO(startDate, i);
      if (isJune2026Promo && !dateStr.startsWith("2026-06")) continue;
      const dow = dowInPT(dateStr);

      const dayApplicable = (schedules ?? []).filter((s: any) =>
        s.day_of_week === dow && scheduleAppliesOnDate(s, dateStr));

      const dayStart = localDateToUtc(dateStr, 0, 0).getTime();
      const dayEnd = dayStart + 86400000;
      const windows: [number, number][] = [
        ...dayApplicable.map((s: any) => {
          const [sh, sm] = s.start_time.split(":").map(Number);
          const [eh, em] = s.end_time.split(":").map(Number);
          return [localDateToUtc(dateStr, sh, sm).getTime(), localDateToUtc(dateStr, eh, em).getTime()] as [number, number];
        }),
        ...allExtras.filter(([s, e]) => s < dayEnd && e > dayStart),
      ];
      if (!windows.length) continue;

      const busy: Busy[] = [
        ...allBusy.filter(([s, e]) => s < dayEnd && e > dayStart),
        ...allBlocks.filter(([s, e]) => s < dayEnd && e > dayStart).map(([s, e]) => [s, e] as Busy),
        ...allGcalBusy.filter(([s, e]) => s < dayEnd && e > dayStart).map(([s, e]) => [s, e] as Busy),
      ];

      let foundForDay = false;
      for (const [ws, we] of windows) {
        let t = ws;
        while (t + dur * 60_000 <= we) {
          const end = t + dur * 60_000;
          if (t > now + 3_600_000) {
            const conflicts = busy.filter(([bs, be]) => t < be && end > bs);
            let overlap: boolean;
            if (conflicts.length === 0) overlap = false;
            else if (conflicts.length === 1 && newStackNumb > 0) {
              const [bs, , stackUntil] = conflicts[0];
              overlap = !(stackUntil && t >= bs && end <= stackUntil);
            } else overlap = true;
            if (!overlap) {
              foundForDay = true;
              if (!nextAvailable) nextAvailable = { date: dateStr, slot: new Date(t).toISOString() };
              break;
            }
          }
          t += SLOT_GRANULARITY_MIN * 60_000;
        }
        if (foundForDay) break;
      }
      if (foundForDay) availableDates.push(dateStr);
    }

    return json({ availableDates, nextAvailable });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
