import { useEffect, useMemo, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Eraser, FileText, ChevronDown, ChevronUp, X } from "lucide-react";

export interface ConsentFormData {
  id: string;
  slug: string;
  title: string;
  body_markdown: string;
  version: number;
  is_optional?: boolean;
}

export interface SignaturePayload {
  signedFullName: string;
  signaturePng: string; // data URL (empty when declining)
  decision: "consent" | "decline";
  /** Per-form attestation checkbox values (Cobbs v. Grant compliance). */
  attestationFlags?: Record<string, boolean>;
  /** True only after the client scrolled the full document. */
  clientAttestedReview?: boolean;
}

interface Props {
  form: ConsentFormData;
  defaultName?: string;
  value?: SignaturePayload;
  onChange: (payload: SignaturePayload) => void;
}

// ------------------------------------------------------------------
// Attestation checklists per CA Cobbs v. Grant + CACI 533 standard
// ------------------------------------------------------------------

// Always shown — every consent form
const UNIVERSAL_ATTESTATIONS: { key: string; label: string }[] = [
  { key: "read_document", label: "I have read this entire document and had the opportunity to ask questions." },
  { key: "questions_answered", label: "All my questions have been answered to my satisfaction." },
  { key: "no_guarantee", label: "I understand that no specific outcome has been promised or guaranteed." },
  { key: "may_refuse", label: "I understand I may refuse this treatment or choose no treatment at any time." },
];

// Shown for injectables (toxin, filler, biostimulators)
const INJECTION_ATTESTATIONS: { key: string; label: string }[] = [
  { key: "not_pregnant", label: "I confirm I am NOT currently pregnant and NOT breastfeeding." },
  { key: "vascular_risk", label: "I understand the risk of vascular complications including skin necrosis and (for facial filler) vision loss." },
  { key: "emergency_action", label: "I understand that emergency treatment (hyaluronidase, ER, 911) may be required, and I will call the practice immediately if I experience blanching, severe pain, or vision changes." },
];

// Shown for laser / IPL / energy / microneedling / peels
const ENERGY_ATTESTATIONS: { key: string; label: string }[] = [
  { key: "pih_risk", label: "I understand the risk of post-inflammatory hyperpigmentation, burns, scarring, and paradoxical pigment changes." },
  { key: "sun_avoidance", label: "I will avoid direct sun exposure and wear SPF 30+ daily for the period instructed." },
];

const INJECTION_SLUGS = new Set([
  "neurotoxins", "dermal-fillers", "radiesse", "lipolytic", "exosomes",
  "hyaluronidase-consent-ca", "full-face-block",
  "glp1-weight-management-consent", "peptide-therapy-consent", "hrt-consent",
]);
const ENERGY_SLUGS = new Set([
  "co2-laser", "ipl", "laser-hair", "nd-yag-laser", "pico-laser",
  "microneedling", "chemical-peels", "exilis", "hifem",
]);

function attestationsForSlug(slug: string) {
  const list = [...UNIVERSAL_ATTESTATIONS];
  if (INJECTION_SLUGS.has(slug)) list.push(...INJECTION_ATTESTATIONS);
  if (ENERGY_SLUGS.has(slug)) list.push(...ENERGY_ATTESTATIONS);
  return list;
}

