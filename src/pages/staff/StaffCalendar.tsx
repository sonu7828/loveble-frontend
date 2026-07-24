import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, startOfWeek, addDays, isSameDay, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { Loader2, ChevronLeft, ChevronRight, MapPin, Plus, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchUnifiedStaffMembers } from "@/lib/unifiedStaff";

interface Appt {
  id: string; status: string; start_at: string; end_at: string;
  client_first_name: string; client_last_name: string;
  service_id: string; staff_id: string; location_id: string;
}
interface Override {
  id: string; staff_id: string; start_at: string; end_at: string; override_type: string; reason: string | null;
}
interface Schedule {
  staff_id: string; location_id: string; day_of_week: number; start_time: string; end_time: string;
  recurrence: string; anchor_date: string | null; weeks_of_month: number[] | null;
}
interface StaffP { id: string; full_name: string; color?: string; }

export default function StaffCalendar() {
  const navigate = useNavigate();
  const { canSeeAll, staffId } = useAuth();
  const isMobile = useIsMobile();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [staff, setStaff] = useState<StaffP[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [apptServices, setApptServices] = useState<Record<string, string[]>>({});
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [filterStaff, setFilterStaff] = useState<string>("");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [view, setView] = useState<"week" | "day" | "month">("week");
  const [dayDate, setDayDate] = useState<Date>(() => new Date());
  const [monthDate, setMonthDate] = useState<Date>(() => startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);

  // On phone-sized viewports, force single-day view so the data effect
  // fetches just that day's appointments for the "today list" UI below.
  useEffect(() => {
    if (isMobile && view !== "day") setView("day");
  }, [isMobile, view]);

  const monthGridStart = useMemo(
    () => startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 }),
    [monthDate],
  );
  const monthGridDays = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i)), [monthGridStart]);

  const weekDays = useMemo(
    () => view === "week"
      ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      : view === "month"
        ? monthGridDays
        : [dayDate],
    [weekStart, view, dayDate, monthGridDays]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, sv, l] = await Promise.all([
        fetchUnifiedStaffMembers(),
        supabase.from("services").select("id, name"),
        supabase.from("locations").select("id, name").eq("is_active", true),
      ]);
      setStaff(s as StaffP[]);
      setServices(sv.data ?? []);
      setLocations(l.data ?? []);
      // Use local-day boundaries so appointments near midnight land on the right day
      let startLocal: Date;
      let endLocal: Date;
      if (view === "month") {
        startLocal = new Date(monthGridStart);
        endLocal = addDays(startLocal, 42);
      } else if (view === "week") {
        startLocal = new Date(weekStart);
        endLocal = addDays(startLocal, 7);
      } else {
        startLocal = new Date(dayDate);
        endLocal = addDays(startLocal, 1);
      }
      startLocal.setHours(0, 0, 0, 0);
      const start = startLocal.toISOString();
      const end = endLocal.toISOString();
      const [a, o, sc] = await Promise.all([
        supabase.from("appointments").select("*").gte("start_at", start).lt("start_at", end).in("status", ["pending", "approved"]),
        supabase.from("schedule_overrides").select("*").gte("start_at", start).lt("start_at", end),
        supabase.from("weekly_schedules").select("*").eq("is_active", true),
      ]);
      setAppts(a.data ?? []);
      setOverrides(o.data ?? []);
      setSchedules(sc.data ?? []);
      const ids = (a.data ?? []).map((x: any) => x.id);
      if (ids.length > 0) {
        const { data: aps } = await supabase
          .from("appointment_services")
          .select("appointment_id, display_order, service_id")
          .in("appointment_id", ids)
          .order("display_order", { ascending: true });
        const map: Record<string, string[]> = {};
        const serviceNames = new Map((sv.data ?? []).map((service) => [service.id, service.name]));
        for (const r of (aps ?? []) as any[]) {
          const nm = serviceNames.get(r.service_id);
          if (!nm) continue;
          (map[r.appointment_id] ||= []).push(nm);
        }
        setApptServices(map);
      } else {
        setApptServices({});
      }
      setLoading(false);
    })();
  }, [weekStart, view, dayDate, monthGridStart]);

  // If user is staff-only (not admin/scheduler), force filter to self
  const effectiveFilter = canSeeAll ? filterStaff : (staffId ?? "");
  const visibleAppts = appts.filter((a) =>
    (!effectiveFilter || a.staff_id === effectiveFilter) &&
    (!filterLocation || a.location_id === filterLocation)
  );
  const visibleOverrides = overrides.filter((o) => !effectiveFilter || o.staff_id === effectiveFilter);

  const headerRange = view === "week"
    ? `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`
    : view === "month"
      ? format(monthDate, "MMMM yyyy")
      : format(dayDate, "EEEE, MMM d, yyyy");

  const goPrev = () => view === "week"
    ? setWeekStart(addDays(weekStart, -7))
    : view === "month"
      ? setMonthDate(addMonths(monthDate, -1))
      : setDayDate(addDays(dayDate, -1));
  const goNext = () => view === "week"
    ? setWeekStart(addDays(weekStart, 7))
    : view === "month"
      ? setMonthDate(addMonths(monthDate, 1))
      : setDayDate(addDays(dayDate, 1));
  const goToday = () => {
    const t = new Date();
    setWeekStart(startOfWeek(t, { weekStartsOn: 0 }));
    setDayDate(t);
    setMonthDate(startOfMonth(t));
  };

  // ---- Mobile: "Today list" ----------------------------------------------
  if (isMobile) {
    const dayAppts = visibleAppts
      .filter((a) => isSameDay(new Date(a.start_at), dayDate))
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
    const dayOver = visibleOverrides.filter((o) => isSameDay(new Date(o.start_at), dayDate));
    const isToday = isSameDay(dayDate, new Date());
    const dateInput = format(dayDate, "yyyy-MM-dd");
    const goBook = () => navigate(`/staff/appointments/new?date=${dateInput}`);
    return (
      <div className="p-4 pb-24">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-serif text-2xl">Schedule</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{format(dayDate, "EEEE, MMM d")}</p>
          </div>
          <Button size="sm" variant="outline" className="rounded-full" onClick={goToday} disabled={isToday}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Button size="icon" variant="outline" className="rounded-full h-9 w-9 shrink-0" onClick={goPrev} aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="relative flex-1">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              value={dateInput}
              onChange={(e) => { if (e.target.value) setDayDate(new Date(e.target.value + "T12:00:00")); }}
              className="h-9 pl-9 text-sm"
              aria-label="Pick a day"
            />
          </div>
          <Button size="icon" variant="outline" className="rounded-full h-9 w-9 shrink-0" onClick={goNext} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {canSeeAll && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Select value={filterStaff || "all"} onValueChange={(v) => setFilterStaff(v === "all" ? "" : v)}>
              <SelectTrigger aria-label="Filter by staff" className="h-9 text-xs"><SelectValue placeholder="All staff" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterLocation || "all"} onValueChange={(v) => setFilterLocation(v === "all" ? "" : v)}>
              <SelectTrigger aria-label="Filter by location" className="h-9 text-xs"><SelectValue placeholder="All locations" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : dayAppts.length === 0 && dayOver.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nothing booked for this day.
            <div className="mt-4">
              <Button size="sm" onClick={goBook} className="rounded-full gap-1.5"><Plus className="h-3.5 w-3.5" /> Book an appointment</Button>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {dayOver.map((o) => (
              <li key={o.id} className={`rounded-xl px-4 py-3 text-sm ${o.override_type === "block" ? "bg-destructive-soft text-destructive-soft-foreground" : "bg-success-soft text-success-soft-foreground"}`}>
                <div className="font-medium">{o.override_type === "block" ? "🚫 Time off" : "+ Extra availability"}</div>
                {o.reason && <div className="text-xs opacity-80 mt-0.5">{o.reason}</div>}
                <div className="text-xs opacity-70 mt-0.5">{format(new Date(o.start_at), "h:mm a")} – {format(new Date(o.end_at), "h:mm a")}</div>
              </li>
            ))}
            {dayAppts.map((a) => {
              const sp = staff.find((s) => s.id === a.staff_id);
              const loc = locations.find((l) => l.id === a.location_id);
              const names = apptServices[a.id];
              const label = names && names.length > 0
                ? names.join(" + ")
                : (services.find((s) => s.id === a.service_id)?.name ?? "");
              const isPending = a.status === "pending";
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/staff/appointments/${a.id}`)}
                    className="w-full text-left rounded-xl border border-border bg-card p-3.5 active:bg-accent/40 transition-colors flex gap-3"
                    style={{ borderLeft: `4px solid ${sp?.color ?? "#c97c5d"}` }}
                  >
                    <div className="shrink-0 text-center min-w-[58px]">
                      <div className="text-sm font-medium">{format(new Date(a.start_at), "h:mm")}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{format(new Date(a.start_at), "a")}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${isPending ? "bg-warning-soft text-warning-soft-foreground" : "bg-success-soft text-success-soft-foreground"}`}>
                          {a.status}
                        </span>
                        {loc && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <MapPin className="h-2.5 w-2.5" />{loc.name.split(" ")[0]}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium truncate">
                        {a.client_first_name} {a.client_last_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{label}</div>
                      {sp && <div className="text-[11px] text-muted-foreground mt-0.5">with {sp.full_name}</div>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="fixed bottom-4 right-4">
          <Button onClick={goBook} className="rounded-full h-12 px-5 shadow-lg gap-1.5">
            <Plus className="h-4 w-4" /> Book
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-3xl">Calendar</h1>
          <p className="text-xs text-muted-foreground mt-1">{headerRange}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-full border border-border overflow-hidden text-xs" role="group" aria-label="Calendar view">
            <button onClick={() => setView("day")} aria-pressed={view === "day"} className={`px-3 py-1.5 ${view === "day" ? "bg-foreground text-background" : "bg-background"}`}>Day</button>
            <button onClick={() => setView("week")} aria-pressed={view === "week"} className={`px-3 py-1.5 ${view === "week" ? "bg-foreground text-background" : "bg-background"}`}>Week</button>
            <button onClick={() => setView("month")} aria-pressed={view === "month"} className={`px-3 py-1.5 ${view === "month" ? "bg-foreground text-background" : "bg-background"}`}>Month</button>
          </div>
          {canSeeAll && (
            <Select value={filterStaff || "all"} onValueChange={(value) => setFilterStaff(value === "all" ? "" : value)}>
              <SelectTrigger aria-label="Filter by staff" className="h-9 w-[150px] rounded-full text-xs">
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={filterLocation || "all"} onValueChange={(value) => setFilterLocation(value === "all" ? "" : value)}>
            <SelectTrigger aria-label="Filter by location" className="h-9 w-[160px] rounded-full text-xs">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="rounded-full" onClick={goPrev} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={goToday}>Today</Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={goNext} aria-label="Next"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : view === "month" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-2 text-[10px] uppercase tracking-widest text-muted-foreground px-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const dayAppts = visibleAppts.filter((a) => isSameDay(new Date(a.start_at), day)).sort((a, b) => a.start_at.localeCompare(b.start_at));
              const dayOver = visibleOverrides.filter((o) => isSameDay(new Date(o.start_at), day));
              const inMonth = day.getMonth() === monthDate.getMonth();
              const isToday = isSameDay(day, new Date());
              const dateParam = format(day, "yyyy-MM-dd");
              return (
                <div
                  key={day.toISOString()}
                  className={`rounded-lg border bg-card min-h-[110px] p-1.5 flex flex-col gap-1 ${inMonth ? "border-border" : "border-border/40 opacity-60"}`}
                >
                  <button
                    type="button"
                    onClick={() => { setDayDate(day); setView("day"); }}
                    className="flex items-center justify-between text-[11px] hover:text-primary text-left"
                  >
                    <span className={`font-medium ${isToday ? "text-primary" : ""}`}>{format(day, "d")}</span>
                    {(dayAppts.length > 0 || dayOver.length > 0) && (
                      <span className="text-[10px] text-muted-foreground">{dayAppts.length || ""}{dayOver.length > 0 ? " ⛔" : ""}</span>
                    )}
                  </button>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayAppts.slice(0, 3).map((a) => {
                      const sp = staff.find((s) => s.id === a.staff_id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => navigate(`/staff/appointments/${a.id}`)}
                          className="w-full text-left text-[10px] rounded px-1 py-0.5 border-l-2 truncate"
                          style={{ borderLeftColor: sp?.color ?? "#c97c5d", background: a.status === "pending" ? "#fef3c7" : "#f0fdf4" }}
                          title={`${format(new Date(a.start_at), "h:mm a")} ${a.client_first_name} ${a.client_last_name}`}
                        >
                          {format(new Date(a.start_at), "h:mma")} {a.client_first_name}
                        </button>
                      );
                    })}
                    {dayAppts.length > 3 && (
                      <button
                        type="button"
                        onClick={() => { setDayDate(day); setView("day"); }}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        +{dayAppts.length - 3} more
                      </button>
                    )}
                  </div>
                  {dayAppts.length === 0 && dayOver.length === 0 && inMonth && (
                    <button
                      type="button"
                      onClick={() => navigate(`/staff/appointments/new?date=${dateParam}`)}
                      className="mt-auto text-[10px] text-muted-foreground hover:text-foreground opacity-0 hover:opacity-100 transition-opacity"
                    >
                      + Book
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={view === "week" ? "grid grid-cols-7 gap-2" : "max-w-2xl mx-auto"}>
          {weekDays.map((day) => {
            const dayAppts = visibleAppts.filter((a) => isSameDay(new Date(a.start_at), day)).sort((a, b) => a.start_at.localeCompare(b.start_at));
            const dayOver = visibleOverrides.filter((o) => isSameDay(new Date(o.start_at), day));
            const dateParam = format(day, "yyyy-MM-dd");
            const goBook = () => navigate(`/staff/appointments/new?date=${dateParam}`);
            return (
              <div key={day.toISOString()} className={`rounded-xl border border-border bg-card group ${view === "week" ? "min-h-[280px]" : "min-h-[400px]"}`}>
                <button
                  type="button"
                  onClick={goBook}
                  title="Book an appointment on this day"
                  className="w-full px-3 py-2 border-b border-border flex items-center justify-between hover:bg-accent/40 transition-colors text-left"
                >
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{format(day, view === "week" ? "EEE" : "EEEE")}</div>
                  <div className="flex items-center gap-1.5">
                    <Plus className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                    <span className={`text-sm font-serif ${isSameDay(day, new Date()) ? "text-primary" : ""}`}>{format(day, "MMM d")}</span>
                  </div>
                </button>
                <div className="p-2 space-y-1.5">
                  {dayOver.map((o) => (
                    <div key={o.id} className={`text-[10px] rounded-md px-2 py-1.5 ${o.override_type === "block" ? "bg-destructive-soft text-destructive-soft-foreground" : "bg-success-soft text-success-soft-foreground"}`}>
                      {o.override_type === "block" ? "🚫 " : "+ "}{o.reason || (o.override_type === "block" ? "Time off" : "Extra")}
                    </div>
                  ))}
                  {dayAppts.map((a) => {
                    const sp = staff.find((s) => s.id === a.staff_id);
                    const loc = locations.find((l) => l.id === a.location_id);
                    const names = apptServices[a.id];
                    const label = names && names.length > 0
                      ? names.join(" + ")
                      : (services.find((s) => s.id === a.service_id)?.name ?? "");
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => navigate(`/staff/appointments/${a.id}`)}
                        className="w-full text-left text-[11px] rounded-md p-1.5 border-l-2 hover:ring-1 hover:ring-foreground/20 transition-all"
                        style={{ borderLeftColor: sp?.color ?? "#c97c5d", background: a.status === "pending" ? "#fef3c7" : "#f0fdf4" }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="font-medium">{format(new Date(a.start_at), "h:mm a")}</div>
                          {loc && <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground"><MapPin className="h-2.5 w-2.5" />{loc.name.split(" ")[0]}</span>}
                        </div>
                        <div className="truncate" title={label}>{label}</div>
                        <div className="truncate text-muted-foreground">{a.client_first_name} {a.client_last_name?.[0] ?? ""}.</div>
                      </button>
                    );
                  })}
                  {dayAppts.length === 0 && dayOver.length === 0 && (
                    <button
                      type="button"
                      onClick={goBook}
                      className="w-full text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent/40 rounded-md py-4 flex items-center justify-center gap-1 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Book
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-warning-soft" /> Pending</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-success-soft" /> Approved</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-destructive-soft" /> Time off</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-success-soft" /> Extra availability</span>
      </div>
    </div>
  );
}
