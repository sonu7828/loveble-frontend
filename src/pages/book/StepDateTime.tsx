import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { CANCELLATION_POLICY_SHORT } from "@/lib/cancellationPolicy";

export const StepDateTime = ({
  date, onDate, slot, onSlot, slots, loading, onContinue, durationMin, serviceIds, locationId, staffId,
}: {
  date: Date | undefined; onDate: (d: Date | undefined) => void;
  slot: string | null; onSlot: (s: string) => void;
  slots: string[]; loading: boolean; onContinue: () => void; durationMin: number;
  serviceIds: string[]; locationId: string; staffId: string | null;
}) => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-4 pb-3 border-b border-border/50">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight">Pick a time</h1>
          <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-foreground">Approx. {durationMin} min</span>
            <span className="text-muted-foreground/40">•</span>
            <span>Live availability</span>
            <span className="text-muted-foreground/40">•</span>
            <span>No charge today</span>
            <span className="text-muted-foreground/40">•</span>
            <span>{CANCELLATION_POLICY_SHORT}</span>
          </p>
        </div>
      </div>

      <SlotPicker
        serviceIds={serviceIds}
        staffId={staffId}
        locationId={locationId}
        value={slot}
        onChange={onSlot}
        onDateChange={onDate}
        externalSlots={date ? slots : undefined}
        externalSlotsLoading={loading}
      />

      <div className="md:hidden h-20" aria-hidden />
      <div className="fixed bottom-0 inset-x-0 md:static md:mt-6 bg-background/95 backdrop-blur md:backdrop-blur-none border-t md:border-0 border-border p-4 md:p-0 z-30">
        <Button onClick={onContinue} disabled={!slot} size="lg" className="rounded-full px-8 w-full md:w-auto font-medium">
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