export const ConsentSigner = ({ form, defaultName, value, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [reviewed, setReviewed] = useState(value?.clientAttestedReview ?? false);
  const [name, setName] = useState(value?.signedFullName ?? defaultName ?? "");
  const [decision, setDecision] = useState<"consent" | "decline">(value?.decision ?? "consent");
  const [flags, setFlags] = useState<Record<string, boolean>>(value?.attestationFlags ?? {});
  const sigRef = useRef<SignatureCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const attestations = useMemo(() => attestationsForSlug(form.slug), [form.slug]);
  const allAttestationsChecked = useMemo(
    () => attestations.every((a) => !!flags[a.key]),
    [attestations, flags],
  );
  // Gate the signing block: must scroll AND check every required attestation.
  // Optional forms that have been declined skip the attestation gate (client
  // is explicitly refusing — checkboxes don't apply).
  const gateOpen = reviewed && (decision === "decline" || allAttestationsChecked);

  // Resize signature canvas to container width
  useEffect(() => {
    if (!open || decision === "decline") return;
    const resize = () => {
      const canvas = sigRef.current?.getCanvas();
      const wrap = containerRef.current;
      if (!canvas || !wrap) return;
      const w = wrap.clientWidth;
      const h = 160;
      canvas.width = w;
      canvas.height = h;
      if (value?.signaturePng) {
        sigRef.current?.fromDataURL(value.signaturePng, { width: w, height: h });
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [open, decision]);

  const isComplete =
    !!value?.signedFullName &&
    (value?.decision === "decline" || !!value?.signaturePng) &&
    (value?.decision === "decline" || !!value?.clientAttestedReview);

  const commit = (next: Partial<SignaturePayload>) => {
    const merged: SignaturePayload = {
      signedFullName: (next.signedFullName ?? value?.signedFullName ?? name).trim(),
      signaturePng: next.signaturePng ?? value?.signaturePng ?? "",
      decision: next.decision ?? value?.decision ?? decision,
      attestationFlags: next.attestationFlags ?? value?.attestationFlags ?? flags,
      clientAttestedReview: next.clientAttestedReview ?? value?.clientAttestedReview ?? reviewed,
    };
    if (!merged.signedFullName) return;
    if (merged.decision === "consent" && !merged.signaturePng) return;
    onChange(merged);
  };

  // iOS scroll lock while drawing — prevents page from scrolling under finger
  const scrollYRef = useRef(0);
  const lockScroll = () => {
    scrollYRef.current = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollYRef.current}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  };
  const unlockScroll = () => {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, scrollYRef.current);
  };
  // Always unlock on unmount in case the user navigates away mid-stroke
  useEffect(() => () => { unlockScroll(); }, []);

  const handleEnd = () => {
    unlockScroll();
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    const png = sigRef.current.getCanvas().toDataURL("image/png");
    commit({ signaturePng: png, decision: "consent", signedFullName: name, attestationFlags: flags, clientAttestedReview: true });
  };

  const clearSig = () => {
    sigRef.current?.clear();
    if (value) onChange({ ...value, signaturePng: "" });
  };

  const chooseDecision = (d: "consent" | "decline") => {
    setDecision(d);
    if (d === "decline" && name.trim()) {
      onChange({ signedFullName: name.trim(), signaturePng: "", decision: "decline", attestationFlags: flags, clientAttestedReview: reviewed });
    } else if (d === "consent" && value?.decision === "decline") {
      onChange({ signedFullName: name.trim(), signaturePng: "", decision: "consent", attestationFlags: flags, clientAttestedReview: reviewed });
    }
  };

  const toggleFlag = (k: string, v: boolean) => {
    const next = { ...flags, [k]: v };
    setFlags(next);
    if (value) onChange({ ...value, attestationFlags: next });
  };

  const statusText = isComplete
    ? value?.decision === "decline"
      ? "Declined"
      : "Signed"
    : "Tap to review and sign";

  return (
    <div className={`rounded-2xl border ${isComplete ? "border-primary/40 bg-primary/5" : "border-border bg-card"} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isComplete ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
            {isComplete ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          </div>
          <div>
            <div className="font-medium text-sm">
              {form.title}
              {form.is_optional && <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">Optional</span>}
            </div>
            <div className="text-xs text-muted-foreground">{statusText}</div>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          <div
            className="max-h-64 overflow-y-auto rounded-lg border border-border bg-background p-4 text-xs leading-relaxed whitespace-pre-wrap"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
                if (!reviewed) {
                  setReviewed(true);
                  if (value) onChange({ ...value, clientAttestedReview: true });
                }
              }
            }}
          >
            {form.body_markdown}
          </div>

          {!reviewed && (
            <p className="text-xs text-muted-foreground">Please scroll through the entire document above.</p>
          )}

          {reviewed && decision === "consent" && attestations.length > 0 && (
            <div className="rounded-lg border border-border bg-background/50 p-3 space-y-2">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Confirm by checking each box</div>
              {attestations.map((a) => (
                <label key={a.key} className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={!!flags[a.key]}
                    onCheckedChange={(c) => toggleFlag(a.key, !!c)}
                    className="mt-0.5"
                  />
                  <span className="text-xs leading-relaxed">{a.label}</span>
                </label>
              ))}
              {!allAttestationsChecked && (
                <p className="text-[11px] text-muted-foreground italic">
                  All boxes above must be checked before you can sign.
                </p>
              )}
            </div>
          )}

          <div className={gateOpen ? "" : "opacity-50 pointer-events-none"}>
            {form.is_optional && (
              <div className="mb-4">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Your choice</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => chooseDecision("consent")}
                    className={`rounded-lg border px-3 py-2 text-sm flex items-center justify-center gap-2 ${
                      decision === "consent" ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    <Check className="h-4 w-4" /> I CONSENT
                  </button>
                  <button
                    type="button"
                    onClick={() => chooseDecision("decline")}
                    className={`rounded-lg border px-3 py-2 text-sm flex items-center justify-center gap-2 ${
                      decision === "decline" ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    <X className="h-4 w-4" /> I DO NOT CONSENT
                  </button>
                </div>
              </div>
            )}

            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Type your full legal name</Label>
            <Input
              className="mt-1.5"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (decision === "decline") {
                  if (e.target.value.trim()) {
                    onChange({ signedFullName: e.target.value.trim(), signaturePng: "", decision: "decline", attestationFlags: flags, clientAttestedReview: reviewed });
                  }
                } else if (value?.signaturePng) {
                  commit({ signedFullName: e.target.value, signaturePng: value.signaturePng, decision: "consent" });
                }
              }}
              placeholder="Jane Smith"
              maxLength={120}
            />

            {decision === "consent" && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">Draw your signature</Label>
                  <button
                    type="button"
                    onClick={clearSig}
                    className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <Eraser className="h-3 w-3" /> Clear
                  </button>
                </div>
                <div ref={containerRef} className="rounded-lg border border-border bg-background touch-none overflow-hidden select-none">
                  <SignatureCanvas
                    ref={sigRef}
                    penColor="#0f172a"
                    minWidth={1.5}
                    maxWidth={3.5}
                    onBegin={lockScroll}
                    onEnd={handleEnd}
                    canvasProps={{
                      className: "w-full h-40 cursor-crosshair block",
                      style: { touchAction: "none" }
                    }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  By typing my name and drawing my signature above, I confirm I have read and agree to the terms in this document.
                </p>
              </div>
            )}

            {decision === "decline" && (
              <p className="text-[11px] text-muted-foreground mt-3">
                By typing your name above, you confirm you have read this document and decline to provide this optional authorization. Your care will not be affected.
              </p>
            )}
          </div>

          {isComplete && (
            <Button size="sm" variant="outline" onClick={() => setOpen(false)} className="w-full">
              <Check className="h-4 w-4 mr-2" /> Done
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
