import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { CompactConsentCard, buildPayloadFor, type CompactValue } from "@/components/CompactConsentCard";
import { SharedConsentSigner } from "@/components/SharedConsentSigner";
import type { ConsentFormData } from "@/components/ConsentSigner";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PortalCTA } from "@/components/PortalCTA";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function PatientConsents() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appt, setAppt] = useState<any>(null);
  const [forms, setForms] = useState<ConsentFormData[]>([]);
  const [values, setValues] = useState<Record<string, CompactValue>>({});
  const [name, setName] = useState("");
  const [signaturePng, setSignaturePng] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${SUPABASE_URL}/functions/v1/public-sign-consents?token=${encodeURIComponent(token)}`,
      { headers: { apikey: ANON } })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { toast.error(d.error); }
        else {
          setAppt(d.appointment);
          setForms(d.forms ?? []);
          // Prefill the full-name field from the appointment
          if (d.appointment?.client_first_name) {
            setName(`${d.appointment.client_first_name} ${d.appointment.client_last_name ?? ""}`.trim());
          }
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const requiredForms = useMemo(() => forms.filter((f) => !f.is_optional), [forms]);
  const optionalForms = useMemo(() => forms.filter((f) => f.is_optional), [forms]);

  const requiredAllAgreed = useMemo(
    () => requiredForms.every((f) => values[f.id]?.agreed),
    [requiredForms, values],
  );
  const optionalAllDecided = useMemo(
    () => optionalForms.every((f) => {
      const v = values[f.id];
      return v?.agreed || v?.declined;
    }),
    [optionalForms, values],
  );

  const trimmedName = name.trim();
  const readyToSubmit =
    requiredAllAgreed && optionalAllDecided && trimmedName.length > 1 && !!signaturePng;

  const submit = async () => {
    if (!readyToSubmit) {
      toast.error("Please review each consent, then type your name and sign once below.");
      return;
    }
    setSubmitting(true);
    const payload = forms
      .map((f) => {
        const v = values[f.id] ?? { agreed: false, declined: false };
        const p = buildPayloadFor(f, v, { name: trimmedName, signaturePng });
        if (!p) return null;
        return {
          consentFormId: f.id,
          signedFullName: p.signedFullName,
          signaturePng: p.signaturePng,
          decision: p.decision,
          attestationFlags: p.attestationFlags ?? {},
          clientAttestedReview: !!p.clientAttestedReview,
        };
      })
      .filter(Boolean);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/public-sign-consents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON },
      body: JSON.stringify({ token, signatures: payload, signingMode: "remote" }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok || data.error) { toast.error(data.error || "Could not submit"); return; }
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-2xl pb-32">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : done ? (
          <div className="text-center py-20">
            <CheckCircle2 className="h-12 w-12 text-success-soft-foreground mx-auto mb-4" />
            <h1 className="font-serif text-2xl mb-2">Thank you</h1>
            <p className="text-muted-foreground text-sm">Your consent forms have been received.</p>
            <PortalCTA tab="forms" />
          </div>
        ) : !appt ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">We couldn't find this consent link — it may have expired.</p>
            <Link to="/book" className="text-primary text-sm underline">Book a new appointment →</Link>
          </div>
        ) : forms.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle2 className="h-10 w-10 text-success-soft-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">All consent forms for this appointment are already signed.</p>
          </div>
        ) : (
          <>
            <h1 className="font-serif text-3xl mb-2">Consent forms</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Hi {appt.client_first_name}, please tap each card to review.
              When you're done, type your name and sign once at the bottom — your
              signature is applied to every form you accepted.
            </p>

            <div className="space-y-3">
              {forms.map((f) => (
                <CompactConsentCard
                  key={f.id}
                  form={f}
                  value={values[f.id] ?? { agreed: false, declined: false }}
                  onChange={(v) => setValues((prev) => ({ ...prev, [f.id]: v }))}
                />
              ))}
            </div>

            <div className="mt-8">
              <h2 className="font-serif text-xl mb-3">Sign once for all forms above</h2>
              <SharedConsentSigner
                defaultName={`${appt.client_first_name} ${appt.client_last_name ?? ""}`.trim()}
                name={name}
                signaturePng={signaturePng}
                onNameChange={setName}
                onSignatureChange={setSignaturePng}
              />
            </div>

            {/* Sticky submit bar — easy to reach on mobile */}
            <div className="fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t border-border p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <div className="container mx-auto max-w-2xl flex items-center gap-3">
                <div className="hidden sm:block text-xs text-muted-foreground flex-1">
                  {!requiredAllAgreed
                    ? `${requiredForms.filter((f) => !values[f.id]?.agreed).length} required form(s) left to review`
                    : !optionalAllDecided
                    ? "Please accept or decline each optional form"
                    : !trimmedName || !signaturePng
                    ? "Type your name and sign once below"
                    : "All set — tap to submit"}
                </div>
                <Button
                  onClick={submit}
                  disabled={!readyToSubmit || submitting}
                  className="rounded-full flex-1 sm:flex-none sm:min-w-[200px]"
                  size="lg"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit signed forms"}
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
