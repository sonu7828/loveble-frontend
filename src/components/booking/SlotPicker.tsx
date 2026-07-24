// Shared availability calendar + slot grid used by both the public booking
// funnel (StepDateTime) and the rebook/reschedule dialog (BookingStatus).
// Owning the data fetch + UI in one place keeps the two flows visually and
// behaviorally identical — pick a calendar day, see slot buttons, done.
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { ArrowRight, Clock, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  serviceIds: string[];
  staffId: string | null;
  locationId: string | null;
  value: string | null;
  onChange: (slotIso: string) => void;
  /** Compact = dialog/popover variant (smaller paddings, single column). */
  compact?: boolean;
  /** Hide the "Next available" shortcut (reschedule flows don't need it). */
  hideNextAvailable?: boolean;
  /** Pre-loaded per-day slots — if provided, skips the per-day fetch. */
  externalSlots?: string[];
  externalSlotsLoading?: boolean;
  onDateChange?: (d: Date | undefined) => void;
}

export function SlotPicker({
  serviceIds, staffId, locationId, value, onChange,
  compact, hideNextAvailable, externalSlots, externalSlotsLoading, onDateChange,
}: Props) {
  const tomorrow = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1); return d;
  }, []);
  const max = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d; }, []);

  const [date, setDate] = useState<Date | undefined>();
  const [availableSet, setAvailableSet] = useState<Set<string>>(new Set());
  const [nextAvail, setNextAvail] = useState<{ date: string; slot: string } | null>(null);
  const [loadingRange, setLoadingRange] = useState(true);
  const [internalSlots, setInternalSlots] = useState<string[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);

  const slots = externalSlots ?? internalSlots;
  const loadingSlots = externalSlots ? !!externalSlotsLoading : internalLoading;

  // Load the 6-month availability map so the calendar can dim unavailable days.
  useEffect(() => {
    if (serviceIds.length === 0 || !locationId || !staffId) return;
    setLoadingRange(true);
    supabase.functions.invoke("get-availability-range", {
      body: { serviceIds, staffId, locationId, days: 180 },
    }).then(({ data }) => {
      setAvailableSet(new Set(data?.availableDates ?? []));
      setNextAvail(data?.nextAvailable ?? null);
      setLoadingRange(false);
    });
  }, [serviceIds.join(","), locationId, staffId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-day slot fetch (only when caller did not provide externalSlots).
  useEffect(() => {
    if (externalSlots) return;
    if (!date || serviceIds.length === 0 || !staffId || !locationId) {
      setInternalSlots([]); return;
    }
    setInternalLoading(true);
    supabase.functions.invoke("get-availability", {
      body: { serviceIds, staffId, locationId, date: format(date, "yyyy-MM-dd") },
    }).then(({ data }) => {
      setInternalSlots(data?.slots ?? []);
      setInternalLoading(false);
    });
  }, [date, serviceIds.join(","), staffId, locationId, externalSlots]); // eslint-disable-line react-hooks/exhaustive-deps

  const ymd = (d: Date) => format(d, "yyyy-MM-dd");

  const setDateAndNotify = (d: Date | undefined) => {
    setDate(d);
    onDateChange?.(d);
  };

  const pickNext = () => {
    if (!nextAvail) return;
    const [y, m, dd] = nextAvail.date.split("-").map(Number);
    setDateAndNotify(new Date(y, m - 1, dd));
    setTimeout(() => onChange(nextAvail.slot), 600);
  };

  const layout = compact
    ? "flex flex-col gap-4"
    : "flex flex-col md:flex-row items-start gap-5 sm:gap-6";

  return (
    <div>
      {!hideNextAvailable && nextAvail && !loadingRange && (
        <button
          type="button"
          onClick={pickNext}
          className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 transition px-3.5 py-1.5 mb-4 text-xs font-medium"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-muted-foreground">Next available:</span>
          <span className="text-primary font-semibold">
            {format(new Date(nextAvail.date + "T12:00:00"), "EEE, MMM d")} @ {format(new Date(nextAvail.slot), "h:mm a")}
          </span>
          <ArrowRight className="h-3 w-3 text-primary/70 ml-0.5" />
        </button>
      )}

      <div className={layout}>
        <div className={`rounded-2xl border border-border bg-card w-full md:w-auto shrink-0 shadow-xs ${compact ? "p-1 sm:p-2" : "p-2 sm:p-2.5"}`}>
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDateAndNotify}
            disabled={(d) => {
              if (d < tomorrow || d > max) return true;
              if (loadingRange) return false;
              return !availableSet.has(ymd(d));
            }}
            modifiers={{ available: (d) => availableSet.has(ymd(d)) }}
            modifiersClassNames={{ available: "font-semibold text-primary" }}
            className="pointer-events-auto mx-auto"
          />
          {!loadingRange && availableSet.size === 0 && (
            <p className="text-xs text-muted-foreground text-center px-3 pb-2">
              No availability in next 6 months.
            </p>
          )}
        </div>

        <div className="flex-1 w-full min-w-0">
          {!date && (
            <div className="rounded-2xl border border-dashed border-border/70 p-6 flex flex-col items-center justify-center text-center text-muted-foreground bg-muted/15 min-h-[220px] h-full">
              <Clock className="h-5 w-5 mb-2 text-muted-foreground/60 stroke-[1.5]" />
              <p className="text-xs font-semibold text-foreground/80">Select a date</p>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">
                Choose a date on the calendar to view available appointment slots.
              </p>
            </div>
          )}

          {date && loadingSlots && (
            <div className="rounded-2xl border border-border/50 p-6 flex items-center justify-center gap-2 text-xs text-muted-foreground min-h-[200px]">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Fetching available times…
            </div>
          )}

          {date && !loadingSlots && slots.length === 0 && (
            <div className="rounded-2xl border border-border/50 p-6 flex flex-col items-center justify-center text-center text-muted-foreground bg-muted/10 min-h-[200px]">
              <p className="text-xs font-medium text-foreground">No available slots</p>
              <p className="text-[11px] text-muted-foreground mt-1">Please select another date on the calendar.</p>
            </div>
          )}

          {date && !loadingSlots && slots.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-medium text-foreground/90">
                  Available times · <span className="text-primary font-semibold">{format(date, "EEE, MMM d")}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {slots.length} {slots.length === 1 ? "slot" : "slots"}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Available times">
                {slots.map((s) => {
                  const isSel = value === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onChange(s)}
                      role="radio"
                      aria-checked={isSel}
                      className={`rounded-xl border h-10 px-2 text-xs font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                        isSel
                          ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "border-border/80 bg-background hover:border-primary/50 hover:bg-accent/40 text-foreground"
                      }`}
                    >
                      {format(new Date(s), "h:mm a")}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
