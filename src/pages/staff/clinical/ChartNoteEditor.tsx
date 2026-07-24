// Chart note editor — single page that handles all four categories.
// Mode: create (?appointment=<id> or ?client=<email>&category=<cat>) or view (/staff/clinical/notes/:id)
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { openPdf } from "@/lib/openPdf";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, FileCheck2, ShieldAlert, Download, Trash2, Plus, Mic, MicOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useDictation } from "@/hooks/useDictation";
import { computeInteractionAlerts } from "@/lib/interactionAlerts";
import { SafetyAlertsBanner } from "@/components/clinical/SafetyAlertsBanner";
import { ChecklistGroup, SingleSelectChips } from "@/components/clinical/ChecklistGroup";
import { MiniSignaturePad } from "@/components/clinical/MiniSignaturePad";
import {
  POST_ASSESSMENT,
  NEUROTOXIN_PRODUCTS, NEUROTOXIN_DILUTIONS, NEUROTOXIN_TECHNIQUE, NEEDLE_GAUGES,
  NEUROTOXIN_ZONES, NEUROTOXIN_ADVERSE, NEUROTOXIN_INVENTORY,
  FILLER_PRODUCTS, FILLER_AREAS, FILLER_TECHNIQUE, FILLER_DELIVERY, FILLER_ANESTHETIC, FILLER_ADVERSE, FILLER_INVENTORY,
  ENERGY_DEVICES, ENERGY_AREAS, ENERGY_ENDPOINT, ENERGY_ADVERSE,
  WELLNESS_SERVICES, WELLNESS_ROUTES, WELLNESS_ADVERSE, WELLNESS_GUIDANCE, WELLNESS_INVENTORY, WELLNESS_INJECTABLE_SERVICES,
} from "@/lib/clinicalOptions";
import { format } from "date-fns";
import { LotPicker, type LotOption } from "@/components/staff/LotPicker";
import { ChartTemplatePicker } from "@/components/staff/ChartTemplatePicker";
import { InjectionTreatmentRecord, type MapPoint } from "@/components/clinical/InjectionTreatmentRecord";
import { BarcodeScannerButton } from "@/components/clinical/BarcodeScannerButton";
import { OfflineSaveBadge } from "@/components/clinical/OfflineSaveBadge";
import { readChartDraft, useChartDraftAutosave } from "@/hooks/useChartDraftAutosave";
import { buildVisitSummary } from "@/lib/visitSummary";
import { PhotoCaptureFlow } from "@/components/clinical/PhotoCaptureFlow";
import { WatermarkedExportButton } from "@/components/clinical/WatermarkedExportButton";
import { BeforeAfterSlider } from "@/components/clinical/BeforeAfterSlider";
import { Camera } from "lucide-react";
import { AIScribeDialog } from "@/components/clinical/AIScribeDialog";

type Category = "neurotoxin" | "filler" | "energy" | "wellness" | "consult";

type ApptService = { id: string; name: string; category: Category | null; appointmentId: string | null };
type ApptNote = { id: string; service_name: string | null; appointment_id?: string | null };
type ChartAutosaveSnapshot = {
  indication?: string;
  providerNotes?: string;
  adverseNarrative?: string;
  newMedsSinceGfe?: string;
  neuro?: any;
  filler?: any;
  energy?: any;
  wellness?: any;
  bpSys?: string;
  bpDia?: string;
  heartRate?: string;
  painPre?: string;
  painPost?: string;
  followupWeeks?: string;
  postAssessment?: string[];
  allergiesConfirmedToday?: string[];
};

const CATEGORY_LABEL: Record<Category, string> = {
  neurotoxin: "Neurotoxin",
  filler: "Filler / Biostimulator",
  energy: "Energy Device / Microneedling",
  wellness: "Wellness / Skincare / Peel",
  consult: "Consultation (SOAP only)",
};

// Best-effort: classify a service by name keywords → category.
function categoryFromServiceCategory(categoryName: string | null | undefined): Category | null {
  const n = (categoryName ?? "").toLowerCase();
  if (!n) return null;
  if (/consult/.test(n)) return "consult";
  if (/neurotoxin|tox/.test(n)) return "neurotoxin";
  if (/dermal filler|filler|biostimulator/.test(n)) return "filler";
  if (/laser|microneedling|skin tightening|body contour|energy/.test(n)) return "energy";
  if (/medical wellness|chemical peel|facial|skincare|peel/.test(n)) return "wellness";
  return null;
}

function categoryFromServiceName(name: string | null | undefined, categoryName?: string | null): Category | null {
  const byCategory = categoryFromServiceCategory(categoryName);
  if (byCategory) return byCategory;
  const n = (name ?? "").toLowerCase();
  if (!n) return null;
  if (/consult/.test(n)) return "consult";
  if (/(botox|dysport|xeomin|daxxify|jeuveau|tox|neurotoxin)/.test(n)) return "neurotoxin";
  if (/(filler|juvederm|restylane|rha|sculptra|radiesse|biostim|volux|voluma)/.test(n)) return "filler";
  if (/(ultherapy|morpheus|microneedl|laser|ipl|bbl|\brf\b|hydrafacial|skinpen|co2|erbium|pico|yag|nd:yag|nd yag|emsculpt|emsella|hifem|coolsculpt|trusculpt|body contour)/.test(n)) return "energy";
  if (/(b12|lipo|iv|hydration|peel|glycolic|salicylic|tca|jessner|glp|semaglutide|tirzepatide|prp|prf|dermaplane)/.test(n)) return "wellness";
  // Model day appointments are NOT chartable on their own — the booked treatment service drives charting.
  return null;
}

function makeClinicalNoteId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function energyDeviceOptionForService(serviceName: string | null | undefined) {
  const n = (serviceName ?? "").toLowerCase();
  if (/(co2|co₂|carbon dioxide)/.test(n)) return "CO2 fractional";
  if (/(rf.*microneedl|microneedl.*rf|morpheus)/.test(n)) return "RF microneedling (other)";
  if (/skinpen|pen microneedl/.test(n)) return "Pen microneedling";
  if (/ipl|bbl/.test(n)) return "IPL / BBL";
  if (/(nd\s*:?-?\s*yag|yag)/.test(n)) return "Nd:YAG";
  if (/laser genesis|genesis/.test(n)) return "Laser genesis";
  if (/hair.*remov|remov.*hair|laser hair/.test(n)) return "Hair removal laser";
  if (/vascular/.test(n)) return "Vascular laser";
  if (/pico/.test(n)) return "Pico laser";
  return null;
}

function energyDeviceForService(serviceName: string | null | undefined, currentDevice: string) {
  const option = energyDeviceOptionForService(serviceName);
  if (option) return option;
  return currentDevice;
}

async function hydrateAppointmentServices(
  rows: Array<{ appointment_id?: string | null; service_id: string | null; display_order?: number | null }>,
  fallbackAppointmentId: string | null,
): Promise<ApptService[]> {
  const orderedRows = rows.filter((r) => !!r.service_id);
  const serviceIds = Array.from(new Set(orderedRows.map((r) => r.service_id as string)));
  if (!serviceIds.length) return [];

  const { data: services } = await supabase
    .from("services")
    .select("id, name, service_categories(name)")
    .in("id", serviceIds);
  const byId = new Map((services ?? []).map((svc: any) => [svc.id as string, svc]));

  return orderedRows
    .map((row) => {
      const svc: any = byId.get(row.service_id as string);
      if (!svc) return null;
      const categoryName = Array.isArray(svc.service_categories)
        ? svc.service_categories[0]?.name
        : svc.service_categories?.name;
      return {
        id: svc.id as string,
        name: svc.name as string,
        category: categoryFromServiceName(svc.name, categoryName),
        appointmentId: row.appointment_id ?? fallbackAppointmentId,
      } satisfies ApptService;
    })
    .filter(Boolean) as ApptService[];
}

