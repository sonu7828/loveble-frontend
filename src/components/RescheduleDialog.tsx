import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { functionErrorMessage } from "@/lib/functionError";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appointmentId: string;
  /** Primary service id (kept for backward compatibility). */
  serviceId: string;
  /** All services on this appointment. If provided, availability uses the full set so multi-service durations are respected. */
  serviceIds?: string[];
  staffId: string;
  locationId: string;
  currentStartAt: string;
  onRescheduled: () => void;
}

type ProviderRow = { service_id: string; staff_id: string; location_id: string };
type StaffRow = { id: string; full_name: string };

export function RescheduleDialog({ open, onOpenChange, appointmentId, serviceId, serviceIds, staffId, locationId, currentStartAt, onRescheduled }: Props) {
  const { canOverride } = useAuth();
  const [date, setDate] = useState<Date | undefined>();
  const [slot, setSlot] = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [overrideConflict, setOverrideConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>(locationId);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staffId);

  // Always send the full list of services so duration (and thus end_at) matches what will actually be booked.
  const effectiveServiceIds = serviceIds && serviceIds.length > 0 ? serviceIds : [serviceId];
  const effectiveKey = effectiveServiceIds.join(",");

  useEffect(() => {
    if (!open) {
      setDate(undefined); setSlot(""); setSlots([]); setOverrideConflict(false);
      setSelectedLocationId(locationId); setSelectedStaffId(staffId);
    }
  }, [open, locationId, staffId]);

  useEffect(() => {
    Promise.all([
      supabase.from("locations").select("id, name").eq("is_active", true).order("name"),
      supabase.from("service_providers").select("service_id, staff_id, location_id"),
      supabase.from("staff_profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    ]).then(([locs, prov, st]) => {
      setLocations(locs.data ?? []);
      setProviders((prov.data ?? []) as ProviderRow[]);
      setStaffList((st.data ?? []) as StaffRow[]);
    });
  }, []);

  // Eligible providers: must offer ALL selected services at the selected location.
  const eligibleStaff = useMemo(() => {
    if (providers.length === 0 || staffList.length === 0) return [];
    const ids = staffList
      .map((s) => s.id)
      .filter((sid) =>
        effectiveServiceIds.every((svcId) =>
          providers.some((p) => p.staff_id === sid && p.service_id === svcId && p.location_id === selectedLocationId)
        )
      );
    return staffList.filter((s) => ids.includes(s.id));
  }, [providers, staffList, effectiveKey, selectedLocationId]);

  // If the currently selected staff no longer fits the location, fall back to the original staff (and keep the option visible).
  useEffect(() => {
    if (eligibleStaff.length === 0) return;
    if (!eligibleStaff.some((s) => s.id === selectedStaffId)) {
      // Default to the original provider if they're eligible, else first eligible
      const fallback = eligibleStaff.find((s) => s.id === staffId) ?? eligibleStaff[0];
      setSelectedStaffId(fallback.id);
      setDate(undefined); setSlot(""); setSlots([]);
    }
  }, [eligibleStaff, selectedStaffId, staffId]);

  useEffect(() => {
    setSlot("");
    if (!date) { setSlots([]); return; }
    setLoadingSlots(true);
    supabase.functions.invoke("get-availability", {
      body: { serviceIds: effectiveServiceIds, staffId: selectedStaffId, locationId: selectedLocationId, date: format(date, "yyyy-MM-dd"), includeConflicts: canOverride && overrideConflict },
    }).then(({ data }) => {
      setSlots(data?.slots ?? []);
      setLoadingSlots(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, effectiveKey, selectedStaffId, selectedLocationId, canOverride, overrideConflict]);

  const submit = async () => {
    if (!slot) { toast.error("Pick a time"); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("staff-reschedule-appointment", {
      body: {
        appointmentId,
        newStartAt: slot,
        newLocationId: selectedLocationId !== locationId ? selectedLocationId : undefined,
        newStaffId: selectedStaffId !== staffId ? selectedStaffId : undefined,
        overrideConflict: canOverride && overrideConflict,
      },
    });
    setBusy(false);
    if (error || data?.error) {
      const baseMsg = data?.error || await functionErrorMessage(error, "Could not reschedule");
      if (data?.conflict) {
        toast.error(canOverride && !overrideConflict
          ? "Conflicts with another appointment. Toggle \"Schedule override\" above to force it."
          : "Conflicts with another appointment.");
      } else {
        toast.error(baseMsg);
      }
      return;
    }
    toast.success("Appointment rescheduled");
    onOpenChange(false);
    onRescheduled();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Current: {format(new Date(currentStartAt), "EEE, MMM d, yyyy · h:mm a")} (Pacific Time)
          </div>
          {canOverride && (
            <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${overrideConflict ? "border-primary bg-primary/5" : "border-border bg-background/40"}`}>
              <Checkbox checked={overrideConflict} onCheckedChange={(v) => setOverrideConflict(!!v)} className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">Schedule override</div>
                <div className="text-xs text-muted-foreground">
                  Allow rescheduling outside this provider's hours or over an existing appointment.
                </div>
              </div>
            </label>
          )}
          <div>
            <Label>Location</Label>
            <select value={selectedLocationId} onChange={(e) => { setSelectedLocationId(e.target.value); setDate(undefined); setSlot(""); }}
              className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}{l.id === locationId ? " (current)" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Provider</Label>
            <select
              value={selectedStaffId}
              onChange={(e) => { setSelectedStaffId(e.target.value); setDate(undefined); setSlot(""); }}
              className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              disabled={eligibleStaff.length === 0}
            >
              {eligibleStaff.length === 0 && <option value="">No provider offers this at the selected location</option>}
              {eligibleStaff.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}{s.id === staffId ? " (current)" : ""}</option>
              ))}
            </select>
            {selectedStaffId !== staffId && (
              <p className="mt-1 text-xs text-muted-foreground">Provider will be changed on this appointment.</p>
            )}
          </div>
          <div>
            <Label>New date</Label>
            <div className="flex gap-2 mt-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="flex-1 justify-start font-normal">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {date ? format(date, "EEE, MMM d, yyyy") : "Pick a date…"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate}
                    disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))} initialFocus
                    className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDate(new Date())} className="shrink-0">
                Today
              </Button>
            </div>
          </div>
          <div>
            <Label>New time <span className="text-muted-foreground font-normal">(Pacific Time){date && ` · ${slots.length} slots${overrideConflict ? " incl. conflicts" : ""}`}</span></Label>
            <select value={slot} onChange={(e) => setSlot(e.target.value)}
              disabled={!date || loadingSlots || slots.length === 0}
              className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
              <option value="">
                {!date ? "Pick a date first" : loadingSlots ? "Loading…" : slots.length === 0 ? (overrideConflict ? "No slots even with override" : "No availability this day") : "Select time…"}
              </option>
              {slots.map((iso) => (
                <option key={iso} value={iso}>
                  {new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })} PT
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !slot}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
