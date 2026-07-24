import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Check, Clock, FileSignature, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CardOnFile, type CardOnFileHandle } from "@/components/CardOnFile";
import { CompactConsentCard, type CompactValue } from "@/components/CompactConsentCard";
import { SharedConsentSigner } from "@/components/SharedConsentSigner";
import type { ConsentForm } from "./types";

export const StepConsentsAndPay = ({
  consents, loading,
  consentValues, setConsentValue,
  sharedName, setSharedName, sharedSig, setSharedSig, anyAgreed,
  clientName,
  allConsentsSatisfied, acknowledged, setAcknowledged,
  cardRef, submitting, onSubmit, cardError, clearCardError,
  subStep, setSubStep, summary,
}: {
  consents: ConsentForm[]; loading: boolean;
  consentValues: Record<string, CompactValue>;
  setConsentValue: (id: string, v: CompactValue) => void;
  sharedName: string; setSharedName: (v: string) => void;
  sharedSig: string; setSharedSig: (v: string) => void;
  anyAgreed: boolean;
  clientName: string;
  allConsentsSatisfied: boolean;
  acknowledged: boolean; setAcknowledged: (v: boolean) => void;
  cardRef: React.Ref<CardOnFileHandle>;
  submitting: boolean; onSubmit: () => void;
  cardError: string | null;
  clearCardError: () => void;
  subStep: "consents" | "pay";
  setSubStep: (s: "consents" | "pay") => void;
  summary: { serviceName: string; staffName: string; locationName: string; startAt: string };
}) => {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const toSign = consents.filter(c => !c.alreadySigned);
  const alreadySigned = consents.filter(c => c.alreadySigned);
  const requiredCount = toSign.filter(f => !f.is_optional).length;
  const requiredDone = toSign.filter(f => !f.is_optional && consentValues[f.id]?.agreed).length;
  const optionalLeft = toSign.filter(f => f.is_optional && !(consentValues[f.id]?.agreed || consentValues[f.id]?.declined)).length;


  if (subStep === "consents") {
    const hint = loading
      ? "Loading consent forms…"
      : toSign.length === 0
      ? "No consents needed — continue."
      : requiredDone < requiredCount
      ? `${requiredCount - requiredDone} required form${requiredCount - requiredDone === 1 ? "" : "s"} left to review`
      : optionalLeft > 0
      ? `Accept or decline ${optionalLeft} optional form${optionalLeft === 1 ? "" : "s"}`
      : anyAgreed && (!sharedName.trim() || !sharedSig)
      ? "Type your name and sign once below"
      : "All set — continue";

    return (
      <div className="max-w-3xl mx-auto">
        <div className="pb-3 mb-4 border-b border-border/50">
          <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight">Read & agree</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review and accept required forms below. Sign once to apply your signature across all forms.
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading consent forms…
          </div>
        )}

        {!loading && alreadySigned.length > 0 && (
          <div className="rounded-xl border border-border bg-secondary/30 p-3.5 mb-4">
            <div className="flex items-center gap-2 text-xs font-medium mb-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" /> Already on file
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {alreadySigned.map(c => (
                <li key={c.id} className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-primary" /> {c.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && toSign.length > 0 && (
          <div className="space-y-2.5">
            {toSign.map(form => (
              <div
                key={form.id}
                id={`consent-card-${form.id}`}
                className={`scroll-mt-24 rounded-2xl transition-all duration-500 ${
                  highlightedId === form.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                }`}
              >
                <CompactConsentCard
                  form={form}
                  value={consentValues[form.id] ?? { agreed: false, declined: false }}
                  onChange={(v) => setConsentValue(form.id, v)}
                />
              </div>
            ))}
          </div>
        )}

        {!loading && toSign.length > 0 && (
          <div className="mt-6 scroll-mt-24" id="shared-consent-signer">
            <h2 className="font-serif text-lg mb-2">Sign once for all forms above</h2>
            <SharedConsentSigner
              defaultName={clientName}
              name={sharedName}
              signaturePng={sharedSig}
              onNameChange={setSharedName}
              onSignatureChange={setSharedSig}
            />
          </div>
        )}

        {!loading && consents.length === 0 && (
          <p className="text-sm text-muted-foreground">No consent forms required for this service.</p>
        )}

        <div className="md:hidden h-28" aria-hidden />
        <div className="fixed bottom-0 inset-x-0 md:static md:mt-6 bg-background/95 backdrop-blur md:backdrop-blur-none border-t md:border-0 border-border p-4 md:p-0 z-30 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="text-xs text-muted-foreground text-center sm:text-left flex-1">{hint}</div>
            <Button
              onClick={() => {
                if (loading) return;
                if (allConsentsSatisfied) { setSubStep("pay"); return; }
                toast.error(hint);
                const nextRequired = toSign.find(f => !f.is_optional && !consentValues[f.id]?.agreed)
                  ?? toSign.find(f => f.is_optional && !(consentValues[f.id]?.agreed || consentValues[f.id]?.declined));
                const target = nextRequired
                  ? document.getElementById(`consent-card-${nextRequired.id}`)
                  : document.getElementById("shared-consent-signer");
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
                if (nextRequired) {
                  setHighlightedId(nextRequired.id);
                  window.setTimeout(() => setHighlightedId(null), 1800);
                }
              }}
              size="lg"
              className={`rounded-full px-8 w-full sm:w-auto h-11 text-sm font-medium ${allConsentsSatisfied ? "" : "opacity-60"}`}
              aria-disabled={!allConsentsSatisfied}
            >
              Continue to card on file <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header & Booking Summary Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-border/50">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight">Card on file</h1>
          <p className="text-xs text-muted-foreground mt-0.5">No charge today — your card holds your appointment slot.</p>
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

      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4 shadow-xs">
        <div id="book-card-section" className="scroll-mt-24">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Card on file *</Label>
            <span className="text-[11px] text-muted-foreground">Saved securely with Stripe</span>
          </div>

          <CardOnFile ref={cardRef} ready={!submitting} />
          {cardError && (
            <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive flex items-start justify-between gap-2">
              <span>{cardError}</span>
              <button type="button" onClick={clearCardError} className="underline shrink-0">Dismiss</button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2 text-xs">
          <label className="flex items-start gap-2.5 cursor-pointer" id="book-acknowledge-label">
            <Checkbox id="book-acknowledge" checked={acknowledged} onCheckedChange={(v) => setAcknowledged(!!v)} className="mt-0.5 shrink-0" />
            <span className="text-xs leading-snug text-foreground/90 font-medium">
              I understand the cancellation policy ($200 fee if cancelled within 48 hours). <span className="text-muted-foreground font-normal">No charge today.</span> <span className="text-destructive font-bold">*</span>
            </span>
          </label>
          <p className="text-[11px] text-muted-foreground pl-6 leading-tight">
            Free rescheduling or cancellation up to 48 hours before your scheduled appointment.
          </p>
        </div>
      </div>

      <div className="md:hidden h-20" aria-hidden />
      <div className="fixed bottom-0 inset-x-0 md:static md:mt-5 bg-background/95 backdrop-blur md:backdrop-blur-none border-t md:border-0 border-border p-4 md:p-0 z-30">
        <Button
          onClick={onSubmit}
          disabled={submitting || !allConsentsSatisfied || !acknowledged}
          size="lg"
          className="rounded-full px-8 w-full md:w-auto font-medium shadow-elegant"
        >
          {submitting
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
            : <><FileSignature className="mr-2 h-4 w-4" /> Confirm appointment</>}
        </Button>
      </div>
    </div>
  );
};