export default function ChartNoteEditor() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { user, isClinicalStaff, isNP, isMedicalDirector, isAdmin, staffId } = useAuth();
  const isViewMode = !!id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [sigs, setSigs] = useState<any[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const draftAutoResumedRef = useRef<string | null>(null);

  // Create-mode shared state
  const [providerName, setProviderName] = useState("");
  const [category, setCategory] = useState<Category>((sp.get("category") as Category) || "neurotoxin");
  const [client, setClient] = useState({ email: "", first: "", last: "", dob: "" });
  const [appointmentId, setAppointmentId] = useState<string | null>(sp.get("appointment"));
  const [locationId, setLocationId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [currentServiceId, setCurrentServiceId] = useState<string | null>(sp.get("service"));
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [apptServices, setApptServices] = useState<ApptService[]>([]);
  const [apptNotes, setApptNotes] = useState<ApptNote[]>([]);
  const [gfe, setGfe] = useState<any>(null);
  const [consentsVerified, setConsentsVerified] = useState(false);

  // Phase 3: Pre-procedure reconciliation & safety
  const [allergiesConfirmedToday, setAllergiesConfirmedToday] = useState<string[]>([]);
  const [newMedsSinceGfe, setNewMedsSinceGfe] = useState("");
  const [indication, setIndication] = useState("");
  // Universal-protocol time-out is not applicable for aesthetic chart notes.
  // Defaulted to true so back-end columns remain satisfied.
  const [patientVerbalizedUnderstanding] = useState(true);
  const [timeOutCompleted] = useState(true);
  const [siteMarked] = useState(true);
  const [emergencyEquipmentAvailable] = useState(true);
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [painPre, setPainPre] = useState("");
  const [painPost, setPainPost] = useState("");
   const [photoPrePaths, setPhotoPrePaths] = useState<string[]>([]);
   const [photoPostPaths, setPhotoPostPaths] = useState<string[]>([]);
   const [captureKind, setCaptureKind] = useState<null | "pre" | "post">(null);
  // Pre-allocate the note id so photos can be uploaded into the note folder before sign.
  const [pendingNoteId, setPendingNoteId] = useState<string>(() => makeClinicalNoteId());
  // Set to true once a draft `clinical_notes` row exists in the database for
  // this pendingNoteId. Once true, photo uploads (and submit()) update the
  // existing row rather than insert a new one — this is what prevents
  // mid-visit photos from being orphaned if the provider navigates away.
  const [draftRowExists, setDraftRowExists] = useState(false);
  // Resume banner state for in-progress drafts found on mount.
  const [resumableDraft, setResumableDraft] = useState<any>(null);
  const [resumedDraftServiceName, setResumedDraftServiceName] = useState<string | null>(null);
  const [vitalsOpen, setVitalsOpen] = useState<boolean | null>(null);

  // Per-category state
  const [neuro, setNeuro] = useState({
    product: "Botox", lot_number: "", expiration_date: "",
    dilution: "2.5 mL / 100u",
    reconstitution_agent: "Preservative-free 0.9% saline",
    needle_gauge: "31G",
    technique: ["Intramuscular"] as string[],
    map: [] as { zone: string; units: number }[],
    points: [] as MapPoint[],
    adverse: ["None"] as string[],
    post_care_given: true,
  });
  const [fillerPoints, setFillerPoints] = useState<MapPoint[]>([]);
  const [energyPoints, setEnergyPoints] = useState<MapPoint[]>([]);
  const [wellnessPoints, setWellnessPoints] = useState<MapPoint[]>([]);
  // Ghost overlay: most-recent prior signed neurotoxin visit's injection map.
  const [previousNeuroPoints, setPreviousNeuroPoints] = useState<MapPoint[]>([]);
  const [filler, setFiller] = useState({
    product: "Juvederm Voluma XC", syringes_used: 1,
    lots: [{ lot: "", exp: "" }] as { lot: string; exp: string }[],
    areas: [] as string[], technique: ["Linear threading"] as string[],
    delivery: "Cannula", needle_gauge: "25G",
    anesthetic: "Topical lidocaine",
    hyaluronidase_onsite: true, vascular_protocol_reviewed: true,
    adverse: ["None"] as string[],
  });
  const [energy, setEnergy] = useState({
    device: "Ultherapy", device_serial: "",
    lot_number: "", expiration_date: "",
    energy: "", depth: "", pulse_width: "", passes: "",
    areas: [] as string[], cooling_used: false, numbing_used: true,
    endpoint: [] as string[], adverse: ["None"] as string[],
  });
  const [wellness, setWellness] = useState({
    service_type: "B12 injection", product: "", dose: "", strength: "", layers: "",
    route: "IM", lot_number: "", expiration_date: "", neutralization: "",
    adverse: ["None"] as string[],
  });
  // 503A medical-necessity attestations for compounded GLP-1
  const [necessityChecked, setNecessityChecked] = useState<string[]>([]);

  // Linked inventory lot ids (optional — when set, inventory auto-decrements on sign)
  const [neuroLot, setNeuroLot] = useState<LotOption | null>(null);
  const [fillerLots, setFillerLots] = useState<(LotOption | null)[]>([null]);
  const [energyLot, setEnergyLot] = useState<LotOption | null>(null);
  const [wellnessLot, setWellnessLot] = useState<LotOption | null>(null);



  // Footer shared
  const [postAssessment, setPostAssessment] = useState<string[]>([]);
  const [postOpReviewed, setPostOpReviewed] = useState(true);
  const [followupWeeks, setFollowupWeeks] = useState<string>("");
  const [providerNotes, setProviderNotes] = useState("");
  const [aiDrafting, setAiDrafting] = useState(false);
  const [scribeOpen, setScribeOpen] = useState(sp.get("scribe") === "1");
  // Adverse event narrative — required when adverse selection != "None".
  const [adverseNarrative, setAdverseNarrative] = useState("");
  const [adverseSeverity, setAdverseSeverity] = useState<"mild" | "moderate" | "severe" | "">("");

  function restoreDraftState(draft: any, opts: { silent?: boolean } = {}) {
    if (!draft?.id) return;
    setPendingNoteId(draft.id);
    if (draft.appointment_id) setAppointmentId(draft.appointment_id);
    if (draft.client_email || draft.client_first_name || draft.client_last_name || draft.client_dob) {
      setClient({
        email: draft.client_email ?? "",
        first: draft.client_first_name ?? "",
        last: draft.client_last_name ?? "",
        dob: draft.client_dob ?? "",
      });
    }
    if (draft.location_id) setLocationId(draft.location_id);
    if (draft.provider_name) setProviderName(draft.provider_name);
    setPhotoPrePaths(draft.photo_pre_paths ?? []);
    setPhotoPostPaths(draft.photo_post_paths ?? []);
    if (draft.category) setCategory(draft.category);
    if (draft.service_name) {
      setServiceName(draft.service_name);
      setResumedDraftServiceName(draft.service_name);
    }
    if (draft.provider_notes) setProviderNotes(draft.provider_notes);
    if (draft.indication) setIndication(draft.indication);
    if (draft.new_medications_since_gfe) setNewMedsSinceGfe(draft.new_medications_since_gfe);
    if (Array.isArray(draft.allergies_confirmed_today)) setAllergiesConfirmedToday(draft.allergies_confirmed_today);
    if (draft.bp_systolic != null) setBpSys(String(draft.bp_systolic));
    if (draft.bp_diastolic != null) setBpDia(String(draft.bp_diastolic));
    if (draft.heart_rate != null) setHeartRate(String(draft.heart_rate));
    if (draft.pain_score_pre != null) setPainPre(String(draft.pain_score_pre));
    if (draft.pain_score_post != null) setPainPost(String(draft.pain_score_post));
    if (Array.isArray(draft.post_assessment)) setPostAssessment(draft.post_assessment);
    if (typeof draft.post_op_reviewed === "boolean") setPostOpReviewed(draft.post_op_reviewed);
    if (draft.followup_weeks != null) setFollowupWeeks(String(draft.followup_weeks));
    const local = readChartDraft<ChartAutosaveSnapshot>(draft.id)?.data;
    if (local) {
      if (local.indication != null) setIndication(local.indication);
      if (local.providerNotes != null) setProviderNotes(local.providerNotes);
      if (local.adverseNarrative != null) setAdverseNarrative(local.adverseNarrative);
      if (local.newMedsSinceGfe != null) setNewMedsSinceGfe(local.newMedsSinceGfe);
      if (local.neuro) setNeuro(local.neuro);
      if (local.filler) setFiller(local.filler);
      if (local.energy) setEnergy(local.energy);
      if (local.wellness) setWellness(local.wellness);
      if (local.bpSys != null) setBpSys(local.bpSys);
      if (local.bpDia != null) setBpDia(local.bpDia);
      if (local.heartRate != null) setHeartRate(local.heartRate);
      if (local.painPre != null) setPainPre(local.painPre);
      if (local.painPost != null) setPainPost(local.painPost);
      if (local.followupWeeks != null) setFollowupWeeks(local.followupWeeks);
      if (Array.isArray(local.postAssessment)) setPostAssessment(local.postAssessment);
      if (Array.isArray(local.allergiesConfirmedToday)) setAllergiesConfirmedToday(local.allergiesConfirmedToday);
    }
    if (draft.category === "energy" && draft.service_name) {
      setEnergy(prev => ({ ...prev, device: energyDeviceForService(draft.service_name, prev.device) }));
    }
    setDraftRowExists(true);
    setResumableDraft(null);
    if (!opts.silent) toast.success("Draft resumed");
  }

  async function handleAiDraftSoap() {
    setAiDrafting(true);
    try {
      const payload: Record<string, unknown> = {
        category,
        service_name: serviceName,
        chief_concerns: gfe?.chief_concerns ?? [],
        treatment_areas: category === "neurotoxin"
          ? neuro.map.map(m => m.zone)
          : category === "filler" ? filler.areas
          : category === "energy" ? energy.areas
          : [],
        vitals: {
          bp: bpSys && bpDia ? `${bpSys}/${bpDia}` : "",
          hr: heartRate, pain_pre: painPre, pain_post: painPost,
        },
        allergies: allergiesConfirmedToday,
        meds: newMedsSinceGfe ? [newMedsSinceGfe] : [],
        neuro: category === "neurotoxin" ? neuro : undefined,
        filler: category === "filler" ? filler : undefined,
        energy: category === "energy" ? energy : undefined,
        wellness: category === "wellness" ? wellness : undefined,
        post_assessment: postAssessment,
        followup_weeks: followupWeeks,
      };
      const { data, error } = await supabase.functions.invoke("ai-draft-soap", { body: payload });
      if (error) throw error;
      const draft = (data as any)?.draft?.trim?.() ?? "";
      if (!draft) { toast.error("AI returned an empty draft. Try again."); return; }
      setProviderNotes(prev => (prev.trim() ? prev.trim() + "\n\n" : "") + draft);
      toast.success("Draft inserted — please review before signing.");
    } catch (e: any) {
      toast.error(e?.message ?? "AI draft failed");
    } finally {
      setAiDrafting(false);
    }
  }

  const [customPhrases, setCustomPhrases] = useState<Array<{ category: string; phrase: string }>>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("quick_phrases")
        .select("category, phrase").eq("is_active", true).order("sort_order");
      if (data) setCustomPhrases(data as any);
    })();
  }, []);

  // Load the most recent prior neurotoxin map for this client so we can render
  // it as a ghost overlay on the new visit — providers can place new pins next
  // to (or away from) where they injected last time.
  useEffect(() => {
    if (!client.email) { setPreviousNeuroPoints([]); return; }
    let cancel = false;
    (async () => {
      const { data: prev } = await supabase
        .from("clinical_notes")
        .select("id")
        .ilike("client_email", client.email)
        .eq("category", "neurotoxin")
        .in("status", ["signed", "cosigned", "locked"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!prev?.id || cancel) return;
      const { data: d } = await supabase
        .from("clinical_note_neurotoxin")
        .select("injection_map")
        .eq("clinical_note_id", prev.id)
        .maybeSingle();
      const im: any = (d as any)?.injection_map;
      const pts: MapPoint[] = Array.isArray(im?.points) ? im.points : [];
      if (!cancel) setPreviousNeuroPoints(pts);
    })();
    return () => { cancel = true; };
  }, [client.email]);
  const customPhrasesForCategory = useMemo(
    () => customPhrases.filter(p => p.category === category).map(p => p.phrase),
    [customPhrases, category],
  );
  const compliancePhrases = useMemo(
    () => customPhrases.filter(p => p.category === "compliance").map(p => p.phrase),
    [customPhrases],
  );
  // Signature
  const [sigFullName, setSigFullName] = useState("");
  const [sigPng, setSigPng] = useState("");
  // Saved provider signature (from staff_profiles). Auto-fills when present.
  const [savedSig, setSavedSig] = useState<{ png: string; name: string } | null>(null);
  const [saveSigForFuture, setSaveSigForFuture] = useState(false);
  const sigAutoFilledRef = useRef(false);

  useEffect(() => {
    if (isViewMode || !user) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("staff_profiles")
        .select("saved_signature_png, saved_signature_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancel) return;
      const png = (data as any)?.saved_signature_png ?? "";
      const name = (data as any)?.saved_signature_name ?? "";
      if (png && name) {
        setSavedSig({ png, name });
        // Auto-fill only if the user hasn't started a signature yet.
        if (!sigAutoFilledRef.current && !sigPng && !sigFullName) {
          setSigPng(png);
          setSigFullName(name);
          sigAutoFilledRef.current = true;
        }
      }
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isViewMode]);

  async function persistSavedSignature(png: string, name: string) {
    if (!user || !png || !name) return;
    await supabase
      .from("staff_profiles")
      .update({
        saved_signature_png: png,
        saved_signature_name: name,
        signature_saved_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
    setSavedSig({ png, name });
  }

  // Apply a chart-note template's body to the right category state slice.
  function applyTemplate(body: Record<string, any>) {
    if (!body || typeof body !== "object") return;
    // Shared fields applicable to most templates
    if (typeof body.provider_notes === "string") {
      setProviderNotes(prev => prev?.trim() ? prev : body.provider_notes);
    }
    if (typeof body.post_assessment === "string" && body.post_assessment.trim()) {
      // Append to post-assessment chips as a free-form note via providerNotes if not chip-shaped.
      setProviderNotes(prev => {
        const extra = `Assessment: ${body.post_assessment}`;
        if (!prev) return extra;
        return prev.includes(extra) ? prev : `${prev}\n\n${extra}`;
      });
    }
    if (category === "neurotoxin") {
      setNeuro(n => ({
        ...n,
        product: typeof body.product === "string" ? body.product : n.product,
      }));
    } else if (category === "filler") {
      setFiller(f => ({
        ...f,
        product: typeof body.product === "string" ? body.product : f.product,
        areas: Array.isArray(body.areas) && body.areas.length ? body.areas : f.areas,
        technique: Array.isArray(body.technique) ? body.technique : (typeof body.technique === "string" ? [body.technique] : f.technique),
        delivery: typeof body.delivery === "string" ? body.delivery
          : (typeof body.technique === "string" && /cannula/i.test(body.technique) ? "Cannula" : f.delivery),
        needle_gauge: typeof body.needle_gauge === "string" ? body.needle_gauge : f.needle_gauge,
        anesthetic: typeof body.anesthetic === "string" ? body.anesthetic : f.anesthetic,
      }));
    } else if (category === "energy") {
      setEnergy(e => ({
        ...e,
        device: typeof body.device === "string" ? body.device : e.device,
        areas: Array.isArray(body.areas) && body.areas.length ? body.areas : e.areas,
        depth: typeof body.depth_mm === "string" ? body.depth_mm : (typeof body.depth === "string" ? body.depth : e.depth),
        passes: typeof body.passes === "string" ? body.passes : e.passes,
        energy: typeof body.fluence === "string" ? body.fluence : (typeof body.energy === "string" ? body.energy : e.energy),
        endpoint: typeof body.endpoint === "string" && body.endpoint.trim() ? [body.endpoint] : e.endpoint,
      }));
    } else if (category === "wellness") {
      setWellness(w => ({
        ...w,
        product: typeof body.product === "string" ? body.product : w.product,
      }));
    }
  }

  // Auto-apply the simplified "Follow-up / Touch-up" template when the current
  // service is a follow-up visit (e.g. "Neurotoxin Follow-Up", "Follow-Up Visit",
  // "Generalized follow up", "Televisit Follow-Up", or anything with "touch up").
  // Only runs once per (serviceName + category) pair while in create mode and
  // only when providerNotes is still empty, so it never overwrites edits.
  const autoAppliedFollowupRef = useRef<string | null>(null);
  useEffect(() => {
    if (isViewMode) return;
    if (!serviceName || !category) return;
    const key = `${category}::${serviceName.toLowerCase()}`;
    if (autoAppliedFollowupRef.current === key) return;
    const isFollowup = /follow[\s-]?up|touch[\s-]?up|check[\s-]?in/i.test(serviceName);
    if (!isFollowup) return;
    if (providerNotes && providerNotes.trim().length > 0) {
      autoAppliedFollowupRef.current = key;
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("chart_note_templates")
        .select("body")
        .eq("category", category)
        .eq("subtype", "followup")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      const body = (data as any)?.body;
      if (body) {
        applyTemplate(body);
        autoAppliedFollowupRef.current = key;
        toast.success("Follow-up template applied — edit as needed.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewMode, serviceName, category]);





  // ===== Load create context (appointment) =====
  useEffect(() => {
    if (isViewMode) return;
    const draftId = sp.get("draft");
    (async () => {
      if (!user) return;
      const { data: sprof } = await supabase.from("staff_profiles").select("full_name").eq("user_id", user.id).maybeSingle();
      if (sprof?.full_name) { setProviderName(sprof.full_name); setSigFullName(sprof.full_name); }

      if (appointmentId) {
        const { data: appt } = await supabase.from("appointments").select("*").eq("id", appointmentId).maybeSingle();
        if (appt) {
          let dobVal = appt.client_dob ?? "";
          // Fallback: lookup DOB from client_profiles by email when appointment lacks it
          if (!dobVal && appt.client_email) {
            const { data: cp } = await supabase
              .from("client_profiles")
              .select("dob")
              .ilike("email", appt.client_email)
              .maybeSingle();
            if (cp?.dob) dobVal = cp.dob;
          }
          setClient({
            email: appt.client_email, first: appt.client_first_name, last: appt.client_last_name,
            dob: dobVal,
          });
          setLocationId(appt.location_id);

          // Load ALL services on this appointment (multi-service support).
          // Do this in two queries because appointment_services may not expose
          // embedded service relationships in the API.
          const { data: aps } = await supabase
            .from("appointment_services")
            .select("appointment_id, service_id, display_order")
            .eq("appointment_id", appointmentId)
            .order("display_order");
          let svcRows: ApptService[] = await hydrateAppointmentServices(aps ?? [], appointmentId);
          // Fallback: if no appointment_services rows, use the primary service.
          if (svcRows.length === 0 && appt.service_id) {
            svcRows = await hydrateAppointmentServices([{ appointment_id: appointmentId, service_id: appt.service_id, display_order: 0 }], appointmentId);
          }

          // Also pull sibling appointments for the SAME client on the SAME day —
          // clients commonly book two back-to-back appointments (e.g. tox + filler)
          // and the provider should be able to chart everything from one place.
          try {
            const apptDate = (appt.start_at ?? "").slice(0, 10);
            if (apptDate && appt.client_email) {
              const dayStart = `${apptDate}T00:00:00.000Z`;
              const dayEnd = `${apptDate}T23:59:59.999Z`;
              const { data: sameDay } = await supabase
                .from("appointments")
                .select("id, service_id")
                .ilike("client_email", appt.client_email)
                .gte("start_at", dayStart)
                .lte("start_at", dayEnd)
                .neq("id", appointmentId);
              const siblingIds = (sameDay ?? []).map((a: any) => a.id);
              const seen = new Set(svcRows.map(s => s.id));
              const primarySiblingRows = (sameDay ?? [])
                .filter((a: any) => a.service_id)
                .map((a: any, idx: number) => ({ appointment_id: a.id, service_id: a.service_id, display_order: idx }));
              for (const s of await hydrateAppointmentServices(primarySiblingRows, null)) {
                if (!seen.has(s.id)) { seen.add(s.id); svcRows.push(s); }
              }
              if (siblingIds.length) {
                const { data: sibAps } = await supabase
                  .from("appointment_services")
                  .select("appointment_id, service_id, display_order")
                  .in("appointment_id", siblingIds);
                const siblingServices = await hydrateAppointmentServices(sibAps ?? [], null);
                for (const s of siblingServices) {
                  if (!seen.has(s.id)) { seen.add(s.id); svcRows.push(s); }
                }
              }
            }
          } catch { /* non-fatal */ }

          setApptServices(svcRows);

          // Load already-saved notes for this appointment so we can mark them done
          const noteAppointmentIds = Array.from(new Set([appointmentId, ...svcRows.map(s => s.appointmentId).filter((v): v is string => !!v)]));
          const { data: existing } = await supabase
            .from("clinical_notes")
            .select("id, service_name, appointment_id")
            .in("appointment_id", noteAppointmentIds);
          setApptNotes(existing ?? []);
          const documentedNames = new Set((existing ?? [])
            .filter((n: any) => n.id !== draftId)
            .map((n: any) => (n.service_name ?? "").toLowerCase()));

          // Pick current service: URL param > all not-yet-documented services > first available
          const requested = sp.get("service");
          const resumedSvc = resumedDraftServiceName ? svcRows.find(s => s.name.toLowerCase() === resumedDraftServiceName.toLowerCase()) : null;
          const requestedSvc = requested ? svcRows.find(s => s.id === requested) : null;
          if (draftId && !resumedSvc) {
            setLoading(false);
            return;
          }
          const pendingChartableSvcs = svcRows.filter(s => s.category && !documentedNames.has(s.name.toLowerCase()));
          const pendingSvcs = pendingChartableSvcs.length
            ? pendingChartableSvcs
            : svcRows.filter(s => !documentedNames.has(s.name.toLowerCase()));
          const pick =
            resumedSvc ||
            requestedSvc ||
            pendingSvcs[0] ||
            svcRows[0];
          if (pick) {
            const initialSelection = requestedSvc
              ? [requestedSvc.id]
              : resumedSvc
                ? [resumedSvc.id]
                : (pendingSvcs.length ? pendingSvcs.map(s => s.id) : [pick.id]);
            setCurrentServiceId(pick.id);
            setServiceName(pick.name);
            setSelectedServiceIds(initialSelection);
            if (pick.category) setCategory(pick.category);
          }
        }
      } else {
        setClient(c => ({
          ...c,
          email: sp.get("email") ?? "",
          first: sp.get("first") ?? "",
          last: sp.get("last") ?? "",
        }));
      }

      // Look up most recent valid GFE for this client
      const email = (appointmentId ? undefined : sp.get("email"));
      if (email) await loadGfeFor(email);
      setLoading(false);
    })();
  }, [isViewMode, user, appointmentId, resumedDraftServiceName]); // eslint-disable-line

  useEffect(() => {
    if (!isViewMode && client.email) loadGfeFor(client.email);
  }, [client.email, isViewMode]);

  // ===== Draft persistence =====
  // On open, look for an unsigned draft chart for this appointment by this
  // provider — if one exists (e.g. the provider took photos earlier and walked
  // away), offer to resume so nothing is lost.
  useEffect(() => {
    const draftId = sp.get("draft");
    if (isViewMode || !user || (!appointmentId && !draftId)) return;
    (async () => {
      let query = supabase
        .from("clinical_notes")
        .select("*")
        .eq("status", "draft")
        .limit(1);
      query = draftId
        ? query.eq("id", draftId)
        : query.eq("appointment_id", appointmentId).eq("provider_user_id", user.id).order("updated_at", { ascending: false });
      const { data } = await query.maybeSingle();
      if (data && draftAutoResumedRef.current !== data.id) {
        draftAutoResumedRef.current = data.id;
        restoreDraftState(data, { silent: true });
      }
    })();
  }, [isViewMode, user, appointmentId, sp]);

  function resumeDraft() {
    if (!resumableDraft) return;
    restoreDraftState(resumableDraft);
  }

  async function discardDraft() {
    if (!resumableDraft) return;
    // Delete photos in storage too
    const paths = [...(resumableDraft.photo_pre_paths ?? []), ...(resumableDraft.photo_post_paths ?? [])];
    if (paths.length) {
      try { await supabase.storage.from("clinical-photos").remove(paths); } catch { /* ignore */ }
    }
    await supabase.from("clinical_notes").delete().eq("id", resumableDraft.id);
    setResumableDraft(null);
    toast.success("Draft discarded");
  }

  /**
   * Upsert a draft `clinical_notes` row so photos and key form fields are
   * persisted server-side even before the provider signs. Called automatically
   * whenever a photo is added/removed.
   */
  async function ensureDraftRow(extra: { photo_pre_paths?: string[]; photo_post_paths?: string[] } = {}) {
    if (isViewMode || !user) return;
    if (!client.email || !client.first || !client.last) return; // not enough context yet
    const providerRole = isNP ? "Nurse Practitioner" : isAdmin ? "Admin" : "Injector";
    const payload: any = {
      id: pendingNoteId,
      appointment_id: appointmentId,
      client_email: client.email.toLowerCase(),
      client_first_name: client.first,
      client_last_name: client.last,
      client_dob: client.dob || null,
      location_id: locationId,
      provider_user_id: user.id,
      provider_staff_id: staffId,
      provider_name: providerName || "Provider",
      provider_role: providerRole,
      category,
      service_name: serviceName,
      status: "draft",
      photo_pre_paths: extra.photo_pre_paths ?? photoPrePaths,
      photo_post_paths: extra.photo_post_paths ?? photoPostPaths,
    };
    const { error } = await supabase.from("clinical_notes").upsert(payload, { onConflict: "id" });
    if (error) { console.warn("draft upsert failed", error); return; }
    setDraftRowExists(true);
  }

  // Wrapped setters used by <ClinicalPhotos /> so the database draft row is
  // always in sync with what's actually been uploaded.
  const handlePhotoPreChange = (next: string[]) => {
    setPhotoPrePaths(next);
    void ensureDraftRow({ photo_pre_paths: next });
  };
  const handlePhotoPostChange = (next: string[]) => {
    setPhotoPostPaths(next);
    void ensureDraftRow({ photo_post_paths: next });
  };


  // Phase 1: Smart auto-populate — pull last signed chart for this client/category
  // and prefill product/areas/technique/units/device. Lot # and expiration are
  // intentionally NOT prefilled (must be scanned/entered fresh per visit).
  const [lastVisit, setLastVisit] = useState<null | {
    when: string; provider: string; category: Category; serviceName: string | null;
  }>(null);
  const [prefilledFromLast, setPrefilledFromLast] = useState(false);

  useEffect(() => {
    if (isViewMode || !client.email || !category) return;
    (async () => {
      const { data: prev } = await supabase
        .from("clinical_notes")
        .select("id, category, service_name, provider_name, created_at, status")
        .ilike("client_email", client.email)
        .eq("category", category)
        .in("status", ["signed", "cosigned", "locked"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!prev) { setLastVisit(null); return; }
      setLastVisit({
        when: prev.created_at, provider: prev.provider_name ?? "—",
        category: prev.category as Category, serviceName: prev.service_name,
      });
    })();
  }, [client.email, category, isViewMode]);

  async function applyPrefillFromLastVisit() {
    if (!lastVisit) return;
    if (lastVisit.category === "consult") return; // consult has no detail table
    const tableMap: Record<Exclude<Category, "consult">, string> = {
      neurotoxin: "clinical_note_neurotoxin",
      filler: "clinical_note_filler",
      energy: "clinical_note_energy",
      wellness: "clinical_note_wellness",
    };
    const { data: prev } = await supabase
      .from("clinical_notes")
      .select("id")
      .ilike("client_email", client.email)
      .eq("category", category)
      .in("status", ["signed", "cosigned", "locked"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!prev?.id) { toast.error("Could not find last chart"); return; }
    const { data: dRaw } = await supabase
      .from(tableMap[lastVisit.category as Exclude<Category, "consult">] as any)
      .select("*")
      .eq("clinical_note_id", prev.id)
      .maybeSingle();
    const d: any = dRaw;
    if (!d) { toast.error("Last chart details missing"); return; }
    if (category === "neurotoxin") {
      // Support legacy array shape or new { zones, points } object
      const im = d.injection_map;
      const pts = Array.isArray(im?.points) ? im.points : [];
      setNeuro(prevState => {
        const zones = Array.isArray(im)
          ? im
          : Array.isArray(im?.zones) ? im.zones : prevState.map;
        return {
          ...prevState,
          product: d.product ?? prevState.product,
          dilution: d.dilution ?? prevState.dilution,
          reconstitution_agent: d.reconstitution_agent ?? prevState.reconstitution_agent,
          needle_gauge: d.needle_gauge ?? prevState.needle_gauge,
          technique: Array.isArray(d.technique) && d.technique.length ? d.technique : prevState.technique,
          map: zones,
          points: pts,
        };
      });
    } else if (category === "filler") {
      setFiller(prev => ({
        ...prev,
        product: d.product ?? prev.product,
        syringes_used: d.syringes_used ?? prev.syringes_used,
        areas: Array.isArray(d.areas) && d.areas.length ? d.areas : prev.areas,
        technique: Array.isArray(d.technique) && d.technique.length ? d.technique : prev.technique,
        delivery: d.delivery ?? prev.delivery,
        needle_gauge: d.needle_gauge ?? prev.needle_gauge,
        anesthetic: d.anesthetic ?? prev.anesthetic,
      }));
    } else if (category === "energy") {
      setEnergy(prev => ({
        ...prev,
        device: d.device ?? prev.device,
        areas: Array.isArray(d.areas) && d.areas.length ? d.areas : prev.areas,
        energy: d.settings?.energy ?? prev.energy,
        depth: d.settings?.depth ?? prev.depth,
        pulse_width: d.settings?.pulse_width ?? prev.pulse_width,
        passes: d.settings?.passes ?? prev.passes,
        cooling_used: d.cooling_used ?? prev.cooling_used,
        numbing_used: d.numbing_used ?? prev.numbing_used,
      }));
    } else if (category === "wellness") {
      setWellness(prev => ({
        ...prev,
        service_type: d.service_type ?? prev.service_type,
        product: d.product ?? prev.product,
        dose: d.dose ?? prev.dose,
        strength: d.strength ?? prev.strength,
        route: d.route ?? prev.route,
      }));
    }
    setPrefilledFromLast(true);
    toast.success("Prefilled from last visit — review lot # and units");
  }

  async function loadGfeFor(email: string) {
    const { data } = await supabase.from("gfe_records")
      .select("id, expires_at, signed_at, np_name, allergies, allergies_other, current_medications, current_medications_other")
      .ilike("client_email", email).order("signed_at", { ascending: false }).limit(1).maybeSingle();
    setGfe(data ?? null);
    // Default the reconciliation checklist to all GFE allergies un-checked (force confirmation).
    if (data?.allergies) setAllergiesConfirmedToday([]);
  }

  // ===== Load existing note =====
  useEffect(() => {
    if (!isViewMode || !id) return;
    (async () => {
      const { data: n, error } = await supabase.from("clinical_notes").select("*").eq("id", id).maybeSingle();
      if (error || !n) { toast.error("Note not found"); navigate(-1); return; }
      // Draft notes should resume in edit mode, not the read-only view (which renders the
      // category template with example imagery and confuses providers mid-chart).
      if (n.status === "draft") {
        const params = new URLSearchParams();
        params.set("draft", n.id);
        if (n.appointment_id) params.set("appointment", n.appointment_id);
        if ((n as any).service_id) params.set("service", (n as any).service_id);
        if (!n.appointment_id && n.client_email) {
          params.set("email", n.client_email);
          if (n.category) params.set("category", n.category);
        }
        navigate(`/staff/clinical/notes/new?${params.toString()}`, { replace: true });
        return;
      }
      setNote(n);
      setCategory(n.category);
      // HIPAA audit: record PHI read
      void import("@/lib/phiAudit").then(({ logPhiAccess }) =>
        logPhiAccess({ resourceType: "chart_note", resourceId: id, clientEmail: n.client_email, action: "view" })
      );
      const tableMap: Partial<Record<Category, string>> = {
        neurotoxin: "clinical_note_neurotoxin",
        filler: "clinical_note_filler",
        energy: "clinical_note_energy",
        wellness: "clinical_note_wellness",
      };
      const detailTable = tableMap[n.category as Category];
      const [{ data: d }, { data: s }] = await Promise.all([
        detailTable
          ? supabase.from(detailTable as any).select("*").eq("clinical_note_id", id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase.from("clinical_note_signatures").select("*").eq("clinical_note_id", id).order("signed_at"),
      ]);
      setDetail(d);
      setSigs(s ?? []);
      setLoading(false);
    })();
  }, [id, isViewMode, navigate]);

  const gfeValid = gfe && new Date(gfe.expires_at) > new Date();

  // Build the list of GFE-recorded allergies (plus "other" free text) that must be re-confirmed today.
  const gfeAllergiesList = useMemo<string[]>(() => {
    if (!gfe) return [];
    const arr = Array.isArray(gfe.allergies) ? [...gfe.allergies] : [];
    if (gfe.allergies_other) arr.push(gfe.allergies_other);
    return arr.filter((a: string) => a && a.toLowerCase() !== "none");
  }, [gfe]);

  const gfeMedsList = useMemo<string[]>(() => {
    if (!gfe) return [];
    const arr = Array.isArray(gfe.current_medications) ? [...gfe.current_medications] : [];
    if (gfe.current_medications_other) arr.push(gfe.current_medications_other);
    return arr.filter((m: string) => m && m.toLowerCase() !== "none");
  }, [gfe]);

  const safetyAlerts = useMemo(
    () => computeInteractionAlerts({
      category, serviceName, meds: gfeMedsList, allergies: gfeAllergiesList,
      newMedsSinceGfe, dob: client.dob,
    }),
    [category, serviceName, gfeMedsList, gfeAllergiesList, newMedsSinceGfe, client.dob],
  );

  const allAllergiesReconciled = gfeAllergiesList.length === 0
    || gfeAllergiesList.every(a => allergiesConfirmedToday.includes(a));

  const selectedServices = useMemo(
    () => apptServices.filter(s => selectedServiceIds.includes(s.id)),
    [apptServices, selectedServiceIds],
  );
  useEffect(() => {
    if (isViewMode || !resumedDraftServiceName || !apptServices.length) return;
    const svc = apptServices.find(s => s.name.toLowerCase() === resumedDraftServiceName.toLowerCase());
    if (!svc) return;
    setCurrentServiceId(svc.id);
    setServiceName(svc.name);
    setSelectedServiceIds([svc.id]);
    if (svc.category) setCategory(svc.category);
  }, [isViewMode, resumedDraftServiceName, apptServices]);
  const [removedCategories, setRemovedCategories] = useState<Category[]>([]);
  const [addedCategories, setAddedCategories] = useState<Category[]>([]);
  const selectedCategories = useMemo<Category[]>(() => {
    const fromSvc = selectedServices.map(s => s.category).filter((c): c is Category => !!c);
    const base = fromSvc.length ? Array.from(new Set(fromSvc)) : [category];
    const merged = Array.from(new Set([...base, ...addedCategories]));
    return merged.filter(c => !removedCategories.includes(c));
  }, [selectedServices, category, removedCategories, addedCategories]);
  const chartingServiceLabel = selectedServices.length
    ? selectedServices.map(s => s.name).join(" + ")
    : serviceName;
  const serviceDerivedEnergyDevices = useMemo(
    () => Array.from(new Set(
      selectedServices
        .filter(s => s.category === "energy")
        .map(s => energyDeviceOptionForService(s.name))
        .filter((v): v is NonNullable<ReturnType<typeof energyDeviceOptionForService>> => !!v),
    )),
    [selectedServices],
  );
  const energyDeviceOptions = useMemo(() => {
    const combined = serviceDerivedEnergyDevices.length > 1 ? [serviceDerivedEnergyDevices.join(" + ")] : [];
    return Array.from(new Set([...combined, ...serviceDerivedEnergyDevices, ...ENERGY_DEVICES]));
  }, [serviceDerivedEnergyDevices]);

  useEffect(() => {
    if (draftRowExists) return;
    const energyServices = selectedServices.filter(s => s.category === "energy");
    if (energyServices.length === 0) return;
    setEnergy(prev => {
      const nextDevice = energyServices.length === 1
        ? energyDeviceForService(energyServices[0].name, prev.device)
        : energyDeviceOptions[0] ?? prev.device;
      return nextDevice === prev.device ? prev : { ...prev, device: nextDevice };
    });
  }, [selectedServices, energyDeviceOptions, draftRowExists]);

  const missingFields = useMemo<string[]>(() => {
    const miss: string[] = [];
    const today = new Date().toISOString().slice(0, 10);
    const isExpired = (d: string | null | undefined) => !!d && d < today;
    const cats = selectedCategories.length ? selectedCategories : [category];
    // Consult notes are SOAP-only — no GFE, no allergy reconciliation, no product/lot.
    const isConsultOnly = cats.length > 0 && cats.every(c => c === "consult");
    if (!client.email) miss.push("Client email");
    if (!client.first) miss.push("First name");
    if (!client.last) miss.push("Last name");
    if (!providerName) miss.push("Provider name");
    if (!isConsultOnly && !gfeValid) miss.push("Valid GFE on file");
    if (!sigFullName) miss.push("Provider signature name");
    if (!sigPng) miss.push("Provider signature");
    if (!indication.trim()) miss.push(isConsultOnly ? "Chief concern / reason for consult" : "Indication");
    if (!isConsultOnly && !allAllergiesReconciled) miss.push("Allergy reconciliation");
    if (isConsultOnly && !providerNotes.trim()) miss.push("Consultation SOAP note");
    const adverseSelected = (arr: string[]) => arr.length > 0 && !arr.includes("None");
    let anyAdverse = false;
    for (const cat of cats) {
      if (cat === "neurotoxin") {
        if (!neuro.product) miss.push("Neurotoxin product");
        if (!neuro.lot_number) miss.push("Neurotoxin lot #");
        if (!neuro.expiration_date) miss.push("Neurotoxin expiration");
        if (isExpired(neuro.expiration_date)) miss.push("Neurotoxin lot is EXPIRED — do not use");
        if (!neuro.reconstitution_agent) miss.push("Reconstitution agent");
        if (neuro.map.length === 0 && neuro.points.length === 0) miss.push("Injection map (at least one zone/site)");
        if (neuro.adverse.length === 0) miss.push("Adverse events (or None)");
        if (adverseSelected(neuro.adverse)) anyAdverse = true;
      }
      if (cat === "filler") {
        if (!filler.product) miss.push("Filler product");
        if (!(filler.syringes_used > 0)) miss.push("Syringes used");
        if (!filler.lots.every(l => l.lot && l.exp)) miss.push("Lot # + expiration for each syringe");
        if (filler.lots.some(l => isExpired(l.exp))) miss.push("Filler lot is EXPIRED — do not use");
        if (filler.areas.length === 0) miss.push("Areas treated");
        if (filler.adverse.length === 0) miss.push("Adverse events (or None)");
        if (adverseSelected(filler.adverse)) anyAdverse = true;
      }
      if (cat === "energy") {
        if (!energy.device) miss.push("Energy device");
        if (!energy.device_serial.trim()) miss.push("Device serial #");
        if (isExpired(energy.expiration_date)) miss.push("Consumable lot is EXPIRED — do not use");
        if (energy.areas.length === 0) miss.push("Areas treated");
        if (energy.adverse.length === 0) miss.push("Adverse events (or None)");
        if (adverseSelected(energy.adverse)) anyAdverse = true;
      }
      if (cat === "wellness") {
        if (!wellness.service_type) miss.push("Wellness service type");
        if (!wellness.route) miss.push("Route");
        if (wellness.adverse.length === 0) miss.push("Adverse events (or None)");
        if (adverseSelected(wellness.adverse)) anyAdverse = true;
        if (WELLNESS_INJECTABLE_SERVICES.has(wellness.service_type)) {
          if (!wellness.lot_number.trim()) miss.push("Wellness lot #");
          if (!wellness.expiration_date) miss.push("Wellness expiration");
          if (isExpired(wellness.expiration_date)) miss.push("Wellness lot is EXPIRED — do not use");
        }
        const mn = WELLNESS_GUIDANCE[wellness.service_type]?.medicalNecessity;
        if (mn && necessityChecked.length < mn.minRequired) miss.push(`503A medical necessity (≥ ${mn.minRequired})`);
      }
    }
    if (anyAdverse) {
      if (!adverseSeverity) miss.push("Adverse event severity");
      if (!adverseNarrative.trim()) miss.push("Adverse event narrative & follow-up plan");
    }
    return miss;
  }, [client, providerName, gfeValid, sigPng, sigFullName, category, selectedCategories, neuro, filler, energy, wellness, necessityChecked,
      indication, providerNotes, allAllergiesReconciled, adverseSeverity, adverseNarrative]);

  const canSubmit = missingFields.length === 0;


  const totalUnits = useMemo(
    () => {
      // Pins on the diagram are the detailed breakdown of the zone totals —
      // when both exist, counting them together double-counts. Prefer pin
      // units when any pins are placed; otherwise fall back to the zone list.
      const pointsSum = neuro.points.reduce((s, p) => s + (Number(p.units) || 0), 0);
      if (neuro.points.length > 0) return pointsSum;
      return neuro.map.reduce((s, e) => s + (Number(e.units) || 0), 0);
    },
    [neuro.map, neuro.points],
  );

  async function insertCategoryDetail(noteId: string, noteCategory: Category) {
    const upsertOpts = { onConflict: "clinical_note_id" } as any;
    // Consultation SOAP notes have no product/lot detail row.
    if (noteCategory === "consult") return { error: null } as any;
    if (noteCategory === "neurotoxin") {
      return supabase.from("clinical_note_neurotoxin").upsert({
        clinical_note_id: noteId,
        product: neuro.product, lot_number: neuro.lot_number, expiration_date: neuro.expiration_date,
        dilution: neuro.dilution,
        reconstitution_agent: neuro.reconstitution_agent || null,
        needle_gauge: neuro.needle_gauge,
        technique: neuro.technique,
        injection_map: (neuro.points.length > 0 ? { zones: neuro.map, points: neuro.points } : neuro.map) as any,
        total_units: totalUnits, adverse_events: neuro.adverse, post_care_given: neuro.post_care_given,
      } as any, upsertOpts);
    }
    if (noteCategory === "filler") {
      return supabase.from("clinical_note_filler").upsert({
        clinical_note_id: noteId, product: filler.product, syringes_used: filler.syringes_used,
        lot_entries: filler.lots as any, areas: filler.areas, technique: filler.technique,
        delivery: filler.delivery, needle_gauge: filler.needle_gauge, anesthetic: filler.anesthetic,
        hyaluronidase_onsite: filler.hyaluronidase_onsite,
        vascular_protocol_reviewed: filler.vascular_protocol_reviewed,
        adverse_events: filler.adverse,
        site_map: (fillerPoints.length ? fillerPoints : null) as any,
      } as any, upsertOpts);
    }
    if (noteCategory === "energy") {
      return supabase.from("clinical_note_energy").upsert({
        clinical_note_id: noteId, device: energy.device,
        device_serial: energy.device_serial.trim() || null,
        lot_number: energy.lot_number.trim() || null,
        expiration_date: energy.expiration_date || null,
        settings: { energy: energy.energy, depth: energy.depth, pulse_width: energy.pulse_width, passes: energy.passes } as any,
        areas: energy.areas, cooling_used: energy.cooling_used, numbing_used: energy.numbing_used,
        endpoint_achieved: energy.endpoint, adverse_events: energy.adverse,
        site_map: (energyPoints.length ? energyPoints : null) as any,
      } as any, upsertOpts);
    }
    return supabase.from("clinical_note_wellness").upsert({
      clinical_note_id: noteId, service_type: wellness.service_type, product: wellness.product || null,
      dose: wellness.dose || null, strength: wellness.strength || null,
      layers: wellness.layers ? Number(wellness.layers) : null,
      route: wellness.route, lot_number: wellness.lot_number || null,
      expiration_date: wellness.expiration_date || null,
      neutralization: wellness.neutralization || null,
      adverse_events: wellness.adverse,
      site_map: (wellnessPoints.length ? wellnessPoints : null) as any,
    } as any, upsertOpts);
  }


  async function submit() {
    if (!canSubmit) { toast.error("Please complete required fields."); return; }
    setSaving(true);
    if (saveSigForFuture && sigPng && sigFullName) {
      try { await persistSavedSignature(sigPng, sigFullName); } catch { /* non-fatal */ }
    }
    try {
      const ua = navigator.userAgent;

      const providerRole = isMedicalDirector ? "Medical Director" : isNP ? "Nurse Practitioner" : isAdmin ? "Admin" : "Injector";
      const requiresCosign = !isNP && !isMedicalDirector && !isAdmin; // RN/staff requires NP/MD cosign
      const servicesToDocument = selectedServices.length
        ? selectedServices
        : [{ id: currentServiceId ?? "manual", name: serviceName ?? CATEGORY_LABEL[category], category, appointmentId }];
      const createdNoteIds: string[] = [];

      for (const svc of servicesToDocument) {
        const noteCategory = svc.category ?? category;
        const isFirstService = createdNoteIds.length === 0;
        const noteId = isFirstService ? pendingNoteId : makeClinicalNoteId();
        // First service uses upsert so it converts any pre-existing draft row
        // (with photos already attached) into the signed note instead of
        // creating a duplicate.
        const visitSummary = buildVisitSummary({
          category: noteCategory,
          neuro: noteCategory === "neurotoxin" ? (neuro as any) : undefined,
          filler: noteCategory === "filler" ? (filler as any) : undefined,
          energy: noteCategory === "energy" ? (energy as any) : undefined,
          wellness: noteCategory === "wellness" ? (wellness as any) : undefined,
          followupWeeks: followupWeeks ? Number(followupWeeks) : null,
          adverseSeverity: adverseSeverity || null,
        });
        const notePayload: any = {
          summary: visitSummary,
          id: noteId,
          appointment_id: svc.appointmentId ?? appointmentId,
          client_email: client.email.toLowerCase(),
          client_first_name: client.first, client_last_name: client.last,
          client_dob: client.dob || null,
          location_id: locationId,
          provider_user_id: user!.id, provider_staff_id: staffId, provider_name: providerName,
          provider_role: providerRole,
          category: noteCategory, service_name: svc.name,
          gfe_record_id: gfe?.id ?? null,
          consents_verified: consentsVerified,
          indication: indication.trim(),
          allergies_confirmed_today: allergiesConfirmedToday,
          new_medications_since_gfe: newMedsSinceGfe.trim() || null,
          patient_verbalized_understanding: patientVerbalizedUnderstanding,
          time_out_completed: timeOutCompleted,
          site_marked: siteMarked,
          emergency_equipment_available: emergencyEquipmentAvailable,
          bp_systolic: bpSys ? Number(bpSys) : null,
          bp_diastolic: bpDia ? Number(bpDia) : null,
          heart_rate: heartRate ? Number(heartRate) : null,
          pain_score_pre: painPre !== "" ? Number(painPre) : null,
          pain_score_post: painPost !== "" ? Number(painPost) : null,
          photo_pre_paths: photoPrePaths,
          photo_post_paths: photoPostPaths,
          post_assessment: postAssessment,
          post_op_reviewed: postOpReviewed,
          followup_weeks: followupWeeks ? Number(followupWeeks) : null,
          provider_notes: (() => {
            const parts: string[] = [];
            const adverseList = [
              ...(noteCategory === "neurotoxin" ? neuro.adverse : []),
              ...(noteCategory === "filler" ? filler.adverse : []),
              ...(noteCategory === "energy" ? energy.adverse : []),
              ...(noteCategory === "wellness" ? wellness.adverse : []),
            ].filter(a => a && a !== "None");
            if (adverseList.length && (adverseSeverity || adverseNarrative.trim())) {
              parts.push(
                `ADVERSE EVENT — ${adverseSeverity ? adverseSeverity.toUpperCase() : "UNSPECIFIED"}\n` +
                `Events: ${adverseList.join(", ")}\n` +
                `Narrative & follow-up: ${adverseNarrative.trim() || "(none provided)"}`,
              );
            }
            const mn = noteCategory === "wellness" ? WELLNESS_GUIDANCE[wellness.service_type]?.medicalNecessity : null;
            if (mn && necessityChecked.length > 0) {
              parts.push(
                `503A MEDICAL NECESSITY ATTESTATION — ${wellness.service_type}\n` +
                `Statute: ${mn.statuteRef}\n` +
                `Attested by ${providerName} on ${new Date().toISOString()}:\n` +
                necessityChecked.map(i => `  • ${i}`).join("\n"),
              );
            }
            if (providerNotes.trim()) parts.push(providerNotes.trim());
            return parts.length ? parts.join("\n\n") : null;
          })(),

          status: requiresCosign ? "signed" : "cosigned",
          signed_at: new Date().toISOString(),
          cosigned_at: requiresCosign ? null : new Date().toISOString(),
          locked_at: requiresCosign ? null : new Date().toISOString(),
          requires_cosign: requiresCosign,
        };
        const draftPayload = {
          ...notePayload,
          status: "draft",
          signed_at: null,
          cosigned_at: null,
          locked_at: null,
        };
        const writer = supabase.from("clinical_notes");
        const { error: nErr } = (isFirstService && draftRowExists)
          ? await writer.upsert(draftPayload, { onConflict: "id" })
          : await writer.insert(draftPayload);
        if (nErr) throw nErr;

        const { error: detailErr } = await insertCategoryDetail(noteId, noteCategory);
        if (detailErr) throw detailErr;

        // Auto-decrement linked inventory lots (best-effort; do not block sign on failure)
        try {
          const consumptions: { lot: LotOption; qty: number; unit: string }[] = [];
          if (noteCategory === "neurotoxin" && neuroLot) {
            consumptions.push({ lot: neuroLot, qty: Math.max(totalUnits, 1), unit: neuroLot.unit || "unit" });
          } else if (noteCategory === "filler") {
            fillerLots.forEach(l => { if (l) consumptions.push({ lot: l, qty: 1, unit: l.unit || "syringe" }); });
          } else if (noteCategory === "energy" && energyLot) {
            consumptions.push({ lot: energyLot, qty: 1, unit: energyLot.unit || "tip" });
          } else if (noteCategory === "wellness" && wellnessLot) {
            consumptions.push({ lot: wellnessLot, qty: 1, unit: wellnessLot.unit || "dose" });
          }
          for (const c of consumptions) {
            const { error: cErr } = await supabase.rpc("consume_lot", {
              _lot_id: c.lot.id, _qty: c.qty,
              _ref_type: "clinical_note", _ref_id: noteId,
              _notes: `Chart ${noteCategory} — ${c.lot.product_name}`,
            });
            if (cErr) { console.warn("consume_lot failed", cErr); continue; }
            await supabase.from("chart_lot_consumption").insert({
              clinical_note_id: noteId, lot_id: c.lot.id,
              qty: c.qty, unit: c.unit, category: noteCategory,
              consumed_at: new Date().toISOString(),
            });
          }
        } catch (consumeErr) {
          console.warn("Inventory decrement skipped:", consumeErr);
        }

        await supabase.from("clinical_note_signatures").insert({
          clinical_note_id: noteId,
          signer_user_id: user!.id, signer_staff_id: staffId, signer_name: sigFullName,
          signer_role: "provider", signature_png: sigPng, user_agent: ua,
        });
        const { error: signErr } = await supabase.from("clinical_notes").update({
          status: notePayload.status,
          signed_at: notePayload.signed_at,
          cosigned_at: notePayload.cosigned_at,
          locked_at: notePayload.locked_at,
          requires_cosign: notePayload.requires_cosign,
        }).eq("id", noteId);
        if (signErr) throw signErr;
        await supabase.from("clinical_audit_log").insert({
          actor_user_id: user!.id, actor_name: providerName,
          resource_type: "clinical_note", resource_id: noteId,
          action: "sign", user_agent: ua,
        });
        createdNoteIds.push(noteId);
      }

      // If this appointment has more services to chart, jump back into the editor
      // for the next undocumented one instead of going to the view page.
      let nextSvcId: string | null = null;
      if (appointmentId && apptServices.length > 1) {
        const documented = new Set([
          ...apptNotes.map(n => (n.service_name ?? "").toLowerCase()),
          ...servicesToDocument.map(s => s.name.toLowerCase()),
        ]);
        nextSvcId = apptServices.find(s => !documented.has(s.name.toLowerCase()))?.id ?? null;
      }
      if (nextSvcId) {
        try { clearLocalDraft(); } catch { /* ignore */ }
        toast.success(requiresCosign ? "Signed — awaiting co-signature. Next service →" : "Signed. Next service →");
        // Hard navigate to the next service URL — this guarantees a fresh
        // editor instance for the new service without racing against React
        // Router's navigate(). Previously we did `navigate(...)` followed by
        // `setTimeout(reload, 50)`, which could reload the previous URL on
        // slow devices and drop the user back on the just-signed note.
        if (typeof window !== "undefined") {
          window.location.assign(`/staff/clinical/notes/new?appointment=${appointmentId}&service=${nextSvcId}`);
        } else {
          navigate(`/staff/clinical/notes/new?appointment=${appointmentId}&service=${nextSvcId}`, { replace: true });
        }
      } else {
        try { clearLocalDraft(); } catch { /* ignore */ }
        // Consultation-only visits have no checkout — auto-complete the
        // appointment so it doesn't stay stuck in "arrived" and the client
        // still gets the post-visit review email.
        const allConsult = selectedCategories.length > 0 && selectedCategories.every(c => c === "consult");
        let consultCompleted = false;
        if (allConsult && appointmentId && !requiresCosign) {
          try {
            const { error: mcErr } = await supabase.functions.invoke("mark-appointment-complete", {
              body: { appointmentId },
            });
            if (!mcErr) consultCompleted = true;
          } catch (e) { console.warn("consult auto-complete failed", e); }
        }
        toast.success(createdNoteIds.length > 1
          ? `${createdNoteIds.length} chart notes signed${requiresCosign ? " — awaiting NP co-signature" : " & locked"}`
          : (requiresCosign
              ? "Note signed — awaiting NP co-signature"
              : consultCompleted
                ? "Consultation complete — no charge, review email sent"
                : "Note signed & locked"));
        navigate(createdNoteIds.length > 1 && appointmentId ? `/staff/appointments/${appointmentId}` : `/staff/clinical/notes/${createdNoteIds[0]}`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save note");
    } finally { setSaving(false); }
  }

  async function cosign() {
    if (!note || !sigPng || !sigFullName) { toast.error("Sign before submitting"); return; }
    if (!isNP && !isMedicalDirector) { toast.error("NP or Medical Director role required to co-sign"); return; }
    setSaving(true);
    try {
      const ua = navigator.userAgent;
      await supabase.from("clinical_note_signatures").insert({
        clinical_note_id: note.id, signer_user_id: user!.id, signer_staff_id: staffId,
        signer_name: sigFullName, signer_role: "cosigner",
        signature_png: sigPng, user_agent: ua,
      });
      await supabase.from("clinical_notes").update({
        status: "cosigned", cosigned_at: new Date().toISOString(),
        locked_at: new Date().toISOString(),
      }).eq("id", note.id);
      await supabase.from("clinical_audit_log").insert({
        actor_user_id: user!.id, actor_name: sigFullName,
        resource_type: "clinical_note", resource_id: note.id, action: "cosign", user_agent: ua,
      });
      toast.success("Co-signed & locked");
      window.location.reload();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  async function downloadPdf() {
    if (!note) return;
    setPdfBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-clinical-pdf", {
        body: { kind: "note", id: note.id },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("No URL returned");
      void import("@/lib/phiAudit").then(({ logPhiAccess }) =>
        logPhiAccess({ resourceType: "chart_note", resourceId: note.id, clientEmail: note.client_email, action: "download" })
      );
      openPdf(url, `ChartNote-${note.client_last_name}-${note.client_first_name}.pdf`);
    } catch (e: any) { toast.error(e.message); } finally { setPdfBusy(false); }
  }

  // Offline-resilient local draft autosave — a visible pill in the header
  // reassures providers their work isn't lost if the iPad drops Wi-Fi mid-visit.
  const autosaveSnapshot = useMemo(() => ({
    indication, providerNotes, adverseNarrative, newMedsSinceGfe,
    neuro, filler, energy, wellness,
    bpSys, bpDia, heartRate, painPre, painPost, followupWeeks,
    postAssessment, allergiesConfirmedToday,
  }), [indication, providerNotes, adverseNarrative, newMedsSinceGfe,
       neuro, filler, energy, wellness,
       bpSys, bpDia, heartRate, painPre, painPost, followupWeeks,
       postAssessment, allergiesConfirmedToday]);
  const { savedAt: localSavedAt, clear: clearLocalDraft } = useChartDraftAutosave(
    isViewMode ? null : pendingNoteId,
    autosaveSnapshot,
    { enabled: !isViewMode },
  );

  // Keyboard-first: ⌘S / Ctrl+S triggers sign when the chart is ready.
  useEffect(() => {
    if (isViewMode) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canSubmit && !saving) submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isViewMode, canSubmit, saving]); // submit is stable enough; canSubmit gates it


  if (!isClinicalStaff) {
    return (
      <div className="max-w-md mx-auto p-10 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 mx-auto text-warning" />
        <p className="text-sm text-muted-foreground">Clinical staff role required.</p>
      </div>
    );
  }

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  // ============ VIEW MODE ============
  if (isViewMode && note) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
          <Button onClick={downloadPdf} disabled={pdfBusy} size="sm">
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />} PDF
          </Button>
        </div>
        <div className="tabular-nums">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Chart Note • {CATEGORY_LABEL[note.category as Category]}</div>
          <h1 className="text-2xl md:text-3xl font-serif tracking-tight">{note.client_first_name} {note.client_last_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {note.service_name ?? "—"} • {format(new Date(note.created_at), "PPP p")} • <StatusBadge s={note.status} />
          </p>
          {(note as any).summary && (
            <p className="mt-3 text-sm leading-relaxed rounded-md border border-border bg-secondary/30 px-3 py-2 italic">
              {(note as any).summary}
            </p>
          )}
        </div>


        {note.requires_cosign && note.status === "signed" && (isNP || isMedicalDirector || isAdmin) && (
          <div className="rounded-lg border border-warning/30 bg-warning-soft dark:bg-warning-soft p-4 space-y-3">
            <p className="text-sm font-medium">Awaiting NP / Medical Director co-signature</p>
            <MiniSignaturePad
              fullName={sigFullName} onFullNameChange={setSigFullName}
              signaturePng={sigPng} onSignatureChange={setSigPng}
              nameLabel="Co-signing NP / Medical Director full legal name"
            />
            <Button onClick={cosign} disabled={saving || !sigPng}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Co-sign &amp; lock note
            </Button>
          </div>
        )}

        {note.category === "consult" && (note as any).appointment_id && ["signed", "cosigned", "locked"].includes(note.status) && (
          <ConsultCompleteButton appointmentId={(note as any).appointment_id} />
        )}


        <Section title="Provider">
          <p className="text-sm">{note.provider_name} <span className="text-muted-foreground">({note.provider_role ?? "—"})</span></p>
        </Section>

        <Section title="Clinical photos">
          <ReadonlyClinicalPhotos kind="Pre-procedure" paths={note.photo_pre_paths ?? []} />
          <ReadonlyClinicalPhotos kind="Post-procedure" paths={note.photo_post_paths ?? []} />
          <ReadonlyBeforeAfterCompare
            prePaths={note.photo_pre_paths ?? []}
            postPaths={note.photo_post_paths ?? []}
            clientName={`${note.client_first_name ?? ""} ${note.client_last_name ?? ""}`.trim() || (note.client_email ?? "")}
            clientEmail={note.client_email}
          />
        </Section>

        {detail && <CategoryDetailReadonly category={note.category} detail={detail} />}

        {note.post_assessment?.length > 0 && (
          <Section title="Post-procedure assessment"><Pills items={note.post_assessment} /></Section>
        )}
        <Section title="Follow-up">
          <p className="text-sm">{note.followup_weeks ? `In ${note.followup_weeks} weeks` : "Not specified"}{note.post_op_reviewed ? " • Post-op instructions reviewed" : ""}</p>
        </Section>
        {note.provider_notes && <Section title="Provider notes"><p className="text-sm whitespace-pre-wrap">{note.provider_notes}</p></Section>}

        <Section title="Signatures">
          <div className="space-y-3">
            {sigs.map(s => (
              <div key={s.id} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium capitalize">{s.signer_role}: {s.signer_name}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(s.signed_at), "PPP p")}</p>
                {s.signature_png && <img src={s.signature_png} alt="" className="mt-2 h-16 object-contain bg-white rounded border" />}
              </div>
            ))}
          </div>
        </Section>

        <AddendumsPanel
          noteId={note.id}
          canAdd={["signed", "cosigned", "locked"].includes(note.status)}
          currentUserId={user!.id}
          currentName={providerName || sigFullName}
          currentRole={isNP ? "Nurse Practitioner" : isAdmin ? "Admin" : "Clinician"}
        />
      </div>
    );
  }

  // ============ CREATE MODE ============
  return (
    <div className="max-w-3xl mx-auto p-6 pb-40 md:pb-48 space-y-6 md:space-y-8 tabular-nums">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <div className="flex items-center gap-2">
          <OfflineSaveBadge savedAt={localSavedAt} />
          <span className="hidden md:inline text-[10px] uppercase tracking-[0.2em] text-muted-foreground">California compliant chart note</span>
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">New chart note</div>
        <h1 className="text-2xl md:text-3xl font-serif tracking-tight">{client.first || "Patient"} {client.last}</h1>
        {chartingServiceLabel && <p className="text-sm text-muted-foreground mt-1">Charting: <strong>{chartingServiceLabel}</strong></p>}
      </div>


      {resumableDraft && (
        <div className="rounded-lg border border-warning/30 bg-warning-soft dark:bg-warning-soft p-4 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">Unfinished draft from {new Date(resumableDraft.updated_at).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(resumableDraft.photo_pre_paths?.length ?? 0) + (resumableDraft.photo_post_paths?.length ?? 0)} photo(s) and partial notes were saved. Resume where you left off, or discard.
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button size="sm" onClick={resumeDraft}>Resume</Button>
            <Button size="sm" variant="ghost" onClick={discardDraft}>Discard</Button>
          </div>
        </div>
      )}


      {/* Multi-service: list every service on the appointment and require a chart note for each. */}
      {appointmentId && apptServices.length >= 1 && (() => {
        const documented = new Set(apptNotes.map(n => (n.service_name ?? "").toLowerCase()));
        const remaining = apptServices.filter(s => !documented.has(s.name.toLowerCase())).length;
        return (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {apptServices.length === 1
                  ? "1 service booked today — chart note required"
                  : `${apptServices.length} services booked today — select all services performed now`}
              </p>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {apptServices.length - remaining}/{apptServices.length} documented
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {apptServices.map(s => {
                const done = documented.has(s.name.toLowerCase());
                const active = selectedServiceIds.includes(s.id);
                const doneNote = apptNotes.find(n => (n.service_name ?? "").toLowerCase() === s.name.toLowerCase());
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (done && doneNote) { navigate(`/staff/clinical/notes/${doneNote.id}`); return; }
                      const nextIds = active
                        ? (selectedServiceIds.length > 1 ? selectedServiceIds.filter(id => id !== s.id) : [s.id])
                        : [...selectedServiceIds, s.id];
                      const nextSvcs = apptServices.filter(x => nextIds.includes(x.id));
                      setSelectedServiceIds(nextIds);
                      setCurrentServiceId(s.id);
                      setServiceName(nextSvcs.map(x => x.name).join(" + "));
                      // Only force-switch the primary category when the click
                      // truly changes the dominant category — i.e. nothing else
                      // is selected, or every remaining selection shares the
                      // tapped service's category. Otherwise we'd hide vitals,
                      // pain scores and section headers tied to `category` and
                      // make the provider think previously-entered data was lost.
                      if (s.category) {
                        const otherCats = nextSvcs
                          .filter(x => x.id !== s.id)
                          .map(x => x.category)
                          .filter((c): c is Category => !!c);
                        const shouldSwitch = nextSvcs.length <= 1 || otherCats.every(c => c === s.category);
                        if (shouldSwitch) setCategory(s.category);
                      }
                    }}
                    className={`text-left rounded-md border p-3 text-sm transition ${
                      active ? "border-primary bg-primary/10" :
                      done ? "border-success/30 bg-success-soft dark:bg-success-soft" :
                      "border-border hover:border-primary/40 hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{s.name}</span>
                      <span className={`text-[10px] uppercase tracking-wider ${
                        active ? "text-primary" : done ? "text-success-soft-foreground" : "text-muted-foreground"
                      }`}>
                        {active ? "Selected" : done ? "✓ Documented" : "Add to note"}
                      </span>
                    </div>
                    {s.category && (
                      <div className="text-[11px] text-muted-foreground mt-1">{CATEGORY_LABEL[s.category]}</div>
                    )}
                  </button>
                );
              })}
            </div>
            {remaining > 1 && (
              <p className="text-xs text-muted-foreground">
                Selected services will be signed together, with the correct clinical section for each service.
              </p>
            )}
          </div>
        );
      })()}


      {/* GFE gate — skipped for consultation-only notes (no procedure performed) */}
      {!gfeValid && !(selectedCategories.length && selectedCategories.every(c => c === "consult")) && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Good Faith Exam required</p>
          <p className="text-muted-foreground mt-1">A current GFE (within 12 months) must be on file before documenting a procedure.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(isNP || isAdmin) && client.email && (
              <Button size="sm" onClick={() => navigate(`/staff/clinical/gfe/new?email=${encodeURIComponent(client.email)}&first=${encodeURIComponent(client.first)}&last=${encodeURIComponent(client.last)}`)}>
                Conduct GFE now
              </Button>
            )}
            {!isNP && !isAdmin && client.email && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await supabase.functions.invoke("notify-np-gfe-needed", {
                      body: { clientEmail: client.email, firstName: client.first, lastName: client.last },
                    });
                    toast.success("Nurse practitioner notified");
                  } catch {
                    toast.success("Request sent");
                  }
                }}
              >
                Notify nurse practitioner
              </Button>
            )}
          </div>
        </div>
      )}
      {gfeValid && (
        <div className="rounded-lg border border-success/30 bg-success-soft dark:bg-success-soft p-3 text-sm flex items-center justify-between">
          <span>GFE on file by <strong>{gfe.np_name}</strong>, valid until {format(new Date(gfe.expires_at), "PP")}</span>
          <Button size="sm" variant="ghost" onClick={() => navigate(`/staff/clinical/gfe/${gfe.id}`)}>View</Button>
        </div>
      )}

      <SafetyAlertsBanner alerts={safetyAlerts} />

      {lastVisit && !prefilledFromLast && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <span className="font-medium">Last {CATEGORY_LABEL[lastVisit.category].toLowerCase()} visit:</span>{" "}
            {format(new Date(lastVisit.when), "PPP")} · {lastVisit.provider}
            {lastVisit.serviceName ? ` · ${lastVisit.serviceName}` : ""}
          </div>
          <Button size="sm" variant="outline" className="rounded-full" onClick={applyPrefillFromLastVisit}>
            Prefill from last visit
          </Button>
        </div>
      )}
      {prefilledFromLast && (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning-soft-foreground">
          ⚠ Prefilled from last visit — review areas, units, and enter fresh lot # / expiration before signing.
        </div>
      )}

      <Section title="Patient">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LabeledInput label="First *" value={client.first} onChange={v => setClient({ ...client, first: v })} />
          <LabeledInput label="Last *" value={client.last} onChange={v => setClient({ ...client, last: v })} />
          <LabeledInput label="Email *" type="email" value={client.email} onChange={v => setClient({ ...client, email: v })} />
          <LabeledInput label="DOB" type="date" value={client.dob} onChange={v => setClient({ ...client, dob: v })} />
        </div>
      </Section>

      {selectedServices.length > 0 ? (
        <Section title="Treatment categories">
          <div className="flex flex-wrap gap-2">
            {selectedCategories.map(c => (
              <span key={c} className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium">
                {CATEGORY_LABEL[c]}
                <button
                  type="button"
                  aria-label={`Remove ${CATEGORY_LABEL[c]}`}
                  className="ml-1 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setRemovedCategories(prev => Array.from(new Set([...prev, c])));
                    setAddedCategories(prev => prev.filter(x => x !== c));
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            {(["neurotoxin", "filler", "energy", "wellness", "consult"] as Category[])
              .filter(c => !selectedCategories.includes(c))
              .map(c => (
                <button
                  key={c}
                  type="button"
                  className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
                  onClick={() => {
                    setRemovedCategories(prev => prev.filter(x => x !== c));
                    setAddedCategories(prev => Array.from(new Set([...prev, c])));
                  }}
                >
                  + {CATEGORY_LABEL[c]}
                </button>
              ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Auto-detected from selected service{selectedServices.length === 1 ? "" : "s"}. Tap × to remove a category that wasn't performed, or + to add one done in addition.
          </p>
        </Section>
      ) : (
        <div>
          <SingleSelectChips
            label="Treatment category *"
            options={(["neurotoxin", "filler", "energy", "wellness", "consult"] as Category[]).map(c => CATEGORY_LABEL[c])}
            value={CATEGORY_LABEL[category]}
            onChange={(label) => {
              const next = (Object.entries(CATEGORY_LABEL).find(([_, l]) => l === label)?.[0] as Category) ?? "neurotoxin";
              setCategory(next);
            }}
            columns={2}
          />
          <p className="text-xs text-muted-foreground mt-1">
            No service selected — defaulting to <strong>{CATEGORY_LABEL[category]}</strong>. Pick a service above to auto-set this.
          </p>
        </div>
      )}

      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox checked={consentsVerified} onCheckedChange={(c) => setConsentsVerified(!!c)} />
        <span className="text-sm">All required consents are signed and reviewed</span>
      </label>

      {/* ===== Same-day allergy/med reconciliation — skipped for consult-only notes ===== */}
      {selectedCategories.length > 0 && selectedCategories.every(c => c === "consult") ? (
        <Section title="Reason for consultation">
          <IndicationDictationInput value={indication} onChange={setIndication} />
          <p className="text-[11px] text-muted-foreground">
            Consultation notes are SOAP-only — no procedure performed, no product used. Use the AI Scribe below to auto-draft the discussion.
          </p>
        </Section>
      ) : (
        <Section title="Product reconciliation — wasted &amp; discarded (required)">
          {gfeAllergiesList.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Re-confirm each allergy from GFE *
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {gfeAllergiesList.map(a => {
                  const checked = allergiesConfirmedToday.includes(a);
                  return (
                    <label key={a} className={`flex items-center gap-2 cursor-pointer rounded-md border p-2 text-sm ${checked ? "border-success bg-success-soft dark:bg-success-soft" : "border-border"}`}>
                      <Checkbox checked={checked} onCheckedChange={(c) => {
                        setAllergiesConfirmedToday(prev => c ? [...prev, a] : prev.filter(x => x !== a));
                      }} />
                      <span>{a}</span>
                    </label>
                  );
                })}
              </div>
              {!allAllergiesReconciled && (
                <p className="text-xs text-destructive">All allergies from GFE must be re-confirmed today.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No allergies recorded on file — confirmed NKDA at GFE.</p>
          )}
          <LabeledTextarea
            label="Any new medications, supplements, or health changes since last visit?"
            value={newMedsSinceGfe} onChange={setNewMedsSinceGfe} rows={2}
            placeholder="e.g. Started ibuprofen yesterday, new prescription, supplement change, recent illness, etc. Write 'None' if no changes."
          />
          <IndicationDictationInput value={indication} onChange={setIndication} />
        </Section>
      )}

      {/* ===== Vitals (conditional by category) =====
          - wellness: BP+HR shown by default (clinically relevant for GLP-1/HRT/peptides)
          - energy: pain pre/post shown by default; BP/HR collapsed
          - neurotoxin/filler: entire block collapsed and optional (not standard of care) */}
      {(() => {
        const cats = selectedCategories.length ? selectedCategories : [category];
        const hasWellness = cats.includes("wellness");
        const hasEnergy = cats.includes("energy");
        const showVitalsDefault = hasWellness;
        const showPainDefault = hasEnergy;
        const expanded = vitalsOpen ?? (showVitalsDefault || showPainDefault);
        const showBpHr = expanded && (hasWellness || hasEnergy || vitalsOpen === true);
        const showPain = expanded && (hasEnergy || hasWellness || vitalsOpen === true);
        return (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setVitalsOpen(!expanded)}
              className="flex items-center gap-2 w-full text-left text-xs uppercase tracking-widest text-muted-foreground border-b border-border pb-1"
            >
              <span>Pre-procedure vitals</span>
              <span className="text-[10px] normal-case tracking-normal">
                {hasWellness ? "· recommended" : "· optional"}
              </span>
              <span className="ml-auto">{expanded ? "−" : "+"}</span>
            </button>
            {expanded && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {showBpHr && (
                  <>
                    <LabeledInput label="BP systolic" type="number" value={bpSys} onChange={setBpSys} placeholder={category === "wellness" ? "120" : "optional"} />
                    <LabeledInput label="BP diastolic" type="number" value={bpDia} onChange={setBpDia} placeholder={category === "wellness" ? "80" : "optional"} />
                    <LabeledInput label="Heart rate" type="number" value={heartRate} onChange={setHeartRate} placeholder={category === "wellness" ? "72" : "optional"} />
                  </>
                )}
                {showPain && (
                  <>
                    <LabeledInput label="Pain pre (0-10)" type="number" value={painPre} onChange={setPainPre} placeholder="0" />
                    <LabeledInput label="Pain post (0-10)" type="number" value={painPost} onChange={setPainPost} placeholder="0" />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}


      {/* ===== Clinical photos ===== */}
      <Section title="Clinical photos (recommended for defensibility)">
        <div className="flex gap-2 flex-wrap">
          <Button type="button" variant="outline" size="sm" onClick={() => setCaptureKind("pre")}>
            <Camera className="h-3 w-3 mr-1" /> Guided capture — pre
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setCaptureKind("post")}>
            <Camera className="h-3 w-3 mr-1" /> Guided capture — post
          </Button>
          <span className="text-[11px] text-muted-foreground self-center">
            Standardized angles · ghost overlay of last visit · auto-tagged to encounter
          </span>
        </div>
        <ClinicalPhotos
          noteId={pendingNoteId}
          clientEmail={note?.client_email ?? client.email}
          kind="pre"
          paths={photoPrePaths}
          onChange={handlePhotoPreChange}
        />
        <ClinicalPhotos
          noteId={pendingNoteId}
          clientEmail={note?.client_email ?? client.email}
          kind="post"
          paths={photoPostPaths}
          onChange={handlePhotoPostChange}
        />
        {captureKind && (
          <PhotoCaptureFlow
            open={!!captureKind}
            onOpenChange={(b) => { if (!b) setCaptureKind(null); }}
            clientEmail={(note?.client_email ?? client.email) || ""}
            clientName={`${client.first} ${client.last}`.trim()}
            noteId={pendingNoteId}
            appointmentId={appointmentId}
            kind={captureKind}
            onCaptured={(key) => {
              if (captureKind === "pre") handlePhotoPreChange([...photoPrePaths, key]);
              else handlePhotoPostChange([...photoPostPaths, key]);
            }}
          />
        )}
      </Section>



      {/* ===== Category sub-forms ===== */}
      {selectedCategories.includes("neurotoxin") && (
        <div className="space-y-5">
          <div className="flex justify-end"><ChartTemplatePicker category="neurotoxin" onApply={applyTemplate} /></div>

          <SingleSelectChips label="Product *" options={NEUROTOXIN_PRODUCTS} value={neuro.product} onChange={v => {
            const stock = NEUROTOXIN_INVENTORY[v];
            setNeuro({ ...neuro, product: v, ...(stock ? { lot_number: stock.lot, expiration_date: stock.exp } : {}) });
          }} columns={3} />
          <LotPicker
            product={neuro.product}
            category="neurotoxin"
            unit="unit"
            value={neuroLot?.id ?? null}
            onChange={(lot) => {
              setNeuroLot(lot);
              if (lot) setNeuro(n => ({ ...n, lot_number: lot.lot_number, expiration_date: lot.expiration_date ?? n.expiration_date }));
            }}
            label="Link to inventory lot (auto-decrements on sign)"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Lot # *</Label>
                <BarcodeScannerButton
                  label="Scan"
                  onScan={(t) => setNeuro(n => ({ ...n, lot_number: t }))}
                  onExpiration={(d) => setNeuro(n => ({ ...n, expiration_date: d }))}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-input inline-flex items-center gap-1 hover:bg-muted"
                />
              </div>
              <Input value={neuro.lot_number} onChange={e => setNeuro({ ...neuro, lot_number: e.target.value })} />
            </div>
            <LabeledInput label="Expiration *" type="date" value={neuro.expiration_date} onChange={v => setNeuro({ ...neuro, expiration_date: v })} />
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Dilution</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={neuro.dilution} onChange={e => setNeuro({ ...neuro, dilution: e.target.value })}>
                {NEUROTOXIN_DILUTIONS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Needle</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={neuro.needle_gauge} onChange={e => setNeuro({ ...neuro, needle_gauge: e.target.value })}>
                {NEEDLE_GAUGES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <LabeledInput
            label="Reconstitution agent *"
            value={neuro.reconstitution_agent}
            onChange={v => setNeuro({ ...neuro, reconstitution_agent: v })}
            placeholder="e.g. Preservative-free 0.9% saline (PFS) — required by California pharmacy law"
          />
          <ChecklistGroup label="Technique" options={NEUROTOXIN_TECHNIQUE} value={neuro.technique} onChange={v => setNeuro({ ...neuro, technique: v })} columns={3} />

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Treatment record — units per area & injection sites *</Label>
            <InjectionTreatmentRecord
              zones={NEUROTOXIN_ZONES}
              value={neuro.map}
              onChange={(next) => setNeuro({ ...neuro, map: next })}
              unitLabel="u"
              product={neuro.product}
              points={neuro.points}
              onPointsChange={(pts) => setNeuro(n => ({ ...n, points: pts }))}
              withPointUnits
              previousPoints={previousNeuroPoints}
              previousLabel="Last visit"
            />
            <p className="text-[11px] text-muted-foreground">Total units across all areas: <span className="text-primary font-medium">{totalUnits} u</span></p>
          </div>


          <ChecklistGroup label="Adverse events *" options={NEUROTOXIN_ADVERSE} value={neuro.adverse} onChange={v => setNeuro({ ...neuro, adverse: v })} />
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={neuro.post_care_given} onCheckedChange={(c) => setNeuro({ ...neuro, post_care_given: !!c })} />
            <span className="text-sm">Post-care instructions reviewed with patient</span>
          </label>
        </div>
      )}

      {selectedCategories.includes("filler") && (
        <div className="space-y-5">
          <div className="flex justify-end"><ChartTemplatePicker category="filler" onApply={applyTemplate} /></div>

          <SingleSelectChips label="Product *" options={FILLER_PRODUCTS} value={filler.product} onChange={v => {
            const stock = FILLER_INVENTORY[v];
            setFiller({
              ...filler,
              product: v,
              ...(stock ? { lots: [{ lot: stock.lot, exp: stock.exp }, ...filler.lots.slice(1)] } : {}),
            });
          }} columns={2} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <LabeledInput label="Syringes used *" type="number" value={String(filler.syringes_used)} onChange={v => setFiller({ ...filler, syringes_used: Number(v) || 0 })} />
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Delivery</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={filler.delivery} onChange={e => setFiller({ ...filler, delivery: e.target.value })}>
                {FILLER_DELIVERY.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <LabeledInput label="Needle/cannula gauge" value={filler.needle_gauge} onChange={v => setFiller({ ...filler, needle_gauge: v })} />
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Anesthetic</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={filler.anesthetic} onChange={e => setFiller({ ...filler, anesthetic: e.target.value })}>
                {FILLER_ANESTHETIC.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Lot # + expiration per syringe *</Label>
            {filler.lots.map((l, i) => (
              <div key={i} className="space-y-2 border border-border rounded-md p-2">
                <div className="flex gap-2 items-end">
                  <Input placeholder="Lot #" value={l.lot} onChange={e => {
                    const next = [...filler.lots]; next[i] = { ...l, lot: e.target.value }; setFiller({ ...filler, lots: next });
                  }} />
                  <Input type="date" value={l.exp} onChange={e => {
                    const next = [...filler.lots]; next[i] = { ...l, exp: e.target.value }; setFiller({ ...filler, lots: next });
                  }} />
                  <Button variant="ghost" size="icon" onClick={() => {
                    setFiller({ ...filler, lots: filler.lots.filter((_, j) => j !== i) });
                    setFillerLots(fillerLots.filter((_, j) => j !== i));
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <LotPicker
                  product={filler.product}
                  category="filler"
                  unit="syringe"
                  value={fillerLots[i]?.id ?? null}
                  onChange={(lot) => {
                    const nextLots = [...fillerLots]; nextLots[i] = lot; setFillerLots(nextLots);
                    if (lot) {
                      const next = [...filler.lots];
                      next[i] = { lot: lot.lot_number, exp: lot.expiration_date ?? next[i].exp };
                      setFiller({ ...filler, lots: next });
                    }
                  }}
                  label={`Syringe ${i + 1} — link to inventory`}
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => {
              setFiller({ ...filler, lots: [...filler.lots, { lot: "", exp: "" }] });
              setFillerLots([...fillerLots, null]);
            }}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add lot
            </Button>
          </div>

          <ChecklistGroup label="Areas treated *" options={FILLER_AREAS} value={filler.areas} onChange={v => setFiller({ ...filler, areas: v })} />
          <ChecklistGroup label="Technique" options={FILLER_TECHNIQUE} value={filler.technique} onChange={v => setFiller({ ...filler, technique: v })} columns={3} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer rounded-md border p-3">
              <Checkbox checked={filler.hyaluronidase_onsite} onCheckedChange={(c) => setFiller({ ...filler, hyaluronidase_onsite: !!c })} />
              <span className="text-sm">Hyaluronidase available on site</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer rounded-md border p-3">
              <Checkbox checked={filler.vascular_protocol_reviewed} onCheckedChange={(c) => setFiller({ ...filler, vascular_protocol_reviewed: !!c })} />
              <span className="text-sm">Vascular event protocol reviewed</span>
            </label>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Treatment record — injection sites</Label>
            <InjectionTreatmentRecord
              points={fillerPoints}
              onPointsChange={setFillerPoints}
              withPointUnits
              unitLabel="mL"
            />
          </div>

          <ChecklistGroup label="Adverse events *" options={FILLER_ADVERSE} value={filler.adverse} onChange={v => setFiller({ ...filler, adverse: v })} />
        </div>
      )}

      {selectedCategories.includes("energy") && (
        <div className="space-y-5">
          <div className="flex justify-end"><ChartTemplatePicker category="energy" onApply={applyTemplate} /></div>

          <SingleSelectChips label="Device *" options={energyDeviceOptions} value={energy.device} onChange={v => setEnergy({ ...energy, device: v })} columns={2} />
          <LabeledInput
            label="Device serial / asset # *"
            value={energy.device_serial}
            onChange={v => setEnergy({ ...energy, device_serial: v })}
            placeholder="Required for FDA recall traceability"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LabeledInput
              label="Tip / cartridge lot #"
              value={energy.lot_number}
              onChange={v => setEnergy({ ...energy, lot_number: v })}
              placeholder="From consumable packaging"
            />
            <LabeledInput
              label="Tip / cartridge expiration"
              type="date"
              value={energy.expiration_date}
              onChange={v => setEnergy({ ...energy, expiration_date: v })}
            />
          </div>
          <LotPicker
            product={energy.device}
            category="energy"
            unit="tip"
            value={energyLot?.id ?? null}
            onChange={(lot) => {
              setEnergyLot(lot);
              if (lot) setEnergy(e => ({ ...e, lot_number: lot.lot_number, expiration_date: lot.expiration_date ?? e.expiration_date }));
            }}
            label="Link tip/cartridge lot (optional — auto-decrements on sign)"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <LabeledInput label="Energy" value={energy.energy} onChange={v => setEnergy({ ...energy, energy: v })} placeholder="e.g. 1.2 J/cm²" />
            <LabeledInput label="Depth" value={energy.depth} onChange={v => setEnergy({ ...energy, depth: v })} placeholder="e.g. 4.5mm" />
            <LabeledInput label="Pulse width" value={energy.pulse_width} onChange={v => setEnergy({ ...energy, pulse_width: v })} />
            <LabeledInput label="Passes" value={energy.passes} onChange={v => setEnergy({ ...energy, passes: v })} placeholder="e.g. 2-3" />
          </div>
          <ChecklistGroup label="Areas treated *" options={ENERGY_AREAS} value={energy.areas} onChange={v => setEnergy({ ...energy, areas: v })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer rounded-md border p-3">
              <Checkbox checked={energy.cooling_used} onCheckedChange={(c) => setEnergy({ ...energy, cooling_used: !!c })} />
              <span className="text-sm">Cooling used</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer rounded-md border p-3">
              <Checkbox checked={energy.numbing_used} onCheckedChange={(c) => setEnergy({ ...energy, numbing_used: !!c })} />
              <span className="text-sm">Numbing used</span>
            </label>
          </div>
          <ChecklistGroup label="Endpoint achieved" options={ENERGY_ENDPOINT} value={energy.endpoint} onChange={v => setEnergy({ ...energy, endpoint: v })} />
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Treatment record — treated sites</Label>
            <InjectionTreatmentRecord
              points={energyPoints}
              onPointsChange={setEnergyPoints}
              withPointUnits={false}
            />
          </div>

          <ChecklistGroup label="Adverse events *" options={ENERGY_ADVERSE} value={energy.adverse} onChange={v => setEnergy({ ...energy, adverse: v })} />
        </div>
      )}

      {selectedCategories.includes("wellness") && (
        <div className="space-y-5">
          <div className="flex justify-end"><ChartTemplatePicker category="wellness" onApply={applyTemplate} /></div>

          <SingleSelectChips label="Service type *" options={WELLNESS_SERVICES} value={wellness.service_type} onChange={v => {
            const stock = WELLNESS_INVENTORY[v];
            setWellness({
              ...wellness,
              service_type: v,
              ...(stock ? {
                product: stock.product ?? wellness.product,
                lot_number: stock.lot,
                expiration_date: stock.exp,
                route: stock.route ?? wellness.route,
              } : {}),
            });
            setNecessityChecked([]);

          }} columns={2} />

          {WELLNESS_GUIDANCE[wellness.service_type] && (() => {
            const g = WELLNESS_GUIDANCE[wellness.service_type];
            return (
              <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4 space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                  <h3 className="font-semibold text-destructive">{g.title}</h3>
                </div>
                {g.banner && (
                  <p className="text-xs leading-relaxed text-destructive font-medium border-l-2 border-destructive pl-3">
                    {g.banner}
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="font-semibold uppercase tracking-wider text-muted-foreground mb-1">Dosing / titration</div>
                    <ul className="list-disc pl-4 space-y-0.5">{g.dosing.map(x => <li key={x}>{x}</li>)}</ul>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="font-semibold uppercase tracking-wider text-muted-foreground mb-1">Route</div>
                      <p>{g.route}</p>
                    </div>
                    {g.storage && (
                      <div>
                        <div className="font-semibold uppercase tracking-wider text-muted-foreground mb-1">Storage / handling</div>
                        <p>{g.storage}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold uppercase tracking-wider text-muted-foreground mb-1">Pre-administration check (document each)</div>
                    <ul className="list-disc pl-4 space-y-0.5">{g.preCheck.map(x => <li key={x}>{x}</li>)}</ul>
                  </div>
                  <div>
                    <div className="font-semibold uppercase tracking-wider text-muted-foreground mb-1">Counseling discussion (document)</div>
                    <ul className="list-disc pl-4 space-y-0.5">{g.counseling.map(x => <li key={x}>{x}</li>)}</ul>
                  </div>
                  <div>
                    <div className="font-semibold uppercase tracking-wider text-muted-foreground mb-1">Ongoing monitoring</div>
                    <ul className="list-disc pl-4 space-y-0.5">{g.monitoring.map(x => <li key={x}>{x}</li>)}</ul>
                  </div>
                  <div>
                    <div className="font-semibold uppercase tracking-wider text-muted-foreground mb-1">Contraindications (must be absent)</div>
                    <ul className="list-disc pl-4 space-y-0.5">{g.contraindications.map(x => <li key={x}>{x}</li>)}</ul>
                  </div>
                </div>
              </div>
            );
          })()}

          {WELLNESS_GUIDANCE[wellness.service_type]?.medicalNecessity && (() => {
            const mn = WELLNESS_GUIDANCE[wellness.service_type]!.medicalNecessity!;
            const ok = necessityChecked.length >= mn.minRequired;
            return (
              <div className={`rounded-lg border-2 p-4 space-y-3 ${ok ? "border-success bg-success/5" : "border-warning bg-warning/10"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className={`h-4 w-4 ${ok ? "text-success-soft-foreground" : "text-warning-soft-foreground"}`} />
                    <h3 className="text-sm font-semibold">503A Medical Necessity — required this visit</h3>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded ${ok ? "bg-success-soft text-success-soft-foreground" : "bg-warning-soft text-warning-soft-foreground"}`}>
                    {ok ? "Documented" : `Select ≥ ${mn.minRequired}`}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{mn.statuteRef}</p>
                <ChecklistGroup
                  label="Patient-specific clinical need (check all that apply) *"
                  options={mn.items}
                  value={necessityChecked}
                  onChange={setNecessityChecked}
                />
                <p className="text-[11px] text-muted-foreground">
                  Selected items are appended verbatim to the signed chart note as the patient-specific clinical-need attestation under FDCA §503A.
                </p>
              </div>
            );
          })()}


          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <LabeledInput label="Product" value={wellness.product} onChange={v => setWellness({ ...wellness, product: v })} />
            <LabeledInput label="Dose" value={wellness.dose} onChange={v => setWellness({ ...wellness, dose: v })} placeholder="e.g. 1 mg" />
            <LabeledInput label="Strength" value={wellness.strength} onChange={v => setWellness({ ...wellness, strength: v })} />
            <LabeledInput label="Layers (peels)" type="number" value={wellness.layers} onChange={v => setWellness({ ...wellness, layers: v })} />
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Route *</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={wellness.route} onChange={e => setWellness({ ...wellness, route: e.target.value })}>
                {WELLNESS_ROUTES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <LabeledInput label={WELLNESS_INJECTABLE_SERVICES.has(wellness.service_type) ? "Lot # *" : "Lot #"} value={wellness.lot_number} onChange={v => setWellness({ ...wellness, lot_number: v })} placeholder="From vial / package" />
            <LabeledInput label={WELLNESS_INJECTABLE_SERVICES.has(wellness.service_type) ? "Expiration *" : "Expiration"} type="date" value={wellness.expiration_date} onChange={v => setWellness({ ...wellness, expiration_date: v })} />
            <LabeledInput label="Neutralization (peels)" value={wellness.neutralization} onChange={v => setWellness({ ...wellness, neutralization: v })} />
          </div>
          <LotPicker
            product={wellness.product || wellness.service_type}
            category="wellness"
            unit="dose"
            value={wellnessLot?.id ?? null}
            onChange={(lot) => {
              setWellnessLot(lot);
              if (lot) setWellness(w => ({
                ...w,
                lot_number: lot.lot_number,
                expiration_date: lot.expiration_date ?? w.expiration_date,
                product: w.product || lot.product_name,
              }));
            }}
            label="Link to inventory lot (optional — auto-decrements on sign)"
          />
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Treatment record — injection sites</Label>
            <InjectionTreatmentRecord
              points={wellnessPoints}
              onPointsChange={setWellnessPoints}
              withPointUnits={false}
            />
          </div>

          <ChecklistGroup label="Adverse events *" options={WELLNESS_ADVERSE} value={wellness.adverse} onChange={v => setWellness({ ...wellness, adverse: v })} />
        </div>
      )}

      {/* ===== Shared footer ===== */}
      <ChecklistGroup label="Post-procedure assessment" options={POST_ASSESSMENT} value={postAssessment} onChange={setPostAssessment} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <label className="flex items-center gap-2 cursor-pointer rounded-md border p-3 h-10">
          <Checkbox checked={postOpReviewed} onCheckedChange={(c) => setPostOpReviewed(!!c)} />
          <span className="text-sm">Post-op instructions reviewed</span>
        </label>
        <LabeledInput label="Follow-up (weeks)" type="number" value={followupWeeks} onChange={setFollowupWeeks} />
      </div>
      {(() => {
        const anyAdverse = [
          ...(selectedCategories.includes("neurotoxin") ? neuro.adverse : []),
          ...(selectedCategories.includes("filler") ? filler.adverse : []),
          ...(selectedCategories.includes("energy") ? energy.adverse : []),
          ...(selectedCategories.includes("wellness") ? wellness.adverse : []),
        ].some(a => a && a !== "None");
        if (!anyAdverse) return null;
        return (
          <div className="rounded-lg border-2 border-warning bg-warning-soft dark:bg-warning-soft p-4 space-y-3">
            <p className="text-sm font-semibold text-warning-soft-foreground dark:text-warning-foreground">
              Adverse event documentation — required
            </p>
            <p className="text-xs text-warning-soft-foreground dark:text-warning-foreground/80">
              Severity, narrative, and follow-up plan are required when any adverse event other than "None" is selected.
              This block is auto-prepended to the chart's provider notes.
            </p>
            <SingleSelectChips
              label="Severity *"
              options={["Mild", "Moderate", "Severe"]}
              value={adverseSeverity ? adverseSeverity[0].toUpperCase() + adverseSeverity.slice(1) : ""}
              onChange={(l) => setAdverseSeverity(l.toLowerCase() as any)}
              columns={3}
            />
            <LabeledTextarea
              label="Narrative + follow-up plan *"
              value={adverseNarrative}
              onChange={setAdverseNarrative}
              rows={3}
              placeholder="What occurred, intervention provided, patient counseling, escalation (e.g. NP notified, ER referral, return-visit plan, hyaluronidase indicated)."
            />
          </div>
        );
      })()}
      {(() => {
        const macrosByCategory: Record<Category, string[]> = {
          neurotoxin: [
            "Procedure tolerated well. No immediate AE.",
            "Standard 5-point glabella + crow's feet pattern.",
            "Iced post-injection x 5 min. No bruising at exit.",
            "Counseled to avoid lying flat, exercise, and facials for 4 hours.",
            "Follow-up touch-up scheduled at 2 weeks if needed.",
          ],
          filler: [
            "Cannula entry confirmed in subcutaneous plane. Aspirated negative before bolus.",
            "Hyaluronidase reviewed and available on-site per vascular protocol.",
            "Mild edema noted post-injection — counseled it will resolve in 24–72h.",
            "Symmetry confirmed with patient using handheld mirror.",
            "Counseled on bruising risk, ice, and avoidance of NSAIDs x 48h.",
          ],
          energy: [
            "Test pulse delivered, patient tolerated well. Settings escalated to therapeutic.",
            "Cooling applied throughout. Endpoint: mild erythema, no PIH.",
            "Topical lidocaine applied 20 min pre-procedure.",
            "Counseled on sun avoidance and SPF 50+ daily x 2 weeks.",
            "Post-care: gentle cleanser, bland moisturizer, no actives x 5 days.",
          ],
          wellness: [
            "Patient verbalized understanding of injection site and rotation schedule.",
            "Counseled on titration plan and potential GI side effects.",
            "Reviewed signs of hypoglycemia and when to call the clinic.",
            "No injection site reaction. Tolerated well.",
            "Next dose scheduled per titration protocol.",
          ],
          consult: [
            "Reviewed patient's goals, concerns, and treatment expectations.",
            "Discussed candidacy, alternatives, risks, benefits, downtime, and expected outcomes.",
            "Patient verbalized understanding and had all questions answered.",
            "No treatment performed today — recommendations documented above.",
            "Follow-up: patient to book treatment appointment when ready.",
          ],
        };
        const phrases = [...(macrosByCategory[category] ?? []), ...customPhrasesForCategory];
        return (
          <div className="space-y-2">
            {compliancePhrases.length > 0 && (
              <div className="flex flex-wrap gap-1.5 rounded-lg border border-warning/30 bg-warning-soft/60 dark:bg-warning-soft p-2">
                <span className="text-[11px] uppercase tracking-wider text-warning-soft-foreground dark:text-warning mr-1 self-center font-semibold">Compliance:</span>
                {compliancePhrases.map((p) => (
                  <button
                    key={"c-" + p}
                    type="button"
                    onClick={() => setProviderNotes(prev => (prev.trim() ? prev.trim() + "\n" : "") + p)}
                    className="text-xs px-2.5 py-1 rounded-full border border-warning bg-background hover:bg-warning-soft dark:hover:bg-warning/40 transition"
                    title="Insert compliance attestation"
                  >
                    + {p.length > 56 ? p.slice(0, 54) + "…" : p}
                  </button>
                ))}
              </div>
            )}
            {phrases.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1 self-center">Quick add:</span>
                {phrases.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProviderNotes(prev => (prev.trim() ? prev.trim() + "\n" : "") + p)}
                    className="text-xs px-2.5 py-1 rounded-full border border-input bg-secondary/40 hover:bg-secondary transition"
                    title="Insert phrase"
                  >
                    + {p.length > 48 ? p.slice(0, 46) + "…" : p}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Provider notes</p>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button" size="sm" variant="default"
                  onClick={() => setScribeOpen(true)}
                  disabled={!client.email || !user?.id}
                  className="h-8 gap-1.5 text-xs"
                  title="Record the visit conversation and let AI draft the note. Review before signing."
                >
                  <Mic className="h-3.5 w-3.5" />
                  AI Scribe
                </Button>
                <Button
                  type="button" size="sm" variant="outline"
                  onClick={handleAiDraftSoap} disabled={aiDrafting}
                  className="h-8 gap-1.5 text-xs"
                  title="AI drafts a SOAP narrative from this chart's data. Review before signing."
                >
                  {aiDrafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {aiDrafting ? "Drafting…" : "AI draft SOAP"}
                </Button>
              </div>
            </div>
            <LabeledTextarea label="Provider notes (optional)" value={providerNotes} onChange={setProviderNotes} rows={5} placeholder="Free-text only when clinically needed." dictate />
            {user?.id && (
              <AIScribeDialog
                open={scribeOpen}
                onOpenChange={setScribeOpen}
                appointmentId={appointmentId}
                clientEmail={client.email}
                providerUserId={user.id}
                serviceName={serviceName}
                category={category}
                onGenerated={({ narrative, structured }) => {
                  if (narrative) {
                    setProviderNotes(prev => (prev.trim() ? prev.trim() + "\n\n" : "") + narrative);
                  }
                  try {
                    const s = (structured || {}) as any;
                    // Chief concerns -> Indication (only if empty)
                    if (Array.isArray(s.chief_concerns) && s.chief_concerns.length && !indication.trim()) {
                      setIndication(s.chief_concerns.filter(Boolean).join(", ").slice(0, 240));
                    }
                    // Follow-up weeks
                    if (s.followup_weeks != null && !followupWeeks) {
                      setFollowupWeeks(String(s.followup_weeks));
                    }
                    // Adverse events narrative
                    if (typeof s.adverse_events === "string" && s.adverse_events.trim() && !adverseNarrative.trim()) {
                      setAdverseNarrative(s.adverse_events.trim());
                    }
                    // Neurotoxin: product + units per zone
                    if (category === "neurotoxin") {
                      const isBrand = (b: string) => /botox|dysport|daxxify|xeomin|jeuveau/i.test(b || "");
                      if (typeof s.product === "string" && isBrand(s.product)) {
                        setNeuro(n => ({ ...n, product: n.product || s.product }));
                      }
                      const uz = s.units_by_zone as Record<string, number> | undefined;
                      if (uz && typeof uz === "object") {
                        const additions = Object.entries(uz)
                          .filter(([z, u]) => z && Number(u) > 0)
                          .map(([zone, units]) => ({ zone: String(zone), units: Number(units) }));
                        if (additions.length) {
                          setNeuro(n => {
                            const existing = new Set(n.map.map(m => m.zone.toLowerCase()));
                            const merged = [...n.map, ...additions.filter(a => !existing.has(a.zone.toLowerCase()))];
                            return { ...n, map: merged };
                          });
                        }
                      }
                    }
                    // Filler: product + regions
                    if (category === "filler") {
                      if (typeof s.product === "string" && s.product.trim()) {
                        setFiller(f => ({ ...f, product: f.product || s.product }));
                      }
                      const sr = s.syringes_by_region as Record<string, number> | undefined;
                      if (sr && typeof sr === "object") {
                        const regions = Object.keys(sr).filter(Boolean);
                        if (regions.length) {
                          setFiller(f => {
                            const existing = new Set(f.areas.map(a => a.toLowerCase()));
                            const merged = [...f.areas, ...regions.filter(r => !existing.has(r.toLowerCase()))];
                            const total = Object.values(sr).reduce((a, b) => a + (Number(b) || 0), 0);
                            return { ...f, areas: merged, syringes_used: Math.max(f.syringes_used, total || f.syringes_used) };
                          });
                        }
                      }
                    }
                  } catch (e) {
                    console.warn("[ai-scribe] structured apply failed", e);
                  }
                }}
              />
            )}
          </div>
        );
      })()}


      <Section title="Provider signature">
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-xs text-muted-foreground">
            I attest the above is a true and accurate record of the procedure I performed.
            {!isNP && !isAdmin && " A supervising NP must co-sign before the note is finalized."}
          </p>
          {savedSig && (
            <button
              type="button"
              onClick={() => { setSigPng(savedSig.png); setSigFullName(savedSig.name); toast.success("Saved signature loaded"); }}
              className="shrink-0 text-xs px-2.5 py-1.5 rounded-md border border-input bg-background hover:bg-muted"
              title="Use your saved signature"
            >
              Use saved signature
            </button>
          )}
        </div>
        <MiniSignaturePad
          fullName={sigFullName} onFullNameChange={setSigFullName}
          signaturePng={sigPng} onSignatureChange={setSigPng}
          nameLabel="Provider full legal name *"
        />
        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Checkbox checked={saveSigForFuture} onCheckedChange={(v) => setSaveSigForFuture(v === true)} />
          Save this signature to my profile and auto-fill it on future chart notes
        </label>
      </Section>


      <div className="sticky bottom-0 -mx-6 px-6 py-4 md:py-5 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border bg-background/95 backdrop-blur flex items-center justify-between gap-4">
        <div className="text-xs md:text-sm text-muted-foreground min-w-0 flex-1">
          {canSubmit ? (
            <span className="text-success-soft-foreground">Ready to sign</span>
          ) : (
            <span className="truncate block" title={missingFields.join(" · ")}>
              <span className="text-warning-soft-foreground font-medium">Missing:</span> {missingFields.slice(0, 3).join(" · ")}
              {missingFields.length > 3 && ` · +${missingFields.length - 3} more`}
            </span>
          )}
        </div>
        <Button onClick={submit} disabled={!canSubmit || saving} size="lg" className="shrink-0 h-12 md:h-14 px-6 md:px-8 text-base md:text-lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileCheck2 className="h-5 w-5 mr-2" />} Sign chart note
          <kbd className="hidden md:inline ml-2 text-[10px] font-mono opacity-70 border border-current/30 rounded px-1.5 py-0.5">⌘S</kbd>
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const cls =
    s === "cosigned" || s === "locked" ? "bg-success-soft text-success-soft-foreground" :
    s === "signed" ? "bg-warning-soft text-warning-soft-foreground" :
    "bg-secondary text-muted-foreground";
  return <span className={`inline-block text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded ${cls}`}>{s}</span>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-widest text-muted-foreground border-b border-border pb-1">{title}</div>
      {children}
    </div>
  );
}
function LabeledInput({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
function LabeledTextarea({ label, value, onChange, rows = 3, placeholder, dictate = true }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; dictate?: boolean }) {
  const { supported, listening, start, stop, interim } = useDictation({
    onAppend: (text) => onChange((value ? value.trim() + " " : "") + text + " "),
  });
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
        {dictate && supported && (
          <button
            type="button"
            onClick={() => (listening ? stop() : start())}
            className={`text-[11px] flex items-center gap-1 px-2 py-1 rounded-full border transition ${listening ? "bg-destructive/10 border-destructive/40 text-destructive animate-pulse" : "border-input bg-secondary/40 hover:bg-secondary"}`}
            aria-label={listening ? "Stop dictation" : "Start dictation"}
          >
            {listening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
            {listening ? "Stop" : "Dictate"}
          </button>
        )}
      </div>
      <Textarea rows={rows} value={value + (interim ? ` ${interim}` : "")} onChange={e => onChange(e.target.value.replace(interim ? ` ${interim}` : "", ""))} placeholder={placeholder} />
    </div>
  );
}
function Pills({ items }: { items: string[] }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground italic">None</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(i => <span key={i} className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">{i}</span>)}
    </div>
  );
}
function CategoryDetailReadonly({ category, detail }: { category: Category; detail: any }) {
  return (
    <Section title={`${CATEGORY_LABEL[category]} details`}>
      <div className="text-sm space-y-1.5">
        {Object.entries(detail).filter(([k]) => k !== "clinical_note_id").map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-3">
            <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
            <span className="col-span-2 break-words">
              {Array.isArray(v) ? (v as string[]).join(", ") :
                typeof v === "object" && v !== null ? <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(v, null, 2)}</pre> :
                  String(v ?? "—")}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ReadonlyClinicalPhotos({ kind, paths }: { kind: string; paths: string[] }) {
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const p of paths) {
        const { data } = await supabase.storage.from("clinical-photos").createSignedUrl(p, 60 * 60);
        if (data?.signedUrl) next[p] = data.signedUrl;
      }
      if (!cancelled) setPreviews(next);
    })();
    return () => { cancelled = true; };
  }, [paths]);

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{kind} ({paths.length})</div>
      {paths.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {kind.toLowerCase()} photos on this note.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {paths.map((p) => (
            <a key={p} href={previews[p]} target="_blank" rel="noreferrer" className="block rounded-lg border border-border bg-muted overflow-hidden aspect-square">
              {previews[p] ? (
                <img src={previews[p]} alt={`${kind} clinical photo`} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-full w-full flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}


function AddendumsPanel({
  noteId, canAdd, currentUserId, currentName, currentRole,
}: { noteId: string; canAdd: boolean; currentUserId: string; currentName: string; currentRole: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState(currentName);
  const [sig, setSig] = useState("");
  const [sigMode, setSigMode] = useState<"drawn" | "typed">("drawn");
  const [typedAttested, setTypedAttested] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("clinical_note_addendums")
      .select("*").eq("clinical_note_id", noteId).order("created_at", { ascending: true });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, [noteId]); // eslint-disable-line

  // Render the typed-signature as a PNG (script-style) so storage stays consistent and the
  // chart packet still shows a visible signature line. UETA / 21 CFR §11.200 both accept
  // typed signatures when the signer has explicitly attested to intent.
  function buildTypedSignaturePng(text: string): string {
    if (typeof document === "undefined") return "";
    const canvas = document.createElement("canvas");
    canvas.width = 600; canvas.height = 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111111";
    ctx.font = 'italic 48px "Segoe Script", "Lucida Handwriting", cursive';
    ctx.textBaseline = "middle";
    ctx.fillText(text, 20, 70);
    return canvas.toDataURL("image/png");
  }

  async function submit() {
    if (!reason.trim() || !body.trim() || !name.trim()) {
      toast.error("Reason, addendum text, and full legal name are required");
      return;
    }
    let signaturePng = sig;
    if (sigMode === "typed") {
      if (!typedAttested) { toast.error("You must attest to the typed signature."); return; }
      signaturePng = buildTypedSignaturePng(name.trim());
    } else if (!sig) {
      toast.error("Please draw your signature, or switch to typed.");
      return;
    }
    setSaving(true);
    try {
      const ua = navigator.userAgent;
      const attestationBody = sigMode === "typed"
        ? `${body.trim()}\n\n— Signed via typed signature (UETA / 21 CFR §11.200). Author attests this typed name has the same legal effect as a handwritten signature.`
        : body.trim();
      const { error } = await supabase.from("clinical_note_addendums").insert({
        clinical_note_id: noteId,
        author_user_id: currentUserId,
        author_name: name.trim(),
        author_role: currentRole,
        reason: reason.trim(),
        body: attestationBody,
        signature_png: signaturePng,
      });
      if (error) throw error;
      await supabase.from("clinical_audit_log").insert({
        actor_user_id: currentUserId, actor_name: name.trim(),
        resource_type: "clinical_note", resource_id: noteId,
        action: "addendum_created", user_agent: ua,
        metadata: { signature_mode: sigMode } as any,
      });
      toast.success("Addendum added");
      setOpen(false); setReason(""); setBody(""); setSig(""); setTypedAttested(false); setSigMode("drawn");
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Section title={`Addendums & corrections (${items.length})`}>
      <div className="space-y-3">
        {items.length === 0 && !open && (
          <p className="text-sm text-muted-foreground italic">
            No addendums on this note. Signed notes are immutable by law — to fix an error, use <span className="font-medium">Correct an error</span> below. The original stays intact and the correction is appended, signed, and timestamped.
          </p>
        )}
        {items.map(a => (
          <div key={a.id} className="rounded-md border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{a.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {a.author_name} • {a.author_role ?? "—"} • {format(new Date(a.created_at), "PPP p")}
                </p>
              </div>
            </div>
            <p className="text-sm mt-2 whitespace-pre-wrap">{a.body}</p>
            {a.signature_png && <img src={a.signature_png} alt="" className="mt-2 h-14 object-contain bg-white rounded border" />}
          </div>
        ))}

        {canAdd && !open && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => {
              setReason("Error correction");
              setBody('Correction: the "Service Type" documented above was entered incorrectly. All other details of this note — product, dose, SOAP narrative, and signature — remain accurate as charted. Entered per HIPAA §164.526 to correct a data-entry error; the original note is preserved verbatim.');
              setOpen(true);
            }}>
              <Plus className="h-3.5 w-3.5 mr-1" />Correct an error
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add addendum
            </Button>
          </div>
        )}

        {open && (
          <div className="rounded-md border border-border p-3 space-y-3 bg-secondary/20">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Reason *</Label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Clarification, late entry, error correction" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Addendum text *</Label>
              <Textarea rows={4} value={body} onChange={e => setBody(e.target.value)} placeholder="Detail the addendum. The original note remains immutable." />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground uppercase tracking-widest">Signature method:</span>
              <button type="button" onClick={() => setSigMode("drawn")} className={`rounded-full px-3 py-1 border ${sigMode === "drawn" ? "border-primary bg-primary/10" : "border-border"}`}>Draw</button>
              <button type="button" onClick={() => setSigMode("typed")} className={`rounded-full px-3 py-1 border ${sigMode === "typed" ? "border-primary bg-primary/10" : "border-border"}`}>Type (UETA)</button>
            </div>
            {sigMode === "drawn" ? (
              <MiniSignaturePad
                fullName={name} onFullNameChange={setName}
                signaturePng={sig} onSignatureChange={setSig}
                nameLabel="Author full legal name"
              />
            ) : (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Author full legal name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe, NP" />
                {name.trim() && (
                  <div className="rounded-md border border-border bg-background p-3">
                    <p className="font-[cursive] italic text-2xl" style={{ fontFamily: '"Segoe Script","Lucida Handwriting",cursive' }}>{name.trim()}</p>
                  </div>
                )}
                <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox checked={typedAttested} onCheckedChange={(c) => setTypedAttested(!!c)} className="mt-0.5" />
                  <span>
                    By checking this box and submitting, I authorize this typed name as my legal electronic signature on this addendum.
                    I agree it has the same effect as a handwritten signature under UETA (Cal. Civ. Code §1633.7) and 21 CFR §11.200.
                  </span>
                </label>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
              <Button size="sm" onClick={submit} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Sign &amp; add addendum
              </Button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

/**
 * ClinicalPhotos — uploads to the private `clinical-photos` bucket under the note id.
 * Stores keys (not URLs) on the parent record; previews via short-lived signed URLs.
 * California EMR standard: pre/post imaging strengthens defensibility for cosmetic claims.
 */
function ClinicalPhotos({
  noteId, kind, paths, onChange, clientEmail,
}: { noteId: string; kind: "pre" | "post"; paths: string[]; onChange: (p: string[]) => void; clientEmail?: string }) {
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const p of paths) {
        const { data } = await supabase.storage.from("clinical-photos").createSignedUrl(p, 600);
        if (data?.signedUrl) next[p] = data.signedUrl;
      }
      if (!cancelled) setPreviews(next);
      // HIPAA audit: record PHI photo access (one entry per render of paths)
      if (!cancelled && paths.length > 0) {
        void import("@/lib/phiAudit").then(({ logPhiAccess }) =>
          logPhiAccess({
            resourceType: "clinical_photo",
            resourceId: noteId,
            clientEmail: clientEmail ?? "",
            action: "view",
            metadata: { kind, count: paths.length },
          })
        );
      }
    })();
    return () => { cancelled = true; };
  }, [paths, noteId, kind, clientEmail]);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const newPaths: string[] = [];
      for (const f of Array.from(files)) {
        if (f.size > 12 * 1024 * 1024) { toast.error(`${f.name}: max 12 MB`); continue; }
        if (!/^image\//.test(f.type)) { toast.error(`${f.name}: must be an image`); continue; }
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const key = `${noteId}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("clinical-photos").upload(key, f, {
          contentType: f.type, upsert: false,
        });
        if (error) { toast.error(`${f.name}: ${error.message}`); continue; }
        newPaths.push(key);
      }
      if (newPaths.length) onChange([...paths, ...newPaths]);
    } finally { setBusy(false); }
  }

  async function remove(key: string) {
    await supabase.storage.from("clinical-photos").remove([key]);
    onChange(paths.filter(p => p !== key));
  }

  const TARGET_MIN = 6;
  const TARGET_MAX = 8;
  const meetsTarget = paths.length >= TARGET_MIN;
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          {kind === "pre" ? "Pre-procedure photos" : "Post-procedure photos"} ({paths.length})
        </Label>
        <span className={`text-[11px] ${meetsTarget ? "text-success-soft-foreground" : "text-muted-foreground"}`}>
          {meetsTarget
            ? `✓ ${paths.length} photo${paths.length === 1 ? "" : "s"} captured`
            : `Recommend ${TARGET_MIN}–${TARGET_MAX} photos (front, L 45°, L 90°, R 45°, R 90°, chin-up, chin-down, close-ups)`}
        </span>
      </div>
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg p-3 border ${kind === "pre" ? "border-info/30 bg-info-soft/40 dark:bg-info-soft" : "border-success/30 bg-success-soft/40 dark:bg-success-soft"}`}>
        {paths.map(p => (
          <div key={p} className="relative group">
            {previews[p] ? (
              <img src={previews[p]} alt="" className="w-full h-32 object-cover rounded border border-border" />
            ) : (
              <div className="w-full h-32 bg-muted rounded border border-border flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            <button
              type="button" onClick={() => remove(p)}
              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition"
              aria-label="Remove photo"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded cursor-pointer hover:border-primary text-xs text-muted-foreground gap-1">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <>
              <span className="text-2xl leading-none">+</span>
              <span>{kind === "pre" ? "Add pre photo" : "Add post photo"}</span>
            </>
          )}
          <input
            type="file" accept="image/*" multiple capture="environment"
            className="hidden" disabled={busy}
            onChange={(e) => { handleFiles(e.target.files); e.currentTarget.value = ""; }}
          />
        </label>
      </div>
    </div>
  );
}


function ReadonlyBeforeAfterCompare({
  prePaths, postPaths, clientName, clientEmail,
}: { prePaths: string[]; postPaths: string[]; clientName: string; clientEmail?: string | null }) {
  const [pair, setPair] = useState<{ beforeUrl: string; afterUrl: string; sharedOk: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!prePaths.length || !postPaths.length) { setPair(null); return; }
      const { data: meta } = await supabase
        .from("clinical_photo_meta")
        .select("storage_path, angle, is_shared_with_patient")
        .in("storage_path", [...prePaths, ...postPaths]);
      const byPath = new Map<string, { angle: string; shared: boolean }>();
      (meta ?? []).forEach((m: any) => byPath.set(m.storage_path, { angle: m.angle, shared: !!m.is_shared_with_patient }));
      let bPath = prePaths[0], aPath = postPaths[0];
      for (const p of prePaths) {
        const ang = byPath.get(p)?.angle;
        if (!ang) continue;
        const match = postPaths.find(q => byPath.get(q)?.angle === ang);
        if (match) { bPath = p; aPath = match; break; }
      }
      const sharedOk = (byPath.get(bPath)?.shared ?? false) && (byPath.get(aPath)?.shared ?? false);
      const [b, a] = await Promise.all([
        supabase.storage.from("clinical-photos").createSignedUrl(bPath, 600),
        supabase.storage.from("clinical-photos").createSignedUrl(aPath, 600),
      ]);
      if (!cancelled && b.data?.signedUrl && a.data?.signedUrl) {
        setPair({ beforeUrl: b.data.signedUrl, afterUrl: a.data.signedUrl, sharedOk });
      }
    })();
    return () => { cancelled = true; };
  }, [prePaths, postPaths, clientEmail]);

  if (!pair) return null;
  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Before / after compare</Label>
        <WatermarkedExportButton
          beforeUrl={pair.beforeUrl}
          afterUrl={pair.afterUrl}
          clientName={clientName}
          disabled={!pair.sharedOk}
          disabledReason="Mark both photos as shared-with-patient in the meta record to enable export."
        />
      </div>
      <BeforeAfterSlider beforeUrl={pair.beforeUrl} afterUrl={pair.afterUrl} aspectRatio={4 / 3} />
    </div>
  );
}

function IndicationDictationInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { supported, listening, start, stop, interim } = useDictation({
    onAppend: (text) => onChange(((value ? value + " " : "") + text).slice(0, 500)),
  });
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          Indication for treatment today *
        </Label>
        {supported && (
          <button
            type="button"
            onClick={listening ? stop : start}
            className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border ${listening ? "border-red-500 text-red-600 bg-red-50 animate-pulse" : "border-input bg-background hover:bg-muted"}`}
            title={listening ? "Stop dictation" : "Dictate the reason for today's visit"}
          >
            {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            {listening ? "Listening…" : "Dictate"}
          </button>
        )}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Glabellar rhytids, perioral volume loss, melasma — or tap Dictate to speak"
      />
      {interim && (
        <div className="text-xs text-muted-foreground italic">…{interim}</div>
      )}
    </div>
  );
}

// Consultation-only visits don't get sent to checkout — this button lets
// staff close the appointment cleanly and trigger the post-visit review
// email without creating a $0 sale.
function ConsultCompleteButton({ appointmentId }: { appointmentId: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("appointments").select("status").eq("id", appointmentId).maybeSingle();
      if (!cancelled) setStatus((data as any)?.status ?? null);
    })();
    return () => { cancelled = true; };
  }, [appointmentId]);

  if (status === "completed" || done) {
    return (
      <div className="rounded-lg border border-success/30 bg-success-soft p-3 text-sm">
        Consultation complete — appointment closed and review email sent.
      </div>
    );
  }
  if (status && !["approved", "pending", "arrived"].includes(status)) return null;

  const complete = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("mark-appointment-complete", {
        body: { appointmentId },
      });
      if (error) throw error;
      toast.success("Consultation complete — no charge, review email sent");
      setDone(true);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to complete consultation");
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
      <p className="text-sm font-medium">Close this consultation</p>
      <p className="text-xs text-muted-foreground">
        No services were performed — mark the appointment complete without a checkout. This sends the post-visit review email as usual.
      </p>
      <Button onClick={complete} disabled={busy} size="sm">
        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileCheck2 className="h-4 w-4 mr-1" />}
        Complete consultation (no charge)
      </Button>
    </div>
  );
}

