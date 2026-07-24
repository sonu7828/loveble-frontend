import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { NurseDiscountBanner } from "@/components/NurseDiscountBanner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { format } from "date-fns";
import { type CardOnFileHandle } from "@/components/CardOnFile";
import { usePageMeta } from "@/hooks/usePageMeta";

import { buildPayloadFor, type CompactValue } from "@/components/CompactConsentCard";
import { formatPhone10 } from "@/lib/formatPhone";

import { functionErrorMessage } from "@/lib/functionError";

import type { Step, Category, Service, Location, Staff, ProviderRow, ConsentForm } from "../book/types";

// Each step is lazy-loaded so the 430px-mobile booking entry ships a tiny initial JS chunk
// (Step 1 only) and pulls in the rest on demand as the client advances.
const StepService = lazy(() => import("../book/StepService").then(m => ({ default: m.StepService })));
const StepLocationStaff = lazy(() => import("../book/StepLocationStaff").then(m => ({ default: m.StepLocationStaff })));
const StepDateTime = lazy(() => import("../book/StepDateTime").then(m => ({ default: m.StepDateTime })));
const StepDetails = lazy(() => import("../book/StepDetails").then(m => ({ default: m.StepDetails })));
const StepConsentsAndPay = lazy(() => import("../book/StepConsentsAndPay").then(m => ({ default: m.StepConsentsAndPay })));

const StepFallback = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="h-5 w-5 animate-spin text-primary" />
  </div>
);

const detailsSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(60),
  email: z.string().trim().email("Invalid email").max(120),
  phone: z.string().trim().refine(v => v.replace(/\D/g, "").length === 10, "Phone number must be 10 digits"),
  dob: z.string().optional(),
  notes: z.string().max(1000).optional(),
  nppAck: z.literal(true, { errorMap: () => ({ message: "Required to book" }) }),
});


