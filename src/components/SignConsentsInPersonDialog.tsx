// Streamlined in-person consent signing.
//
// Same UX as the remote client flow (CompactConsentCard + one SharedConsentSigner):
// each form expands to read, single "I've read & agree" checkbox, optional forms get
// Accept/Decline, and a SINGLE signature at the bottom is applied to every accepted
// form. Staff witness name is captured once.
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, PenLine, AlertTriangle, ShieldCheck, Check } from "lucide-react";
import { toast } from "sonner";
import { CompactConsentCard, buildPayloadFor, type CompactValue } from "@/components/CompactConsentCard";
import { SharedConsentSigner } from "@/components/SharedConsentSigner";
import type { ConsentFormData } from "@/components/ConsentSigner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appointmentId: string;
  onSigned?: () => void;
}

export function SignConsentsInPersonDialog({ open, onOpenChange, appointmentId, onSigned }: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [appt, setAppt] = useState<any>(null);
  const [forms, setForms] = useState<ConsentFormData[]>([]);
  const [values, setValues] = useState<Record<string, CompactValue>>({});
  const [sharedName, setSharedName] = useState("");
  const [sharedSig, setSharedSig] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [done, setDone] = useState(false);
  const [missing, setMissing] = useState<{ id: string; title: string }[]>([]);
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: sp } = await supabase.from("staff_profiles").select("full_name").eq("user_id", user.id).maybeSingle();
      if (sp?.full_name) setWitnessName(sp.full_name);
    })();
  }, [open]);

  const loadAll = async () => {
    setLoading(true); setValues({}); setSharedSig(""); setMissing([]);
    const { data: a } = await supabase
      .from("appointments")
      .select("public_token, client_first_name, client_last_name, client_email")
      .eq("id", appointmentId).maybeSingle();
    if (!a?.public_token) { toast.error("Could not load appointment"); setLoading(false); return; }
    setToken(a.public_token);

    const [{ data: apsv }, { data: universal }] = await Promise.all([
      supabase
        .from("appointment_services")
        .select("service_id, services!inner(skip_consents)")
        .eq("appointment_id", appointmentId),
      supabase
        .from("consent_forms")
        .select("id, title, is_optional")
        .eq("is_active", true)
        .eq("is_universal", true),
    ]);
    const eligibleSvcIds = (apsv ?? [])
      .filter((r: any) => !r.services?.skip_consents)
      .map((r: any) => r.service_id);

    let mappedForms: { id: string; title: string; is_optional: boolean }[] = [];
    if (eligibleSvcIds.length) {
      const { data: sc } = await supabase
        .from("service_consents")
        .select("consent_form_id, consent_forms!inner(id, title, is_optional, is_active)")
        .in("service_id", eligibleSvcIds);
      mappedForms = (sc ?? [])
        .filter((r: any) => r.consent_forms?.is_active)
        .map((r: any) => r.consent_forms);
    }

    const expected = new Map<string, { id: string; title: string; is_optional: boolean }>();
    for (const f of universal ?? []) expected.set(f.id, f as any);
    for (const f of mappedForms) expected.set(f.id, f as any);
    const requiredExpected = Array.from(expected.values()).filter((f) => !f.is_optional);

    const { data: assigned } = await supabase
      .from("appointment_consents")
      .select("consent_form_id")
      .eq("appointment_id", appointmentId);
    const assignedSet = new Set((assigned ?? []).map((r: any) => r.consent_form_id));
    const miss = requiredExpected.filter((f) => !assignedSet.has(f.id));
    setMissing(miss);

    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/public-sign-consents?token=${encodeURIComponent(a.public_token)}`,
        { headers: { apikey: ANON } });
      const d = await r.json();
      if (d.error) { toast.error(d.error); }
      else {
        setAppt(d.appointment);
        setForms(d.forms ?? []);
        if (d.appointment?.client_first_name) {
          setSharedName(`${d.appointment.client_first_name} ${d.appointment.client_last_name ?? ""}`.trim());
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not load consents");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    setDone(false);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointmentId]);

  const fixMissing = async () => {
    if (!missing.length) return;
    setFixing(true);
    const { data, error } = await supabase.functions.invoke("assign-consent-forms", {
      body: { appointmentId, consentFormIds: missing.map((m) => m.id) },
    });
    setFixing(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Could not assign missing forms");
      return;
    }
    toast.success(`Assigned ${missing.length} missing form${missing.length > 1 ? "s" : ""}`);
    await loadAll();
  };

  const requiredForms = useMemo(() => forms.filter((f) => !f.is_optional), [forms]);
  const optionalForms = useMemo(() => forms.filter((f) => f.is_optional), [forms]);
  const requiredAllAgreed = requiredForms.every((f) => values[f.id]?.agreed);
  const optionalAllDecided = optionalForms.every((f) => {
    const v = values[f.id]; return v?.agreed || v?.declined;
  });
  const anyAgreed = forms.some((f) => values[f.id]?.agreed);
  const trimmedName = sharedName.trim();
  const readyToSubmit =
    requiredAllAgreed && optionalAllDecided && trimmedName.length > 1 &&
    (!anyAgreed || !!sharedSig) && !!witnessName.trim();

  const submit = async () => {
    if (!token) return;
    if (!witnessName.trim()) { toast.error("Staff witness name is required."); return; }
    if (!readyToSubmit) {
      toast.error("Please review each form, type the patient's name, and capture one signature.");
      return;
    }
    const payload = forms
      .map((f) => {
        const v = values[f.id] ?? { agreed: false, declined: false };
        const p = buildPayloadFor(f, v, { name: trimmedName, signaturePng: sharedSig });
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

    if (payload.length === 0) {
      setDone(true);
      toast.success("All consent forms are already signed");
      onSigned?.();
      return;
    }
    setSubmitting(true);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/public-sign-consents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON },
      body: JSON.stringify({
        token,
        signatures: payload,
        signingMode: "in_person_kiosk",
        witnessName: witnessName.trim(),
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok || data.error) { toast.error(data.error || "Could not submit"); return; }
    setDone(true);
    toast.success("Consent forms signed");
    onSigned?.();
  };

  const defaultName = appt ? `${appt.client_first_name ?? ""} ${appt.client_last_name ?? ""}`.trim() : "";

  const hint = loading
    ? "Loading…"
    : forms.length === 0
    ? "All consents already on file"
    : !requiredAllAgreed
    ? `${requiredForms.filter((f) => !values[f.id]?.agreed).length} required form(s) left`
    : !optionalAllDecided
    ? "Accept or decline each optional form"
    : !trimmedName || (anyAgreed && !sharedSig)
    ? "Type the patient's name and sign once below"
    : !witnessName.trim()
    ? "Add staff witness name"
    : "Ready to submit";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] w-full max-w-none p-0 flex flex-col gap-0 sm:max-w-none"
      >
        <SheetHeader className="px-4 sm:px-6 pt-4 pb-3 border-b shrink-0 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <PenLine className="h-4 w-4" />Sign in person
          </SheetTitle>
          <SheetDescription className="text-xs">
            Hand the device to {defaultName || "the patient"}. They tap each form to read, then sign ONCE at the bottom — that signature is applied to every form they accept.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 pb-32">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : done ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-10 w-10 text-success-soft-foreground mx-auto mb-3" />
              <p className="font-medium">Signatures saved</p>
              <p className="text-xs text-muted-foreground mt-1">A receipt has been emailed to the client.</p>
              <Button onClick={() => onOpenChange(false)} className="mt-6 rounded-full">Close</Button>
            </div>
          ) : (
            <>
              {missing.length > 0 && (
                <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning-soft-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-warning-soft-foreground">
                        {missing.length} required form{missing.length > 1 ? "s are" : " is"} missing
                      </div>
                      <ul className="mt-1 text-xs text-warning-soft-foreground list-disc pl-4">
                        {missing.map((m) => <li key={m.id}>{m.title}</li>)}
                      </ul>
                      <Button onClick={fixMissing} disabled={fixing} size="sm" className="mt-3 rounded-full">
                        {fixing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Auto-assign missing forms"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {forms.length === 0 && missing.length === 0 ? (
                <div className="text-center py-12">
                  <ShieldCheck className="h-10 w-10 text-success-soft-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">All consent forms for this appointment are already signed.</p>
                </div>
              ) : forms.length > 0 ? (
                <div className="max-w-2xl mx-auto">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                    Step 1 — Review &amp; agree
                  </div>
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
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                      Step 2 — Sign once for all accepted forms
                    </div>
                    <SharedConsentSigner
                      defaultName={defaultName}
                      name={sharedName}
                      signaturePng={sharedSig}
                      onNameChange={setSharedName}
                      onSignatureChange={setSharedSig}
                    />
                  </div>

                  <div className="mt-6 rounded-xl border border-border bg-secondary/40 p-4">
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                      Step 3 — Staff witness
                    </div>
                    <label className="text-xs text-muted-foreground">Witness name *</label>
                    <input
                      type="text"
                      value={witnessName}
                      onChange={(e) => setWitnessName(e.target.value)}
                      placeholder="Staff member witnessing the signing"
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {!loading && !done && forms.length > 0 && (
          <div className="border-t bg-background/95 backdrop-blur px-4 sm:px-6 py-3 shrink-0 sticky bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-3 max-w-2xl mx-auto">
              <div className="hidden sm:block text-xs text-muted-foreground flex-1">{hint}</div>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-full"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={submitting || !readyToSubmit}
                className="flex-1 sm:flex-none sm:min-w-[220px] rounded-full"
                size="lg"
              >
                {submitting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><Check className="h-4 w-4 mr-2" />Submit signed forms</>}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
