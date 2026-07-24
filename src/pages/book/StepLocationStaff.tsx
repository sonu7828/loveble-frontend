import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowRight, MapPin } from "lucide-react";
import type { Location, Service, Staff, ProviderRow } from "./types";

export const StepLocationStaff = ({
  services, locations, staff, locationId, staffId, onLocation, onStaff, canContinue, onContinue,
}: {
  services: Service[]; locations: Location[]; staff: Staff[]; providers: ProviderRow[];
  locationId: string | null; staffId: string | null;
  onLocation: (id: string) => void; onStaff: (id: string) => void;
  canContinue: boolean; onContinue: () => void;
}) => {
  const label = services.map(s => s.name).join(" + ");
  return (
    <div>
      <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl mb-1 font-medium text-foreground">Where & with whom?</h1>
      <p className="text-xs sm:text-sm text-muted-foreground mb-5">
        For your <span className="text-foreground font-medium">{label}</span> appointment.
      </p>

      {locations.length > 1 && (
        <div className="mb-5">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Location</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
            {locations.map(l => (
              <button key={l.id} onClick={() => onLocation(l.id)}
                className={`rounded-xl border p-3.5 sm:p-4 text-left transition ${locationId === l.id ? "border-primary bg-primary/5 shadow-xs" : "border-border bg-card hover:border-primary/50"}`}>
                <div className="flex items-center gap-2 font-serif text-base sm:text-lg font-medium"><MapPin className="h-4 w-4 text-primary shrink-0" />{l.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{l.address}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {locationId && staff.length > 0 && (
        <div className="mb-5">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Provider</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
            {staff.map(s => (
              <button key={s.id} onClick={() => onStaff(s.id)}
                className={`rounded-xl border p-3.5 sm:p-4 text-left transition ${staffId === s.id ? "border-primary bg-primary/5 shadow-xs" : "border-border bg-card hover:border-primary/50"}`}>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold text-white shadow-xs" style={{ background: s.color }}>
                    {s.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-xs sm:text-sm text-foreground leading-snug">{s.full_name}</div>
                    <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{s.title}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="md:hidden h-16" aria-hidden />
      <div className="fixed bottom-0 inset-x-0 md:static md:mt-4 bg-background/95 backdrop-blur md:backdrop-blur-none border-t md:border-0 border-border p-4 md:p-0 z-30">
        <Button onClick={onContinue} disabled={!canContinue} size="lg" className="rounded-full px-8 w-full md:w-auto">
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
