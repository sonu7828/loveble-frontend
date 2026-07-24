import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";
import { Field } from "./Field";
import { formatPhone10 } from "@/lib/formatPhone";

export const StepDetails = ({
  client, setClient, summary, onContinue, fieldErrors, onClearError,
}: {
  client: any; setClient: (c: any) => void;
  summary: { serviceName: string; staffName: string; locationName: string; startAt: string };
  onContinue: () => void;
  fieldErrors: Record<string, string>;
  onClearError: (key: string) => void;
}) => {
  const setField = (k: string, v: string | boolean) => {
    setClient({ ...client, [k]: v });
    if (typeof v === "string" && fieldErrors[k]) onClearError(k);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header & Booking Summary Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-border/50">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight">Your details</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Please provide your contact information to reserve your slot.</p>
        </div>
        
        <div className="text-xs bg-secondary/60 border border-border/60 rounded-xl px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0">
          <span className="font-medium text-foreground">{summary.serviceName}</span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3 text-primary/70" />
            {format(new Date(summary.startAt), "EEE, MMM d @ h:mm a")}
          </span>
          <span className="text-muted-foreground/40 hidden sm:inline">•</span>
          <span className="text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3 text-primary/70" />
            {summary.locationName} ({summary.staffName})
          </span>
        </div>
      </div>

      {/* Main Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <Field label="First name *" error={fieldErrors.firstName}>
          <Input
            id="book-firstName"
            aria-invalid={!!fieldErrors.firstName}
            value={client.firstName}
            onChange={(e) => setField("firstName", e.target.value)}
            maxLength={60}
            className={`h-9 text-sm ${fieldErrors.firstName ? "border-destructive focus-visible:ring-destructive" : ""}`}
            autoComplete="given-name"
            autoCapitalize="words"
          />
        </Field>

        <Field label="Last name *" error={fieldErrors.lastName}>
          <Input
            id="book-lastName"
            aria-invalid={!!fieldErrors.lastName}
            value={client.lastName}
            onChange={(e) => setField("lastName", e.target.value)}
            maxLength={60}
            className={`h-9 text-sm ${fieldErrors.lastName ? "border-destructive focus-visible:ring-destructive" : ""}`}
            autoComplete="family-name"
            autoCapitalize="words"
          />
        </Field>

        <Field label="Date of birth" hint="For medical records">
          <Input
            id="book-dob"
            type="date"
            value={client.dob}
            onChange={(e) => setField("dob", e.target.value)}
            className="h-9 text-sm"
          />
        </Field>

        <Field label="Email *" error={fieldErrors.email}>
          <Input
            id="book-email"
            aria-invalid={!!fieldErrors.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            value={client.email}
            onChange={(e) => setField("email", e.target.value)}
            maxLength={120}
            className={`h-9 text-sm ${fieldErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
          />
        </Field>

        <Field label="Phone (10 digits) *" error={fieldErrors.phone}>
          <Input
            id="book-phone"
            aria-invalid={!!fieldErrors.phone}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(555) 000-0000"
            value={client.phone}
            onChange={(e) => setField("phone", formatPhone10(e.target.value))}
            maxLength={14}
            className={`h-9 text-sm ${fieldErrors.phone ? "border-destructive focus-visible:ring-destructive" : ""}`}
          />
        </Field>

        <Field label="Notes (optional)">
          <Input
            id="book-notes"
            placeholder="Special requests or notes..."
            value={client.notes}
            onChange={(e) => setClient({ ...client, notes: e.target.value })}
            maxLength={1000}
            className="h-9 text-sm"
          />
        </Field>
      </div>

      {/* Consents & Agreements Box */}
      <div className={`mt-4 rounded-xl border p-3.5 space-y-2.5 bg-muted/15 ${fieldErrors.nppAck ? "border-destructive/80 bg-destructive/5" : "border-border/70"}`}>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={!!client.nppAck}
            onChange={(e) => {
              setClient({ ...client, nppAck: e.target.checked });
              if (e.target.checked && fieldErrors.nppAck) onClearError("nppAck");
            }}
            className="mt-0.5 h-4 w-4 accent-primary rounded shrink-0 cursor-pointer"
          />
          <span className="text-xs text-foreground/90 leading-snug">
            I acknowledge that I have reviewed the{" "}
            <a href="/privacy-practices" target="_blank" rel="noopener noreferrer" className="underline font-medium text-foreground hover:text-primary">
              Notice of Privacy Practices
            </a>{" "}
            describing how my health data is protected. <span className="text-destructive font-bold">*</span>
          </span>
        </label>
        {fieldErrors.nppAck && <p className="text-xs text-destructive font-medium pl-6">{fieldErrors.nppAck}</p>}

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={!!client.smsOptIn}
            onChange={(e) => setClient({ ...client, smsOptIn: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-primary rounded shrink-0 cursor-pointer"
          />
          <span className="text-xs text-muted-foreground leading-snug">
            Send SMS appointment confirmations & reminders. <span className="text-[11px] opacity-70">(Reply STOP anytime to cancel)</span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={!!client.marketingOptIn}
            onChange={(e) => setClient({ ...client, marketingOptIn: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-primary rounded shrink-0 cursor-pointer"
          />
          <span className="text-xs text-muted-foreground leading-snug">
            Subscribe to email news & exclusive skincare specials.
          </span>
        </label>
      </div>

      {/* Action Button */}
      <div className="md:hidden h-20" aria-hidden />
      <div className="fixed bottom-0 inset-x-0 md:static md:mt-5 bg-background/95 backdrop-blur md:backdrop-blur-none border-t md:border-0 border-border p-4 md:p-0 z-30">
        <Button onClick={onContinue} size="lg" className="rounded-full px-8 w-full md:w-auto font-medium">
          Continue to consents <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
