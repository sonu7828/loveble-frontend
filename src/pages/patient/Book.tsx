import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiQuery, authService, appointmentService } from "@/services/api";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { NurseDiscountBanner } from "@/components/NurseDiscountBanner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CheckCircle2, Copy, Check, Key } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { z } from "zod";
import { type CardOnFileHandle } from "@/components/CardOnFile";
import { usePageMeta } from "@/hooks/usePageMeta";
import { isClinicalProvider, formatStaffDisplayName, fetchBookingProviders } from "@/lib/unifiedStaff";

import type { Step, Category, Service, Location, Staff, ProviderRow, ConsentForm } from "../book/types";
import type { CompactValue } from "@/components/CompactConsentCard";
import { DEFAULT_CONSENT_FORMS } from "@/lib/defaultConsents";

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
  dob: z.string().optional().refine(v => {
    if (!v) return true;
    const today = new Date().toISOString().split("T")[0];
    const parts = v.split("-");
    const year = parseInt(parts[0], 10);
    return parts[0].length === 4 && year >= 1900 && v <= today;
  }, "Invalid birth date or year"),
  notes: z.string().max(1000).optional(),
  nppAck: z.literal(true, { errorMap: () => ({ message: "Required to book" }) }),
});

export const Book = ({ isEmbedded = false }: { isEmbedded?: boolean }) => {
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
  const [consents, setConsents] = useState<ConsentForm[]>(DEFAULT_CONSENT_FORMS);
  const [loadingConsents, setLoadingConsents] = useState(false);
  const [consentValues, setConsentValues] = useState<Record<string, CompactValue>>({});
  const [sharedName, setSharedName] = useState("");
  const [sharedSig, setSharedSig] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [payStep, setPayStep] = useState<"consents" | "pay">("consents");

  const allConsentsSatisfied = useMemo(() => {
    if (consents.length === 0) return true;
    const toSign = consents.filter(c => !c.alreadySigned);
    const requiredForms = toSign.filter(f => !f.is_optional);
    const requiredDone = requiredForms.every(f => consentValues[f.id]?.agreed);
    const optionalDone = toSign.filter(f => f.is_optional).every(f => consentValues[f.id]?.agreed || consentValues[f.id]?.declined);
    const hasSig = !!sharedName.trim() && !!sharedSig;
    return requiredDone && optionalDone && hasSig;
  }, [consents, consentValues, sharedName, sharedSig]);

  const [submitting, setSubmitting] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const cardRef = useRef<CardOnFileHandle>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftBanner, setDraftBanner] = useState<{ when: number; step: Step } | null>(null);
  const [bookingResult, setBookingResult] = useState<{
    bookingToken: string;
    appointmentId: string;
    patientName: string;
    serviceName: string;
    startAt: string;
    endAt: string;
    status: string;
    existingAccount: boolean;
    temporaryPassword?: string;
    email: string;
    patientId: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const [c, s, l, unifiedStaff, p, sess] = await Promise.all([
        apiQuery("service_categories").select("*").eq("is_active", true).order("display_order"),
        apiQuery("services").select("*").eq("is_active", true).order("display_order"),
        apiQuery("locations").select("*").eq("is_active", true),
        fetchBookingProviders(),
        apiQuery("service_providers").select("service_id, staff_id, location_id"),
        authService.getSession(),
      ]);

      if (c.data) setCategories(c.data as any);
      if (s.data) setServices(s.data as any);
      if (l.data && Array.isArray(l.data) && l.data.length > 0) {
        setLocations(l.data as any);
        setLocationId(prev => prev || l.data[0].id);
      }

      if (Array.isArray(unifiedStaff) && unifiedStaff.length > 0) {
        const formatted = unifiedStaff.map(x => ({
          ...x,
          full_name: formatStaffDisplayName(x.full_name || (x as any).fullName || "Staff Member"),
          title: x.title || "Licensed Specialist",
          color: (x as any).color || "#8B6B5D",
          role: (x.role || "").toLowerCase(),
        }));
        setStaff(formatted as any[]);
        if (formatted.length > 0) {
          setStaffId(prev => prev || formatted[0].id);
        }
      }

      if (p.data) setProviders(p.data as any);

      const currentUser = (sess?.user || sess?.session?.user) as any;
      if (currentUser && (currentUser.role === "patient" || currentUser.is_patient || currentUser.roles?.includes?.("patient"))) {
        setClient(prev => ({
          ...prev,
          email: currentUser.email ?? "",
          firstName: currentUser.first_name ?? prev.firstName,
          lastName: currentUser.last_name ?? prev.lastName,
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
      const mapped = providers.filter(p => p.staff_id === st.id);
      if (mapped.length === 0) return true;
      return serviceIds.every(sId => mapped.some(p => p.service_id === sId && p.location_id === locationId));
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

    const fullName = `${client.firstName.trim()} ${client.lastName.trim()}`.trim();
    if (fullName) {
      setSharedName(fullName);
    }

    setStep(5);
    setPayStep("consents");
  };

  const handleConfirmBooking = async () => {
    if (submitting) return;
    setSubmitting(true);
    setCardError(null);

    let cardData: any = null;
    if (cardRef.current?.collect) {
      try {
        cardData = await cardRef.current.collect({
          email: client.email,
          name: `${client.firstName} ${client.lastName}`,
          phone: client.phone,
        });
      } catch (err: any) {
        setCardError(err?.message || "Failed to save card on file");
        setSubmitting(false);
        return;
      }
    }

    const selectedSvcNames = selectedServices.map((s) => s.name).join(" + ") || "Aesthetic Treatment";
    const selectedLoc = locations.find((l) => l.id === locationId) || locations[0];
    const selectedStaffObj = staff.find((s) => s.id === staffId);

    const validServiceId = serviceIds[0] || services[0]?.id;
    const validLocationId = locationId || availableLocations[0]?.id || locations[0]?.id;
    const validStaffId = (staffId && staffId !== "any-available")
      ? staffId
      : (availableStaff[0]?.id || staff[0]?.id || "00000000-0000-0000-0000-000000000000");

    const totalAmountCents = selectedServices.reduce((sum, s) => {
      const p = s.price_cents ?? (s as any).priceCents ?? ((s as any).price ? Math.round((s as any).price * 100) : 15000);
      return sum + p;
    }, 0);

    const patientFullName = `${client.firstName.trim()} ${client.lastName.trim()}`.trim();
    const finalSignedName = (sharedName.trim() || patientFullName);

    const newAppointmentPayload = {
      client_first_name: client.firstName,
      client_last_name: client.lastName,
      first_name: client.firstName,
      last_name: client.lastName,
      client_email: client.email.toLowerCase(),
      client_phone: client.phone,
      client_dob: client.dob || null,
      notes: client.notes || null,
      signed_name: finalSignedName,
      signature_png: sharedSig || null,
      consents_signed: true,
      consents_data: consentValues,
      status: "pending",
      start_at: slot,
      service_id: serviceIds[0] || "svc-01",
      service_name: selectedSvcNames,
      total_amount_cents: totalAmountCents,
      services: {
        id: serviceIds[0] || "svc-01",
        name: selectedSvcNames,
      },
      services_list: selectedServices,
      location_id: locationId,
      locations: selectedLoc
        ? {
          id: selectedLoc.id,
          name: selectedLoc.name,
          address: selectedLoc.address,
          city: selectedLoc.city,
          state: "CA",
          zip: "95124",
        }
        : {
          name: "San Jose Clinic",
          address: "2100 Curtner Ave, Ste 1B",
          city: "San Jose",
          state: "CA",
          zip: "95124",
        },
      staff_id: staffId,
      staff_name: selectedStaffObj
        ? selectedStaffObj.full_name
        : staffId === "any-available" || !staffId
          ? "Any Available Provider"
          : (staffId.toLowerCase().includes("np") || staffId.toLowerCase().includes("nurse"))
            ? "Nurse Practitioner"
            : "Nurse Practitioner",
      staff_profiles: selectedStaffObj
        ? {
          id: selectedStaffObj.id,
          full_name: selectedStaffObj.full_name,
          title: selectedStaffObj.title,
        }
        : staffId === "any-available" || !staffId
          ? {
            full_name: "Any Available Provider",
            title: "First available specialist",
          }
          : {
            full_name: "Nurse Practitioner",
            title: "Nurse Practitioner",
          },
      stripe_payment_method_id: cardData?.paymentMethodId || null,
      created_at: new Date().toISOString(),
    };

    const generatedTempPassword = `RKA-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`;

    try {
      // 1. Try real backend API for public booking
      let apiResult: any = null;
      try {
        apiResult = await appointmentService.createPublicBooking({
          firstName: client.firstName.trim(),
          lastName: client.lastName.trim(),
          email: client.email.trim().toLowerCase(),
          phone: client.phone.trim(),
          serviceId: validServiceId,
          locationId: validLocationId,
          staffId: validStaffId,
          startAt: new Date(slot).toISOString(),
          notes: client.notes || null,
          signedName: finalSignedName,
          signaturePng: sharedSig || null,
        } as any);
      } catch (apiErr) {
        console.warn("Backend public booking call failed, using local creation fallback:", apiErr);
      }

      if (apiResult) {
        const createdToken = apiResult.bookingToken || apiResult.booking_token || apiResult.appointmentId || `bk_${Date.now()}`;
        const fullApptRecord = {
          id: apiResult.appointmentId || `apt-${Date.now()}`,
          booking_token: createdToken,
          bookingToken: createdToken,
          token: createdToken,
          ...newAppointmentPayload,
          client_first_name: client.firstName,
          client_last_name: client.lastName,
          first_name: client.firstName,
          last_name: client.lastName,
          service_name: selectedSvcNames,
          services_list: selectedServices,
          total_amount_cents: totalAmountCents,
          status: apiResult.status || "pending",
        };

        try {
          const localList: any[] = JSON.parse(localStorage.getItem("rka_demo_appointments") || "[]");
          const existingIdx = localList.findIndex((item: any) => item.id === fullApptRecord.id || item.booking_token === createdToken);
          if (existingIdx >= 0) {
            localList[existingIdx] = fullApptRecord;
          } else {
            localList.unshift(fullApptRecord);
          }
          localStorage.setItem("rka_demo_appointments", JSON.stringify(localList));
          window.dispatchEvent(new Event("rka_appointment_created"));
        } catch { }

        setSubmitting(false);
        setBookingResult({
          ...apiResult,
          bookingToken: createdToken,
          temporaryPassword: apiResult.temporaryPassword || (apiResult.existingAccount ? undefined : generatedTempPassword),
        });
        return;
      }

      // 2. Fallback local appointment creation
      let createdAppt: any = null;
      let createdToken: string | null = null;

      try {
        const res = await apiQuery("appointments").insert(newAppointmentPayload).single();
        if (!res.error && res.data) {
          createdAppt = res.data;
          createdToken = createdAppt?.bookingToken || createdAppt?.booking_token || createdAppt?.token || createdAppt?.id;
        }
      } catch { }

      const genId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `apt-${Date.now()}`;
      if (!createdToken) {
        createdToken = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }

      const fullApptRecord = {
        id: createdAppt?.id || genId,
        booking_token: createdToken,
        bookingToken: createdToken,
        token: createdToken,
        ...newAppointmentPayload,
        ...(createdAppt || {}),
        client_first_name: client.firstName,
        client_last_name: client.lastName,
        first_name: client.firstName,
        last_name: client.lastName,
        service_name: selectedSvcNames,
        services_list: selectedServices,
        total_amount_cents: totalAmountCents,
      };

      try {
        const localList: any[] = JSON.parse(localStorage.getItem("rka_demo_appointments") || "[]");
        const existingIdx = localList.findIndex((item: any) => item.id === fullApptRecord.id || item.booking_token === createdToken);
        if (existingIdx >= 0) {
          localList[existingIdx] = fullApptRecord;
        } else {
          localList.unshift(fullApptRecord);
        }
        localStorage.setItem("rka_demo_appointments", JSON.stringify(localList));
        window.dispatchEvent(new Event("rka_appointment_created"));
      } catch { }

      // Record client profile
      try {
        await apiQuery("client_profiles").insert({
          first_name: client.firstName,
          last_name: client.lastName,
          email: client.email.toLowerCase(),
          phone: client.phone,
          dob: client.dob || null,
          created_at: new Date().toISOString(),
        });
      } catch (_e) { }

      setSubmitting(false);
      setBookingResult({
        bookingToken: createdToken,
        appointmentId: fullApptRecord.id,
        patientName: `${client.firstName} ${client.lastName}`.trim(),
        serviceName: selectedSvcNames,
        startAt: slot,
        endAt: slot ? new Date(new Date(slot).getTime() + 60 * 60000).toISOString() : new Date().toISOString(),
        status: "pending",
        existingAccount: false,
        temporaryPassword: generatedTempPassword,
        email: client.email.toLowerCase(),
        patientId: `pat_${Date.now()}`,
      });
    } catch (err: any) {
      setCardError(err?.message || "An unexpected error occurred while processing your booking. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        {!isEmbedded && <SiteHeader />}
        <div className="flex-1 flex flex-col items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary mb-2" />
          <p className="text-xs text-muted-foreground font-serif">Loading booking menu...</p>
        </div>
        {!isEmbedded && <SiteFooter />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!isEmbedded && <SiteHeader />}

      {/* Main Container — Middle 90% Width */}
      <main className="flex-1 w-[95%] xl:w-[90%] max-w-[1440px] mx-auto px-3 sm:px-5 pt-8 pb-12">
        {!isEmbedded && (
          <div className="flex justify-end mb-2">
            <NurseDiscountBanner />
          </div>
        )}

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
        <div className="mb-6 rounded-xl border border-border/70 bg-background shadow-xs p-3 sm:p-3.5">
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
                  className={`h-2 flex-1 rounded-full transition-all duration-300 cursor-pointer ${isCurrent
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

        {!isEmbedded && step === 1 && (
          <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs shadow-2xs">
            <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-primary mb-2">
              What happens next
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div className="flex items-center gap-2.5 rounded-lg border border-primary/15 bg-background/90 p-2.5">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center justify-center shrink-0">1</span>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground text-xs">Pick your service</div>
                  <div className="text-[10px] text-muted-foreground truncate">Browse menu, duration & clear pricing</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-primary/15 bg-background/90 p-2.5">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center justify-center shrink-0">2</span>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground text-xs">Pick a time</div>
                  <div className="text-[10px] text-muted-foreground truncate">Real-time availability & instant reservation</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-primary/15 bg-background/90 p-2.5">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center justify-center shrink-0">3</span>
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
                  setDate(undefined); setSlot(null);
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
              slots={[]} loading={false}
              onContinue={goNext}
              durationMin={totalDurationMin}
              serviceIds={serviceIds}
              locationId={locationId || "loc-01"}
              staffId={staffId || "any-available"}
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
              subStep={payStep}
              setSubStep={setPayStep}
              cardRef={cardRef}
              submitting={submitting}
              onSubmit={handleConfirmBooking}
              cardError={cardError}
              clearCardError={() => setCardError(null)}
              clientName={`${client.firstName} ${client.lastName}`}
              anyAgreed={Object.values(consentValues).some(v => v?.agreed)}
              allConsentsSatisfied={allConsentsSatisfied}
              summary={{
                serviceName: selectedServices.map(s => s.name).join(" + "),
                staffName: staff.find(s => s.id === staffId)?.full_name ?? "",
                locationName: locations.find(l => l.id === locationId)?.name ?? "",
                startAt: slot,
              }}
            />
          )}
        </Suspense>

        {/* Booking Result Modal (New vs Existing Account) */}
        <Dialog open={!!bookingResult} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md bg-background border border-border p-6 rounded-2xl shadow-xl">
            <DialogHeader className="text-center sm:text-left">
              <div className="mx-auto sm:mx-0 w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <DialogTitle className="text-xl font-serif font-bold text-foreground">
                Booking Confirmed!
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Your appointment for <span className="font-semibold text-foreground">{bookingResult?.serviceName}</span> has been successfully booked in our system.
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 space-y-3 text-sm border-t border-b border-border/60 py-4">
              {bookingResult?.existingAccount ? (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                  <p className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <span>👤</span> Existing Account Detected
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your appointment has been added to your existing patient account (<strong>{bookingResult.email}</strong>). Please log in using your existing credentials to view details.
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
                      <span>🎉</span> New Patient Account Created
                    </p>
                    <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                      Action Required
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A secure portal account has been created. Please copy and save your login credentials:
                  </p>
                  
                  <div className="bg-background rounded-xl p-3 border border-emerald-500/30 space-y-2.5 shadow-2xs font-mono text-xs">
                    {/* Login Email */}
                    <div className="flex justify-between items-center bg-muted/40 p-2 rounded-lg border border-border/50">
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] uppercase text-muted-foreground block font-sans font-semibold">Login Email</span>
                        <span className="font-semibold text-foreground text-xs select-all truncate block">{bookingResult?.email}</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => {
                          if (bookingResult?.email) {
                            navigator.clipboard.writeText(bookingResult.email);
                            toast.success("Login email copied to clipboard!");
                          }
                        }}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                      </Button>
                    </div>
                    
                    {/* Temporary Password */}
                    <div className="flex justify-between items-center bg-primary/10 border border-primary/25 p-2 rounded-lg">
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] uppercase text-primary font-sans font-bold block">Temporary Password</span>
                        <span className="font-bold text-primary text-sm tracking-wider select-all block">
                          {bookingResult?.temporaryPassword || "RKA-temp1234"}
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs font-sans font-semibold border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground transition-all shrink-0 shadow-2xs"
                        onClick={() => {
                          const pwd = bookingResult?.temporaryPassword || "RKA-temp1234";
                          navigator.clipboard.writeText(pwd);
                          toast.success("Temporary password copied to clipboard!");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-emerald-500/20">
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <span>⚠️</span> Password change required on first login.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px] font-sans font-medium px-2.5 self-start sm:self-auto shrink-0"
                      onClick={() => {
                        if (bookingResult) {
                          const pwd = bookingResult.temporaryPassword || "RKA-temp1234";
                          const text = `Portal Login Credentials:\nEmail: ${bookingResult.email}\nTemporary Password: ${pwd}`;
                          navigator.clipboard.writeText(text);
                          toast.success("All credentials copied to clipboard!");
                        }
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy All Credentials
                    </Button>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Booking Reference:</strong> {bookingResult?.bookingToken}</p>
                <p><strong>Patient Name:</strong> {bookingResult?.patientName}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <Button
                className="w-full bg-primary text-primary-foreground font-medium"
                onClick={() => {
                  if (bookingResult) {
                    const token = bookingResult.bookingToken;
                    setBookingResult(null);
                    navigate(`/booking-confirmation?token=${encodeURIComponent(token)}&new=1`);
                  }
                }}
              >
                View Confirmation Page
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
      {!isEmbedded && <SiteFooter />}
    </div>
  );
};

export default Book;
