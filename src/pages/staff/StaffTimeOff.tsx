import { confirmDialog } from "@/components/ui/confirm";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Override {
  id: string; staff_id: string; location_id: string | null;
  start_at: string; end_at: string; override_type: "block" | "extra_availability";
  reason: string | null;
}

export default function StaffTimeOff() {
  const { staffId, isAdmin } = useAuth();
  const [staffList, setStaffList] = useState<{ id: string; full_name: string }[]>([]);
  const [activeStaff, setActiveStaff] = useState<string | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [type, setType] = useState<"block" | "extra_availability">("block");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [allDay, setAllDay] = useState(true);
  const [endDate, setEndDate] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [reason, setReason] = useState("");
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

  const load = async (sid: string) => {
    setLoading(true);
    const { data } = await supabase.from("schedule_overrides").select("*")
      .eq("staff_id", sid).gte("end_at", new Date().toISOString()).order("start_at");
    setItems((data ?? []) as Override[]);
    setLoading(false);
  };

  useEffect(() => { if (activeStaff) load(activeStaff); }, [activeStaff]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStaff || !date) return;
    const sd = allDay ? `${date}T00:00:00` : `${date}T${startTime}:00`;
    const ed = allDay
      ? `${endDate || date}T23:59:59`
      : `${date}T${endTime}:00`;
    if (new Date(ed) <= new Date(sd)) { toast.error("End must be after start"); return; }
    setSaving(true);
    const { error } = await supabase.from("schedule_overrides").insert({
      staff_id: activeStaff,
      location_id: locationId || null,
      start_at: new Date(sd).toISOString(),
      end_at: new Date(ed).toISOString(),
      override_type: type,
      reason: reason.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setShowForm(false);
    setReason(""); setDate(""); setEndDate("");
    if (activeStaff) load(activeStaff);
  };

  const remove = async (id: string) => {
    if (!(await confirmDialog({ title: "Remove this entry?", destructive: true, confirmLabel: "Remove" }))) return;
    const { error } = await supabase.from("schedule_overrides").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl">Time Off & Extras</h1>
          <p className="text-xs text-muted-foreground mt-1">Block your calendar for vacation, or add extra hours outside your normal schedule.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="rounded-full"><Plus className="h-3.5 w-3.5 mr-1" />Add entry</Button>
      </div>

      {isAdmin && staffList.length > 1 && (
        <div className="mb-5">
          <select value={activeStaff ?? ""} onChange={(e) => setActiveStaff(e.target.value)}
            className="rounded-full border border-border bg-background text-sm px-4 py-2">
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 mb-6 space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => setType("block")}
              className={`flex-1 rounded-xl border p-3 text-sm transition ${type === "block" ? "border-primary bg-primary/5" : "border-border"}`}>
              🚫 Block time (vacation, off-day)
            </button>
            <button type="button" onClick={() => setType("extra_availability")}
              className={`flex-1 rounded-xl border p-3 text-sm transition ${type === "extra_availability" ? "border-primary bg-primary/5" : "border-border"}`}>
              + Extra availability
            </button>
          </div>

          <div>
            <Label>Location</Label>
            <select required={type === "extra_availability"} value={locationId} onChange={(e) => setLocationId(e.target.value)}
              className="w-full mt-1.5 rounded-md border border-border bg-background text-sm px-3 py-2">
              {type === "block" && <option value="">All locations</option>}
              {type === "extra_availability" && <option value="">Choose…</option>}
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              {type === "block"
                ? "Choose a location to block only that studio, or leave All locations to block every studio."
                : "Extra availability only opens the selected studio; it does not close existing weekly hours elsewhere."}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <input type="checkbox" id="allday" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            <label htmlFor="allday">All day {type === "block" ? "(or multiple days)" : ""}</label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>{allDay ? "Start date" : "Date"}</Label>
              <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
            </div>
            {allDay ? (
              <div>
                <Label>End date (optional)</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1.5" />
              </div>
            ) : (
              <>
                <div>
                  <Label>Start time</Label>
                  <Input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label>End time</Label>
                  <Input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1.5" />
                </div>
              </>
            )}
          </div>

          <div>
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vacation, conference, etc." className="mt-1.5" />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="rounded-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="rounded-full">Cancel</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">No upcoming time off or extras.</div>
      ) : (
        <div className="space-y-2">
          {items.map((o) => (
            <div key={o.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">
                  <span className={`inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full mr-2 ${o.override_type === "block" ? "bg-destructive-soft text-destructive-soft-foreground" : "bg-success-soft text-success-soft-foreground"}`}>
                    {o.override_type === "block" ? "Block" : "Extra"}
                  </span>
                  {format(new Date(o.start_at), "EEE, MMM d, h:mm a")} → {format(new Date(o.end_at), "MMM d, h:mm a")}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {locations.find((l) => l.id === o.location_id)?.name ?? "All locations"}
                  {o.reason ? ` · ${o.reason}` : ""}
                </div>
              </div>
              <button onClick={() => remove(o.id)} className="text-muted-foreground hover:text-destructive p-2"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
