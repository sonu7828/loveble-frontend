import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowRight, MapPin, User, Users, AlertCircle, Check } from "lucide-react";
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

  // Auto-select location if only 1 location exists or none selected
  useEffect(() => {
    if (!locationId && locations.length > 0) {
      onLocation(locations[0].id);
    }
  }, [locations, locationId, onLocation]);

  // Auto-select provider if none selected
  useEffect(() => {
    if (!staffId || (staffId === "any-available" && staff.length > 0)) {
      if (staff.length > 0) {
        onStaff(staff[0].id);
      } else {
        onStaff("any-available");
      }
    }
  }, [staff, staffId, onStaff]);

  const selectedLoc = locations.find(l => l.id === locationId) || locations[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-foreground tracking-tight mb-1">
          Clinic Location & Specialist
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Your treatment for <span className="text-foreground font-semibold">{label}</span> will take place at our San Jose clinic.
        </p>
      </div>

      {/* Location Section */}
      <div>
        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2.5 block">
          Appointment Location
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {locations.length > 0 ? (
            locations.map(l => {
              const isSelected = (locationId || selectedLoc?.id) === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onLocation(l.id)}
                  className={`rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer flex items-start gap-3.5 ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-2xs ring-1 ring-primary/30"
                      : "border-border/80 bg-card hover:border-primary/40"
                  }`}
                >
                  <span className={`p-2.5 rounded-xl ${isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                    <MapPin className="h-5 w-5 shrink-0" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-base sm:text-lg font-semibold text-foreground leading-snug">
                      San Jose Clinic
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      2100 Curtner Ave, Ste 1B, San Jose, CA 95124
                    </div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary shrink-0 mt-1" />}
                </button>
              );
            })
          ) : (
            <button
              type="button"
              className="rounded-2xl border border-primary bg-primary/5 p-4 text-left flex items-start gap-3.5"
            >
              <span className="p-2.5 rounded-xl bg-primary text-primary-foreground">
                <MapPin className="h-5 w-5 shrink-0" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-serif text-base sm:text-lg font-semibold text-foreground leading-snug">
                  San Jose Clinic
                </div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  2100 Curtner Ave, Ste 1B, San Jose, CA 95124
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Provider Selector */}
      <div>
        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2.5 block">
          Select Practitioner / Provider
        </Label>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Option A: Only show 'Any Available Provider' if no specific provider exists */}
          {staff.length === 0 && (
            <button
              type="button"
              onClick={() => onStaff("any-available")}
              className={`rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer flex items-center gap-3.5 ${
                staffId === "any-available" || !staffId
                  ? "border-primary bg-primary/5 shadow-2xs ring-1 ring-primary/30"
                  : "border-border/80 bg-card hover:border-primary/40"
              }`}
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-xs sm:text-sm text-foreground">Any Available Provider</div>
                <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                  First available licensed specialist
                </div>
              </div>
            </button>
          )}

          {/* Option B: Specific Registered Providers */}
          {staff.length > 0 &&
            staff.map(s => {
              const isSelected = staffId === s.id;
              const name = s.full_name || (s as any).fullName || (s as any).name || "Staff Member";
              const initials = name.trim().split(/\s+/).map(n => n[0]).join("").slice(0, 2).toUpperCase() || "P";
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onStaff(s.id)}
                  className={`rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer flex items-center gap-3.5 ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-2xs ring-1 ring-primary/30"
                      : "border-border/80 bg-card hover:border-primary/40"
                  }`}
                >
                  <div
                    className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold text-white shadow-2xs"
                    style={{ background: s.color || "#8B6B5D" }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs sm:text-sm text-foreground leading-snug truncate">
                      {name}
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-snug mt-0.5 truncate">
                      {s.title || "Licensed Practitioner"}
                    </div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })}
        </div>
      </div>

      {/* Continue Action */}
      <div className="pt-4 flex justify-end">
        <Button onClick={onContinue} size="lg" className="rounded-full px-8 font-semibold shadow-md">
          Continue to Date & Time <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
