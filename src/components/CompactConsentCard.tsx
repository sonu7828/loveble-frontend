// Compact consent card for the streamlined remote signing flow.
// Each card has: title, expand-to-read body, one master "I've read & agree"
// checkbox (which auto-fills every detailed attestation flag), and for
// optional forms a small Accept / Decline toggle. The actual signature is
// captured once at the bottom of the page via <SharedConsentSigner /> and
// applied to every accepted card.
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ChevronDown, ChevronUp, FileText, X } from "lucide-react";
import type { ConsentFormData, SignaturePayload } from "@/components/ConsentSigner";

// Mirror ConsentSigner's attestation lists so audit/compliance records stay
// identical to the per-form flow. Updating this list in one place would be
// nicer but keeping both files explicit avoids accidental drift.
const UNIVERSAL = [
  "read_document",
  "questions_answered",
  "no_guarantee",
  "may_refuse",
] as const;
const INJECTION = ["not_pregnant", "vascular_risk", "emergency_action"] as const;
const ENERGY = ["pih_risk", "sun_avoidance"] as const;

const INJECTION_SLUGS = new Set([
  "neurotoxins", "dermal-fillers", "radiesse", "lipolytic", "exosomes",
  "hyaluronidase-consent-ca", "full-face-block",
  "glp1-weight-management-consent", "peptide-therapy-consent", "hrt-consent",
]);
const ENERGY_SLUGS = new Set([
  "co2-laser", "ipl", "laser-hair", "nd-yag-laser", "pico-laser",
  "microneedling", "chemical-peels", "exilis", "hifem",
]);

function attestationKeysForSlug(slug: string): string[] {
  const keys: string[] = [...UNIVERSAL];
  if (INJECTION_SLUGS.has(slug)) keys.push(...INJECTION);
  if (ENERGY_SLUGS.has(slug)) keys.push(...ENERGY);
  return keys;
}

export interface CompactValue {
  /** Master "I've read and agree" — sets every attestation flag true. */
  agreed: boolean;
  /** Optional forms only — true if client explicitly declined. */
  declined: boolean;
}

interface Props {
  form: ConsentFormData;
  value: CompactValue;
  onChange: (next: CompactValue) => void;
}

export function CompactConsentCard({ form, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const isAccepted = value.agreed && !value.declined;
  const isDeclined = !!value.declined;
  const isComplete = isAccepted || (form.is_optional && isDeclined);

  const subtitle = isAccepted
    ? "Ready to sign"
    : isDeclined
    ? "Declined"
    : form.is_optional
    ? "Tap to read — accept or decline"
    : "Tap to read & agree";

  return (
    <div className={`rounded-2xl border ${isComplete ? "border-primary/40 bg-primary/5" : "border-border bg-card"} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${isComplete ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
            {isAccepted ? <Check className="h-4 w-4" /> : isDeclined ? <X className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm leading-snug">
              {form.title}
              {form.is_optional && (
                <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">Optional</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-background p-4 text-xs leading-relaxed whitespace-pre-wrap">
            {form.body_markdown}
          </div>

          {form.is_optional && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChange({ agreed: true, declined: false })}
                className={`rounded-lg border px-3 py-3 text-sm flex items-center justify-center gap-2 ${
                  isAccepted ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground"
                }`}
              >
                <Check className="h-4 w-4" /> I consent
              </button>
              <button
                type="button"
                onClick={() => onChange({ agreed: false, declined: true })}
                className={`rounded-lg border px-3 py-3 text-sm flex items-center justify-center gap-2 ${
                  isDeclined ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground"
                }`}
              >
                <X className="h-4 w-4" /> I decline
              </button>
            </div>
          )}

          {(!form.is_optional || isAccepted) && (
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border bg-background p-3">
              <Checkbox
                checked={value.agreed}
                onCheckedChange={(c) => onChange({ agreed: !!c, declined: false })}
                className="mt-0.5"
              />
              <span className="text-sm leading-snug">
                I have read this document, had my questions answered, understand no
                outcome is guaranteed, and I may refuse treatment at any time.
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

/** Build the attestation flags object recorded with the signature. */
export function buildAttestationFlags(form: ConsentFormData, agreed: boolean): Record<string, boolean> {
  if (!agreed) return {};
  const keys = attestationKeysForSlug(form.slug);
  const flags: Record<string, boolean> = {};
  for (const k of keys) flags[k] = true;
  return flags;
}

/** Build the signature payload sent to the backend for a single form. */
export function buildPayloadFor(
  form: ConsentFormData,
  value: CompactValue,
  shared: { name: string; signaturePng: string },
): SignaturePayload | null {
  if (form.is_optional && value.declined) {
    return {
      signedFullName: shared.name,
      signaturePng: "",
      decision: "decline",
      attestationFlags: {},
      clientAttestedReview: true,
    };
  }
  if (!value.agreed) return null;
  return {
    signedFullName: shared.name,
    signaturePng: shared.signaturePng,
    decision: "consent",
    attestationFlags: buildAttestationFlags(form, true),
    clientAttestedReview: true,
  };
}

