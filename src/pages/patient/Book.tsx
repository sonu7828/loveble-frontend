import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiQuery, authService } from "@/services/api";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { NurseDiscountBanner } from "@/components/NurseDiscountBanner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";
import { type CardOnFileHandle } from "@/components/CardOnFile";
import { usePageMeta } from "@/hooks/usePageMeta";

import type { Step, Category, Service, Location, Staff, ProviderRow, ConsentForm } from "../book/types";
import type { CompactValue } from "@/components/CompactConsentCard";

const StepService = lazy(() => import("../book/StepService").then(m => ({ default: m.StepService })));
const StepLocationStaff = lazy(() => import("../book/StepLocationStaff").then(m => ({ default: m.StepLocationStaff })));
const StepDateTime = lazy(() => import("../book/StepDateTime").then(m => ({ default: m.StepDateTime })));
const StepDetails = lazy(() => import("../book/StepDetails").then(m => ({ default: m.StepDetails })));
const StepConsentsAndPay = lazy(() => import("../book/StepConsentsAndPay").then(m => ({ default: m.StepConsentsAndPay })));

const StepFallback = () => (
  <div className="flex items-center justify-center py-12">
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

export const Book = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  usePageMeta({
    title: "Book an Appointment — Radiantilyk Aesthetic",
    description: "Reserve Botox, filler, lasers, facials and medical wellness at our San Jose medspa. No deposit — card on file only.",
    canonical: "https://bookrka.com/book",
  });

  const sessionIdRef = useRef<string>("");
  if (!sessionIdRef.current) {
    sessionIdRef.current = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }

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

  // Consents
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
        apiQuery("service_categories").select("*").eq("is_active", true).order("display_order"),
        apiQuery("services").select("*").eq("is_active", true).order("display_order"),
        apiQuery("locations").select("*").eq("is_active", true),
        apiQuery("staff_directory" as any).select("id, full_name, title, color"),
        apiQuery("service_providers").select("service_id, staff_id, location_id"),
        authService.getSession(),
      ]);

      if (c.data) setCategories(c.data as any);
      if (s.data) setServices(s.data as any);
      if (l.data) setLocations(l.data as any);
      if (sp.data) setStaff(sp.data as any);
      if (p.data) setProviders(p.data as any);

      if (sess?.data?.user) {
        setClient(prev => ({
          ...prev,
          email: sess.data.user.email ?? "",
          firstName: sess.data.user.user_metadata?.first_name ?? prev.firstName,
          lastName: sess.data.user.user_metadata?.last_name ?? prev.lastName,
          phone: sess.data.user.user_metadata?.phone ?? prev.phone,
        }));
      }
      setLoading(false);
    })();
  }, []);

  const selectedServices = useMemo(() => {
    return serviceIds.map(id => services.find(s => s.id === id)).filter(Boolean) as Service[];
  }, [serviceIds, services]);

  const totalDurationMin = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  }, [selectedServices]);

  const availableLocations = useMemo(() => {
    if (serviceIds.length === 0) return locations;
    const validLocs = locations.filter(loc => {
      return serviceIds.every(sId => providers.some(p => p.service_id === sId && p.location_id === loc.id));
    });
    return validLocs.length > 0 ? validLocs : locations;
  }, [serviceIds, locations, providers]);

  const availableStaff = useMemo(() => {
    if (!locationId || serviceIds.length === 0) return staff;
    const validStaff = staff.filter(st => {
      return serviceIds.every(sId => providers.some(p => p.service_id === sId && p.location_id === locationId && p.staff_id === st.id));
    });
    return validStaff.length > 0 ? validStaff : staff;
  }, [locationId, serviceIds, staff, providers]);

  const handleJumpToStep = (targetStep: number) => {
    if (targetStep < step) {
      if (step === 5 && payStep === "pay" && targetStep === 5) {
        setPayStep("consents");
        return;
      }
      setStep(targetStep as Step);
    }
  };

  const goNext = () => setStep(prev => Math.min(prev + 1, 5) as Step);
  const goBack = () => setStep(prev => Math.max(prev - 1, 1) as Step);

  const goToConsents = () => {
    const res = detailsSchema.safeParse(client);
    if (!res.success) {
      const errors: Record<string, string> = {};
      res.error.errors.forEach(e => {
        const path = String(e.path[0]);
        if (!errors[path]) errors[path] = e.message;
      });
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setStep(5);
    setPayStep("consents");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <SiteHeader />
        <div className="flex-1 flex flex-col items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary mb-2" />
          <p className="text-xs text-muted-foreground font-serif">Loading booking menu...</p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      {/* Main Container — Middle 90% Width */}
      <main className="flex-1 w-[95%] xl:w-[90%] max-w-[1440px] mx-auto px-3 sm:px-5 pt-2 pb-12">
        
        {/* SEPARATE Nurse Discount Banner — Placed right-aligned on top */}
        <div className="flex justify-end mb-2">
          <NurseDiscountBanner />
        </div>

        {draftBanner && draftRestored && (
          <div className="mb-2.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 flex items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="text-sm leading-none text-primary" aria-hidden>↻</span>
              <div>
                <span className="font-medium text-foreground">Welcome back — we saved your spot.</span>
                <span className="text-[11px] text-muted-foreground ml-2">
                  Picked up at step {draftBanner.step} of 6.
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                try { localStorage.removeItem("rka_book_draft"); } catch { }
                setServiceIds([]); setLocationId(null); setStaffId(null);
                setDate(undefined); setSlot(null); setStep(1);
                setDraftBanner(null); setDraftRestored(false);
              }}
              className="text-[11px] text-primary font-medium hover:underline shrink-0"
            >
              Start over
            </button>
          </div>
        )}

        {/* Clean 6-Step Header Card */}
        <div className="sticky top-2 z-30 mb-2.5 rounded-xl border border-border/70 bg-background/95 backdrop-blur-md shadow-xs p-3 sm:p-3.5">
          <div className="flex items-center justify-between gap-2 mb-2">
            {/* Step Label */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs uppercase tracking-[0.2em] font-semibold text-primary shrink-0">
                Step {step === 5 && payStep === "pay" ? 6 : step} of 6
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-xs sm:text-sm font-medium text-foreground truncate">
                {step === 1 && "Select Service(s)"}
                {step === 2 && "Location & Provider"}
                {step === 3 && "Date & Time"}
                {step === 4 && "Your Details"}
                {step === 5 && payStep === "consents" && "Review Consents"}
                {step === 5 && payStep === "pay" && "Card on File"}
              </span>
            </div>

            {/* Back Button */}
            {step > 1 && (
              <button
                onClick={() => { if (step === 5 && payStep === "pay") setPayStep("consents"); else goBack(); }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium px-2.5 py-1 rounded-full bg-secondary/80 hover:bg-secondary transition shrink-0"
                aria-label="Go back"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
            )}
          </div>

          {/* 6-Step Progress Line */}
          <div
            className="flex gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={6}
            aria-valuenow={step === 5 && payStep === "pay" ? 6 : step}
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
                  className={`h-2 flex-1 rounded-full transition-all duration-300 cursor-pointer ${
                    isCurrent
                      ? "bg-primary ring-3 ring-primary/20 scale-[1.01]"
                      : filled
                      ? "bg-primary/85 hover:bg-primary"
                      : "bg-secondary/90 hover:bg-primary/30"
                  }`}
                  title={`Step ${n}`}
                />
              );
            })}
          </div>
        </div>

        {/* Compact "What Happens Next" Cards — Positioned Directly Below Progress Header */}
        {step === 1 && (
          <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs shadow-2xs">
            <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-primary mb-2">
              What happens next
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div className="flex items-center gap-2.5 rounded-lg border border-primary/15 bg-background/90 p-2.5">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center justify-center shrink-0">
                  1
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground text-xs">Pick your service</div>
                  <div className="text-[10px] text-muted-foreground truncate">Browse menu, duration & clear pricing</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-lg border border-primary/15 bg-background/90 p-2.5">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center justify-center shrink-0">
                  2
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground text-xs">Pick a time</div>
                  <div className="text-[10px] text-muted-foreground truncate">Real-time availability & instant reservation</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-lg border border-primary/15 bg-background/90 p-2.5">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center justify-center shrink-0">
                  3
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground text-xs">Save card (No charge today)</div>
                  <div className="text-[10px] text-muted-foreground truncate">Card on file only used for visit or 48h cancel</div>
                </div>
              </div>
            </div>
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
              acknowledged={acknowledged}
              setAcknowledged={setAcknowledged}
              payStep={payStep}
              setPayStep={setPayStep}
              cardRef={cardRef}
              submitting={submitting}
              setSubmitting={setSubmitting}
              cardError={cardError}
              setCardError={setCardError}
              summary={{
                serviceName: selectedServices.map(s => s.name).join(" + "),
                staffName: staff.find(s => s.id === staffId)?.full_name ?? "",
                locationName: locations.find(l => l.id === locationId)?.name ?? "",
                startAt: slot,
                totalMin: totalDurationMin,
                totalCents: selectedServices.reduce((sum, s) => sum + (s.price_cents ?? 0), 0),
                client,
                serviceIds,
                locationId: locationId!,
                staffId,
                date: slot,
              }}
              onSuccess={(aptId) => {
                navigate(`/booking-confirmation?id=${aptId}`);
              }}
            />
          )}
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Book;
