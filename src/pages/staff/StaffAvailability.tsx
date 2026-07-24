import { confirmDialog } from "@/components/ui/confirm";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface Sched {
  id: string; staff_id: string; location_id: string; day_of_week: number;
  start_time: string; end_time: string; recurrence: string;
  anchor_date: string | null; weeks_of_month: number[] | null; is_active: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RECURRENCES = [
  { value: "weekly", label: "Every week" },
  { value: "alternating_weeks", label: "Every other week" },
  { value: "nth_weekday_of_month", label: "Specific weeks of month" },
];

type FormState = {
  id?: string;
  location_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  recurrence: string;
  anchor_date: string;
  weeks_of_month: number[];
  is_active: boolean;
};

const emptyForm = (location_id = ""): FormState => ({
  location_id,
  day_of_week: 1,
  start_time: "09:00",
  end_time: "17:00",
  recurrence: "weekly",
  anchor_date: new Date().toISOString().slice(0, 10),
  weeks_of_month: [1],
  is_active: true,
});

export default function StaffAvailability() {
  const { staffId, isAdmin } = useAuth();
  const [staffList, setStaffList] = useState<{ id: string; full_name: string }[]>([]);
  const [activeStaff, setActiveStaff] = useState<string | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [scheds, setScheds] = useState<Sched[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, l] = await Promise.all([
        supabase.from("staff_profiles").select("id, full_name").eq("is_active", true),
        supabase.from("locations").select("id, name").eq("is_active", true),
      ]);
      setStaffList(s.data ?? []);
      setLocations(l.data ?? []);
      setActiveStaff(staffId ?? s.data?.[0]?.id ?? null);
    })();
  }, [staffId]);

  const reload = async (sid: string) => {
    setLoading(true);
    const { data } = await supabase.from("weekly_schedules").select("*").eq("staff_id", sid);
    setScheds(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!activeStaff) return;
    reload(activeStaff);
  }, [activeStaff]);

  const formatRecurrence = (s: Sched) => {
    if (s.recurrence === "weekly") return "Every week";
    if (s.recurrence === "alternating_weeks") return `Every other week (from ${s.anchor_date})`;
    if (s.recurrence === "nth_weekday_of_month") return `Weeks ${s.weeks_of_month?.join(", ")} of each month`;
    return s.recurrence;
  };

  const toggleActive = async (s: Sched) => {
    const { error } = await supabase.from("weekly_schedules").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    setScheds((prev) => prev.map((x) => x.id === s.id ? { ...x, is_active: !x.is_active } : x));
    toast.success(s.is_active ? "Hidden from booking" : "Visible to clients");
  };

  const openNew = () => {
    setForm(emptyForm(locations[0]?.id ?? ""));
    setOpen(true);
  };

  const openEdit = (s: Sched) => {
    setForm({
      id: s.id,
      location_id: s.location_id,
      day_of_week: s.day_of_week,
      start_time: s.start_time.slice(0, 5),
      end_time: s.end_time.slice(0, 5),
      recurrence: s.recurrence,
      anchor_date: s.anchor_date ?? new Date().toISOString().slice(0, 10),
      weeks_of_month: s.weeks_of_month ?? [1],
      is_active: s.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!activeStaff) return;
    if (!form.location_id) { toast.error("Pick a location"); return; }
    if (form.start_time >= form.end_time) { toast.error("End time must be after start time"); return; }
    setSaving(true);
    const payload: any = {
      staff_id: activeStaff,
      location_id: form.location_id,
      day_of_week: form.day_of_week,
      start_time: form.start_time,
      end_time: form.end_time,
      recurrence: form.recurrence,
      is_active: form.is_active,
      anchor_date: form.recurrence === "alternating_weeks" ? form.anchor_date : null,
      weeks_of_month: form.recurrence === "nth_weekday_of_month" ? form.weeks_of_month : null,
    };
    const { error } = form.id
      ? await supabase.from("weekly_schedules").update(payload).eq("id", form.id)
      : await supabase.from("weekly_schedules").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setOpen(false);
    await reload(activeStaff);
  };

  const remove = async (s: Sched) => {
    if (!(await confirmDialog({ title: "Delete this schedule block?", destructive: true, confirmLabel: "Delete" }))) return;
    const { error } = await supabase.from("weekly_schedules").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    setScheds((prev) => prev.filter((x) => x.id !== s.id));
    toast.success("Deleted");
  };

  const toggleWeek = (n: number) => {
    setForm((f) => ({
      ...f,
      weeks_of_month: f.weeks_of_month.includes(n)
        ? f.weeks_of_month.filter((w) => w !== n)
        : [...f.weeks_of_month, n].sort(),
    }));
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">My Availability</h1>
          <p className="text-xs text-muted-foreground mt-1">Your recurring weekly hours. For one-off changes use Time Off & Extras.</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-sm px-4 py-2"
        >
          <Plus className="h-4 w-4" /> Add hours
        </button>
      </div>

      {isAdmin && staffList.length > 1 && (
        <div className="mb-5">
          <select value={activeStaff ?? ""} onChange={(e) => setActiveStaff(e.target.value)}
            className="rounded-full border border-border bg-background text-sm px-4 py-2">
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : scheds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No weekly schedule configured yet. Click <strong>Add hours</strong> to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {scheds
            .slice()
            .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
            .map((s) => {
            const loc = locations.find((l) => l.id === s.location_id);
            return (
              <div key={s.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{DAYS[s.day_of_week]} · {s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{loc?.name} · {formatRecurrence(s)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleActive(s)}
                    className={`text-xs px-3 py-1.5 rounded-full ${s.is_active ? "bg-success-soft text-success-soft-foreground" : "bg-secondary text-muted-foreground"}`}>
                    {s.is_active ? "Active" : "Paused"}
                  </button>
                  <button onClick={() => openEdit(s)} className="p-2 rounded-full hover:bg-secondary" aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(s)} className="p-2 rounded-full hover:bg-destructive/10 text-destructive" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit hours" : "Add hours"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Location</label>
              <select
                value={form.location_id}
                onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-background text-sm px-3 py-2"
              >
                <option value="">Select…</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Day of week</label>
              <select
                value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
                className="mt-1 w-full rounded-md border border-border bg-background text-sm px-3 py-2"
              >
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Start</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background text-sm px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">End</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background text-sm px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Recurrence</label>
              <select
                value={form.recurrence}
                onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-background text-sm px-3 py-2"
              >
                {RECURRENCES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            {form.recurrence === "alternating_weeks" && (
              <div>
                <label className="text-xs text-muted-foreground">Anchor date (a date in an "on" week)</label>
                <input
                  type="date"
                  value={form.anchor_date}
                  onChange={(e) => setForm({ ...form, anchor_date: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background text-sm px-3 py-2"
                />
              </div>
            )}

            {form.recurrence === "nth_weekday_of_month" && (
              <div>
                <label className="text-xs text-muted-foreground">Weeks of month</label>
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggleWeek(n)}
                      className={`h-9 w-9 rounded-full text-sm border ${
                        form.weeks_of_month.includes(n)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Active (visible to clients for booking)
            </label>
          </div>
          <DialogFooter>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full border border-border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