const Book = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  usePageMeta({
    title: "Book an Appointment — Radiantilyk Aesthetic",
    description: "Reserve Botox, filler, lasers, facials and medical wellness at our San Jose medspa. No deposit — card on file only.",
    canonical: "https://bookrka.com/book",
  });

  // Stable per-visit session id for funnel analytics + abandonment recovery
  const sessionIdRef = useRef<string>("");
  if (!sessionIdRef.current) {
    sessionIdRef.current = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }
  const trackEvent = (eventName: string, extra: Record<string, unknown> = {}) => {
    supabase.from("booking_events").insert({
      session_id: sessionIdRef.current,
      event_name: eventName,
      step,
      service_id: extra.serviceId ?? null,
      location_id: extra.locationId ?? null,
      staff_id: extra.staffId ?? null,
      metadata: extra,
    } as any).then(() => { }, () => { });
  };

  // Catalog
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Selections
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>();
  const [slot, setSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [client, setClient] = useState({
    firstName: "", lastName: "", email: "", phone: "", dob: "", notes: "", smsOptIn: false, marketingOptIn: false, nppAck: false,
  });


  // Consents — compact "read & agree" cards + a single shared signature
  const [consents, setConsents] = useState<ConsentForm[]>([]);
  const [loadingConsents, setLoadingConsents] = useState(false);
  const [consentValues, setConsentValues] = useState<Record<string, CompactValue>>({});
  const [sharedName, setSharedName] = useState("");
  const [sharedSig, setSharedSig] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [payStep, setPayStep] = useState<"consents" | "pay">("consents");

  const [submitting, setSubmitting] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const cardRef = useRef<CardOnFileHandle>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftBanner, setDraftBanner] = useState<{ when: number; step: Step } | null>(null);

  useEffect(() => {
    (async () => {
      const [c, s, l, sp, p, sess] = await Promise.all([
        supabase.from("service_categories").select("*").eq("is_active", true).order("display_order"),
        supabase.from("services").select("*").eq("is_active", true).order("display_order"),
        supabase.from("locations").select("*").eq("is_active", true),
        supabase.from("staff_directory" as any).select("id, full_name, title, color"),
        supabase.from("service_providers").select("service_id, staff_id, location_id"),
        supabase.auth.getSession(),
      ]);
      setCategories(c.data ?? []);
      setServices(s.data ?? []);
      // San Mateo is hidden from client-facing booking.
      setLocations((l.data ?? []).filter((row: any) => row.slug !== "san-mateo"));

      setStaff((sp.data ?? []) as any);
      setProviders(p.data ?? []);

      // Prefill from query params (rebook flow)
      const qService = searchParams.get("service");
      const qLocation = searchParams.get("location");
      const qStaff = searchParams.get("staff");
      if (qService) setServiceIds([qService]);
      if (qLocation) setLocationId(qLocation);
      if (qStaff) setStaffId(qStaff);
      setStep(1);

      // Prefill client details from query params (staff "Book for client" flow)
      const qFirst = searchParams.get("first");
      const qLast = searchParams.get("last");
      const qEmail = searchParams.get("email");
      const qPhone = searchParams.get("phone");
      if (qFirst || qLast || qEmail || qPhone) {
        setClient((prev) => ({
          ...prev,
          firstName: qFirst ?? prev.firstName,
          lastName: qLast ?? prev.lastName,
          email: qEmail ?? prev.email,
          phone: qPhone ?? prev.phone,
        }));
      }

      // Capture referral code from ?ref= and persist for the session
      const qRef = searchParams.get("ref");
      if (qRef && /^[A-Za-z0-9]{4,16}$/.test(qRef)) {
        try { localStorage.setItem("rka_ref", qRef.toUpperCase()); } catch { }
      }

      // Prefill client details from signed-in profile
      const userId = sess.data.session?.user?.id;
      const userEmail = sess.data.session?.user?.email;
      if (userId) {
        const { data: prof } = await supabase
          .from("client_profiles").select("*").eq("user_id", userId).maybeSingle();
        if (prof) {
          setClient((prev) => ({
            ...prev,
            firstName: prof.first_name ?? prev.firstName,
            lastName: prof.last_name ?? prev.lastName,
            email: prof.email ?? userEmail ?? prev.email,
            phone: prof.phone ?? prev.phone,
            dob: prof.dob ?? prev.dob,
          }));
        } else if (userEmail) {
          setClient((prev) => ({ ...prev, email: userEmail }));
        }
      } else {
        // Anonymous: prefill from last booking on this device
        try {
          const raw = localStorage.getItem("rka_last_client");
          if (raw) {
            const last = JSON.parse(raw);
            setClient((prev) => ({
              ...prev,
              firstName: prev.firstName || last.firstName || "",
              lastName: prev.lastName || last.lastName || "",
              email: prev.email || last.email || "",
              phone: prev.phone || last.phone || "",
              dob: prev.dob || last.dob || "",
            }));
          }
        } catch { }
      }

      // Restore mid-flow draft selections if there is one
      const hadQueryDeepLink = !!(searchParams.get("service") || searchParams.get("location") || searchParams.get("staff") || searchParams.get("reschedule"));
      if (!hadQueryDeepLink) {
        try {
          const raw = localStorage.getItem("rka_book_draft");
          if (raw) {
            const d = JSON.parse(raw);
            // Only restore selections if recent (< 7 days) and not already completed
            if (d && d.when && Date.now() - d.when < 7 * 24 * 60 * 60 * 1000) {
              if (Array.isArray(d.serviceIds)) setServiceIds(d.serviceIds);
              if (d.locationId) setLocationId(d.locationId);
              if (d.staffId) setStaffId(d.staffId);
              if (d.date) setDate(new Date(d.date));
              if (d.slot) setSlot(d.slot);
              if (d.client) setClient(prev => ({ ...prev, ...d.client }));
              // Always start from Step 1 per design requirement
              setStep(1);
            }
          }
        } catch { }
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave draft whenever the funnel state meaningfully changes
  useEffect(() => {
    if (loading) return;
    try {
      localStorage.setItem("rka_book_draft", JSON.stringify({
        when: Date.now(),
        step,
        serviceIds, locationId, staffId,
        date: date ? date.toISOString() : null,
        slot,
        client: {
          firstName: client.firstName, lastName: client.lastName,
          email: client.email, phone: client.phone, dob: client.dob,
        },
      }));
    } catch { }
  }, [loading, step, serviceIds, locationId, staffId, date, slot, client.firstName, client.lastName, client.email, client.phone, client.dob]);

  const selectedServices = useMemo(
    () => serviceIds.map((id) => services.find((s) => s.id === id)).filter(Boolean) as Service[],
    [serviceIds, services],
  );
  const totalDurationMin = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);
  // Backwards-compat: many step components still use a single primary service
  const service = selectedServices[0];

  const availableLocations = useMemo(() => {
    if (serviceIds.length === 0) return [];
    // Locations that offer ALL selected services
    const counts = new Map<string, number>();
    providers.filter(p => serviceIds.includes(p.service_id)).forEach(p => {
      counts.set(p.location_id, (counts.get(p.location_id) ?? 0) + 1);
    });
    const ids = new Set(
      Array.from(counts.entries())
        .filter(([, n]) => n >= serviceIds.length)
        .map(([k]) => k),
    );
    return locations.filter(l => ids.has(l.id));
  }, [serviceIds, providers, locations]);

  const availableStaff = useMemo(() => {
    if (serviceIds.length === 0 || !locationId) return [];
    // Staff that offer ALL selected services at this location
    const counts = new Map<string, number>();
    providers
      .filter(p => p.location_id === locationId && serviceIds.includes(p.service_id))
      .forEach(p => counts.set(p.staff_id, (counts.get(p.staff_id) ?? 0) + 1));
    const ids = new Set(
      Array.from(counts.entries())
        .filter(([, n]) => n >= serviceIds.length)
        .map(([k]) => k),
    );
    return staff.filter(s => ids.has(s.id));
  }, [serviceIds, locationId, providers, staff]);

  useEffect(() => {
    if (step === 2 && serviceIds.length && availableLocations.length === 1 && !locationId) {
      setLocationId(availableLocations[0].id);
    }
  }, [step, serviceIds, availableLocations, locationId]);

  useEffect(() => {
    if (step === 2 && locationId && availableStaff.length === 1 && !staffId) {
      setStaffId(availableStaff[0].id);
    }
  }, [step, locationId, availableStaff, staffId]);

  useEffect(() => {
    if (step !== 3 || !date || serviceIds.length === 0 || !staffId || !locationId) return;
    setLoadingSlots(true);
    setSlot(null);
    const dateStr = format(date, "yyyy-MM-dd");
    supabase.functions.invoke("get-availability", {
      body: { serviceIds, staffId, locationId, date: dateStr },
    }).then(({ data, error }) => {
      if (error) toast.error("Could not load times");
      setSlots(data?.slots ?? []);
      setLoadingSlots(false);
    });
  }, [date, step, serviceIds, staffId, locationId]);

  // Load consents when entering step 5
  useEffect(() => {
    if (step !== 5 || serviceIds.length === 0) return;
    setLoadingConsents(true);
    supabase.functions.invoke("get-service-consents", {
      body: { serviceIds, email: client.email },
    }).then(({ data, error }) => {
      if (error || data?.error) {
        toast.error(data?.error || "Could not load consent forms");
      } else {
        setConsents(data?.forms ?? []);
        // Keep existing decisions where the form is still in the list
        setConsentValues(prev => {
          const next: Record<string, CompactValue> = {};
          for (const f of data?.forms ?? []) {
            if (!f.alreadySigned && prev[f.id]) next[f.id] = prev[f.id];
          }
          return next;
        });
      }
      setLoadingConsents(false);
    });
  }, [step, serviceIds, client.email]);

  // Funnel analytics: log every step entry
  useEffect(() => {
    trackEvent(`step_${step}_viewed`, { serviceIds, locationId, staffId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const goNext = () => setStep((s) => (Math.min(5, s + 1) as Step));
  const goBack = () => setStep((s) => (Math.max(1, s - 1) as Step));

  // Guard: Users can only proceed to next step after completing the current step
  useEffect(() => {
    if (loading) return;
    if (step > 1 && serviceIds.length === 0) {
      setStep(1);
    } else if (step > 2 && (!locationId || !staffId)) {
      setStep(2);
    } else if (step > 3 && (!date || !slot)) {
      setStep(3);
    } else if (step > 4 && (!client.firstName || !client.lastName || !client.email || !client.phone || !client.nppAck)) {
      setStep(4);
    }
  }, [step, serviceIds, locationId, staffId, date, slot, client, loading]);

  const goToConsents = () => {
    const parsed = detailsSchema.safeParse(client);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setFieldErrors({});
    // Capture the booking attempt for abandonment recovery
    supabase.functions.invoke("track-booking-attempt", {
      body: {
        sessionId: sessionIdRef.current,
        email: client.email,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        serviceId: serviceIds[0] ?? null, locationId, staffId,
        intendedStartAt: slot,
      },
    }).catch(() => { });
    trackEvent("details_submitted", { serviceIds, locationId, staffId });
    // Prefill the shared signer name from the details step.
    const full = `${client.firstName} ${client.lastName}`.trim();
    if (full && !sharedName.trim()) setSharedName(full);
    goNext();
  };

  const trimmedSharedName = sharedName.trim();
  const anyAgreed = useMemo(
    () => consents.some(f => !f.alreadySigned && consentValues[f.id]?.agreed),
    [consents, consentValues],
  );

  const allConsentsSatisfied = useMemo(() => {
    if (loadingConsents) return false;
    if (!consents.length) return true;
    const decisionsOk = consents.every(f => {
      if (f.alreadySigned) return true;
      const v = consentValues[f.id];
      if (!v) return false;
      if (f.is_optional) return !!(v.agreed || v.declined);
      return !!v.agreed;
    });
    if (!decisionsOk) return false;
    // If any form is being agreed to, name + signature are required.
    if (anyAgreed) {
      if (trimmedSharedName.length < 2) return false;
      if (!sharedSig) return false;
    } else if (trimmedSharedName.length < 2) {
      // Even when all optional forms are declined, we still need a name on record.
      return false;
    }
    return true;
  }, [consents, consentValues, loadingConsents, anyAgreed, trimmedSharedName, sharedSig]);

  const submit = async () => {
    if (serviceIds.length === 0 || !staffId || !locationId || !slot) return;
    if (!acknowledged) { toast.error("Please acknowledge the cancellation policy"); return; }
    if (!allConsentsSatisfied) { toast.error("Please review and agree to each consent, then sign once"); return; }
    setSubmitting(true);
    setCardError(null);

    let card: { customerId: string; paymentMethodId: string; setupIntentId: string };
    try {
      card = await cardRef.current!.collect({
        email: client.email,
        name: `${client.firstName} ${client.lastName}`.trim(),
        phone: client.phone,
      });
    } catch (e) {
      setSubmitting(false);
      const msg = (e as Error).message || "Card could not be saved";
      setCardError(msg);
      toast.error(msg);
      return;
    }

    const sigPayload = consents
      .filter(f => !f.alreadySigned)
      .map(f => {
        const v = consentValues[f.id] ?? { agreed: false, declined: false };
        const p = buildPayloadFor(f, v, { name: trimmedSharedName, signaturePng: sharedSig });
        if (!p) return null;
        return {
          consentFormId: f.id,
          formVersion: f.version,
          signedFullName: p.signedFullName,
          signaturePng: p.signaturePng,
          decision: p.decision,
          attestationFlags: p.attestationFlags ?? {},
          clientAttestedReview: !!p.clientAttestedReview,
        };
      })
      .filter(Boolean);

    let storedRef: string | null = null;
    try { storedRef = localStorage.getItem("rka_ref"); } catch { }

    const rescheduleId = searchParams.get("reschedule");
    const { data, error } = await supabase.functions.invoke("create-booking", {
      body: {
        serviceIds, staffId, locationId, startAt: slot,
        client: {
          firstName: client.firstName, lastName: client.lastName,
          email: client.email, phone: client.phone,
          dob: client.dob || undefined, notes: client.notes || undefined,
          smsOptIn: !!client.smsOptIn,
          marketingOptIn: !!client.marketingOptIn,
        },
        stripeCustomerId: card.customerId,
        stripePaymentMethodId: card.paymentMethodId,
        stripeSetupIntentId: card.setupIntentId,
        signatures: sigPayload,
        referralCode: storedRef || undefined,
        rescheduleAppointmentId: rescheduleId || undefined,
      },
    });
    setSubmitting(false);
    if (error || data?.error) {
      toast.error(data?.error || (await functionErrorMessage(error, "Could not submit booking")));
      return;
    }
    // Mark attempt completed + log funnel event
    supabase.functions.invoke("track-booking-attempt", {
      body: { sessionId: sessionIdRef.current, completed: true },
    }).catch(() => { });
    trackEvent("booking_completed", { serviceIds, locationId, staffId, appointmentId: data.id });
    try {
      localStorage.setItem("rka_last_client", JSON.stringify({
        firstName: client.firstName, lastName: client.lastName,
        email: client.email, phone: client.phone, dob: client.dob || "",
      }));
    } catch { }
    // Record NPP acknowledgment on the profile for signed-in patients.
    try {
      const { NPP_VERSION } = await import("../public/PrivacyPractices");
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.from("client_profiles").update({
          npp_acknowledged_at: new Date().toISOString(),
          npp_version: NPP_VERSION,
        }).eq("user_id", session.user.id);
      }
    } catch { }
    try { localStorage.removeItem("rka_book_draft"); } catch { }
    navigate(`/booking/${data.token}?new=1`);

  };

  const handleJumpToStep = (target: number) => {
    const current = step === 5 && payStep === "pay" ? 6 : step;
    if (target === current) return;

    if (target < current) {
      if (target === 6) { setStep(5); setPayStep("pay"); }
      else if (target === 5) { setStep(5); setPayStep("consents"); }
      else { setStep(target); }
      return;
    }

    // Jump forward validation
    if (target >= 2 && serviceIds.length === 0) {
      toast.error("Please select a service first.");
      setStep(1);
      return;
    }
    if (target >= 3 && locations.length > 1 && !locationId) {
      toast.error("Please choose a location and provider.");
      setStep(2);
      return;
    }
    if (target >= 4 && (!slot || !date)) {
      toast.error("Please pick a date and time slot.");
      setStep(3);
      return;
    }

    if (target === 6) { setStep(5); setPayStep("pay"); }
    else if (target === 5) { setStep(5); setPayStep("consents"); }
    else { setStep(target); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      <main className="flex-1 container mx-auto px-4 sm:px-6 md:px-8 pt-2 pb-8 max-w-6xl">
        {/* Floating Announcement Banner */}
        <div className="flex justify-center mb-2">
          <NurseDiscountBanner />
        </div>

        {draftBanner && draftRestored && (
          <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2 flex items-start gap-3 text-xs">
            <span className="text-base leading-none mt-0.5" aria-hidden>↻</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium">Welcome back — we saved your spot.</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Picked up at step {draftBanner.step} of 6. Your selections are filled in.
              </div>
            </div>
            <button
              onClick={() => {
                try { localStorage.removeItem("rka_book_draft"); } catch { }
                setServiceIds([]); setLocationId(null); setStaffId(null);
                setDate(undefined); setSlot(null); setStep(1);
                setDraftBanner(null); setDraftRestored(false);
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline shrink-0"
            >
              Start over
            </button>
          </div>
        )}
        {/* Step 5 is split into two sub-screens (consents + card) which we surface as 5/6 + 6/6 */}
        {/* Screen-reader announcements when the booking step changes */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {step === 1 && "Step 1 of 6: choose your service."}
          {step === 2 && "Step 2 of 6: choose location and provider."}
          {step === 3 && "Step 3 of 6: pick a date and time."}
          {step === 4 && "Step 4 of 6: enter your details."}
          {step === 5 && payStep === "consents" && "Step 5 of 6: review and sign consents."}
          {step === 5 && payStep === "pay" && "Step 6 of 6: add a card on file to confirm."}
        </div>
        {/* Sticky progress: keeps "where am I in the funnel?" visible while clients scroll long steps */}
        <div className="sticky top-0 z-30 -mx-4 px-4 pt-1.5 pb-2 mb-3 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/40">
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-medium">
              {(() => {
                const displayStep = step === 5 && payStep === "pay" ? 6 : step;
                return `Step ${displayStep} of 6`;
              })()}
              <span className="ml-2 text-foreground/70 normal-case tracking-normal">
                {step === 1 && "· Service"}
                {step === 2 && "· Location & provider"}
                {step === 3 && "· Date & time"}
                {step === 4 && "· Your details"}
                {step === 5 && payStep === "consents" && "· Consents"}
                {step === 5 && payStep === "pay" && "· Card on file"}
              </span>
            </p>
            {step > 1 && (
              <button
                onClick={() => { if (step === 5 && payStep === "pay") setPayStep("consents"); else goBack(); }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground min-h-[36px] -mr-1 px-1 justify-end"
                aria-label="Go back"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
          </div>

          <div
            className="flex gap-1.5 py-1 -my-1"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={6}
            aria-valuenow={step === 5 && payStep === "pay" ? 6 : step}
            aria-label={`Booking step ${step === 5 && payStep === "pay" ? 6 : step} of 6`}
          >
            {[1, 2, 3, 4, 5, 6].map(n => {
              const displayStep = step === 5 && payStep === "pay" ? 6 : step;
              const filled = n <= displayStep;
              const isCurrent = n === displayStep;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleJumpToStep(n)}
                  className={`h-2 flex-1 rounded-full transition-all duration-200 cursor-pointer group relative ${
                    isCurrent
                      ? "bg-primary ring-2 ring-primary/30"
                      : filled
                      ? "bg-primary/80 hover:bg-primary"
                      : "bg-secondary hover:bg-primary/40"
                  }`}
                  title={`Click to navigate to Step ${n}`}
                  aria-label={`Step ${n}`}
                >
                  <span className="sr-only">Step {n}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* "What happens next" reassurance ribbon — compact & sleek */}
        {step === 1 && (
          <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold shrink-0">
                What happens next
              </span>
              <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                {[
                  { n: "1", t: "Pick your service", d: "Browse menu & pricing" },
                  { n: "2", t: "Pick a time", d: "See live availability" },
                  { n: "3", t: "Save card", d: "No charge today" },
                ].map(s => (
                  <li key={s.n} className="flex items-center gap-2">
                    <span className="shrink-0 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-medium inline-flex items-center justify-center">
                      {s.n}
                    </span>
                    <div className="min-w-0">
                      <span className="font-medium text-foreground">{s.t}</span>
                      <span className="text-[11px] text-muted-foreground ml-1 hidden md:inline">({s.d})</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 border-t border-primary/10 pt-1 leading-tight">
              Card on file is only used for services received or no-shows/cancellations within 48h ($200 fee).
            </p>
          </div>
        )}

        <Suspense fallback={<StepFallback />}>





          {step === 1 && (
            <StepService
              categories={categories} services={services}
              providers={providers}
              selected={serviceIds}
              onToggle={(id) => {
                setServiceIds((prev) => {
                  const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
                  // Reset downstream picks when the set of services changes
                  setLocationId(null); setStaffId(null); setDate(undefined); setSlot(null);
                  return next;
                });
              }}
              onContinue={() => { if (serviceIds.length > 0) goNext(); }}
            />
          )}

          {step === 2 && selectedServices.length > 0 && (
            <StepLocationStaff
              services={selectedServices}
              locations={availableLocations}
              staff={availableStaff}
              providers={providers}
              locationId={locationId} staffId={staffId}
              onLocation={setLocationId}
              onStaff={setStaffId}
              canContinue={!!locationId && !!staffId}
              onContinue={goNext}
            />
          )}

          {step === 3 && selectedServices.length > 0 && (
            <StepDateTime
              date={date} onDate={setDate}
              slot={slot} onSlot={setSlot}
              slots={slots} loading={loadingSlots}
              onContinue={goNext}
              durationMin={totalDurationMin}
              serviceIds={serviceIds} locationId={locationId!} staffId={staffId}
            />
          )}

          {step === 4 && selectedServices.length > 0 && slot && (
            <StepDetails
              client={client} setClient={setClient}
              fieldErrors={fieldErrors}
              onClearError={(k) => setFieldErrors(prev => { if (!prev[k]) return prev; const next = { ...prev }; delete next[k]; return next; })}
              summary={{
                serviceName: selectedServices.map(s => s.name).join(" + "),
                staffName: staff.find(s => s.id === staffId)?.full_name ?? "",
                locationName: locations.find(l => l.id === locationId)?.name ?? "",
                startAt: slot,
              }}
              onContinue={goToConsents}
            />
          )}

          {step === 5 && selectedServices.length > 0 && slot && (
            <StepConsentsAndPay
              consents={consents}
              loading={loadingConsents}
              consentValues={consentValues}
              setConsentValue={(id, v) => setConsentValues(prev => ({ ...prev, [id]: v }))}
              sharedName={sharedName}
              setSharedName={setSharedName}
              sharedSig={sharedSig}
              setSharedSig={setSharedSig}
              anyAgreed={anyAgreed}
              clientName={`${client.firstName} ${client.lastName}`.trim()}
              allConsentsSatisfied={allConsentsSatisfied}
              acknowledged={acknowledged}
              setAcknowledged={setAcknowledged}
              cardRef={cardRef}
              submitting={submitting}
              cardError={cardError}
              clearCardError={() => setCardError(null)}
              subStep={payStep}
              setSubStep={setPayStep}
              summary={{
                serviceName: selectedServices.map(s => s.name).join(" + "),
                staffName: staff.find(s => s.id === staffId)?.full_name ?? "",
                locationName: locations.find(l => l.id === locationId)?.name ?? "",
                startAt: slot,
              }}
              onSubmit={submit}
            />
          )}
        </Suspense>
      </main>


      <SiteFooter />
    </div>
  );
};

/* Step components live in src/pages/book/ — imported at top of file. */

export default Book;


