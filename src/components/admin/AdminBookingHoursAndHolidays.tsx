import { useEffect, useState } from "react";
import { ApiClient } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, Plus, Trash2, Loader2, CalendarX, Check } from "lucide-react";
import { toast } from "sonner";

type ClinicHour = {
  id?: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  startTime: string;
  endTime: string;
  isOpen: boolean;
};

type ClinicHoliday = {
  id: string;
  date: string; // YYYY-MM-DD
  name: string | null;
  isClosed: boolean;
};

const DAY_NAMES = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
];

export function AdminBookingHoursAndHolidays() {
  const [loading, setLoading] = useState(true);
  const [savingDay, setSavingDay] = useState<number | null>(null);

  const [hours, setHours] = useState<Record<number, ClinicHour>>({
    1: { dayOfWeek: 1, startTime: "09:00", endTime: "18:00", isOpen: true },
    2: { dayOfWeek: 2, startTime: "10:00", endTime: "20:00", isOpen: true },
    3: { dayOfWeek: 3, startTime: "09:00", endTime: "18:00", isOpen: true },
    4: { dayOfWeek: 4, startTime: "09:00", endTime: "18:00", isOpen: true },
    5: { dayOfWeek: 5, startTime: "10:00", endTime: "17:00", isOpen: true },
    6: { dayOfWeek: 6, startTime: "09:00", endTime: "18:00", isOpen: false },
    0: { dayOfWeek: 0, startTime: "09:00", endTime: "18:00", isOpen: false },
  });

  const [holidays, setHolidays] = useState<ClinicHoliday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [addingHoliday, setAddingHoliday] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.get<any>("/v1/clinic-hours");
      const data = res.data?.data ?? res.data;
      if (data?.hours && Array.isArray(data.hours)) {
        const hoursMap: Record<number, ClinicHour> = { ...hours };
        data.hours.forEach((h: ClinicHour) => {
          hoursMap[h.dayOfWeek] = h;
        });
        setHours(hoursMap);
      }
      if (data?.holidays && Array.isArray(data.holidays)) {
        setHolidays(data.holidays);
      }
    } catch (e) {
      console.warn("Failed to load clinic hours:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveDay = async (dayOfWeek: number) => {
    setSavingDay(dayOfWeek);
    const item = hours[dayOfWeek];
    try {
      await ApiClient.post("/v1/clinic-hours", {
        dayOfWeek: item.dayOfWeek,
        startTime: item.startTime,
        endTime: item.endTime,
        isOpen: item.isOpen,
      });
      toast.success(`Booking hours for ${DAY_NAMES.find((d) => d.day === dayOfWeek)?.label} updated`);
    } catch {
      toast.error("Failed to save booking hours");
    } finally {
      setSavingDay(null);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate) {
      toast.error("Please select a date");
      return;
    }
    setAddingHoliday(true);
    try {
      await ApiClient.post("/v1/clinic-holidays", {
        date: newHolidayDate,
        name: newHolidayName || "Clinic Holiday",
        isClosed: true,
      });
      toast.success("Closed date / Holiday added");
      setNewHolidayDate("");
      setNewHolidayName("");
      loadData();
    } catch {
      toast.error("Failed to add holiday");
    } finally {
      setAddingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      await ApiClient.delete(`/v1/clinic-holidays/${id}`);
      toast.success("Holiday removed");
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } catch {
      toast.error("Failed to remove holiday");
    }
  };

  if (loading) {
    return (
      <Card className="p-6 border border-border bg-card shadow-xs rounded-2xl">
        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading Master Booking Hours &amp; Holidays…
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border border-border bg-card shadow-xs rounded-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="font-serif text-lg font-normal tracking-tight flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> BOOKING HOURS &amp; HOLIDAYS
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Master clinic operating hours and scheduled closed dates. Controls Website, Staff, Admin &amp; Reschedule booking slots.
          </p>
        </div>
      </div>

      {/* 1. WEEKLY BOOKING HOURS */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Weekly Booking Schedule</h3>

        <div className="space-y-2">
          {DAY_NAMES.map(({ day, label }) => {
            const h = hours[day] ?? { dayOfWeek: day, startTime: "09:00", endTime: "18:00", isOpen: true };
            const isSaving = savingDay === day;

            return (
              <div
                key={day}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-muted/20 text-xs"
              >
                <div className="flex items-center gap-3 min-w-[130px]">
                  <input
                    type="checkbox"
                    checked={h.isOpen}
                    onChange={(e) =>
                      setHours((prev) => ({
                        ...prev,
                        [day]: { ...h, isOpen: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 rounded border-border text-primary cursor-pointer"
                  />
                  <span className={`font-medium ${h.isOpen ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                </div>

                {h.isOpen ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={h.startTime}
                      onChange={(e) =>
                        setHours((prev) => ({
                          ...prev,
                          [day]: { ...h, startTime: e.target.value },
                        }))
                      }
                      className="h-8 w-28 text-xs font-mono rounded-lg"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={h.endTime}
                      onChange={(e) =>
                        setHours((prev) => ({
                          ...prev,
                          [day]: { ...h, endTime: e.target.value },
                        }))
                      }
                      className="h-8 w-28 text-xs font-mono rounded-lg"
                    />
                  </div>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground italic px-3">Closed</span>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg cursor-pointer text-xs"
                  disabled={isSaving}
                  onClick={() => handleSaveDay(day)}
                >
                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                  Save
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. CLOSED DATES / HOLIDAYS */}
      <div className="pt-4 border-t border-border space-y-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
            <CalendarX className="h-4 w-4 text-destructive" /> CLOSED DATES / HOLIDAYS
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Add future closed dates. All booking engines return zero slots on these dates.
          </p>
        </div>

        <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-muted/20 p-3.5 rounded-xl border border-border">
          <div>
            <Label className="text-[11px]">Date (YYYY-MM-DD)</Label>
            <Input
              type="date"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              className="h-8 text-xs rounded-lg mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-[11px]">Name / Reason (Optional)</Label>
            <Input
              type="text"
              placeholder="e.g. Christmas, Staff Retreat"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
              className="h-8 text-xs rounded-lg mt-1"
            />
          </div>
          <Button type="submit" disabled={addingHoliday} size="sm" className="h-8 rounded-lg text-xs cursor-pointer">
            {addingHoliday ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            Add Closed Date
          </Button>
        </form>

        {holidays.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-border rounded-xl text-xs text-muted-foreground">
            No upcoming clinic holidays scheduled.
          </div>
        ) : (
          <div className="space-y-2">
            {holidays.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card text-xs">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-destructive" />
                  <div>
                    <span className="font-mono font-medium text-foreground">{h.date}</span>
                    {h.name && <span className="text-muted-foreground ml-2">({h.name})</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                  onClick={() => handleDeleteHoliday(h.id)}
                  title="Remove holiday"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
