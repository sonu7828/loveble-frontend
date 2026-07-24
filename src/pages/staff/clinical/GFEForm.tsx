import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { openPdf } from "@/lib/openPdf";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, ShieldAlert, FileCheck2, Download, RotateCcw, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ChecklistGroup, SingleSelectChips } from "@/components/clinical/ChecklistGroup";
import { MiniSignaturePad } from "@/components/clinical/MiniSignaturePad";
import { AIScribeDialog } from "@/components/clinical/AIScribeDialog";
import { listChartDrafts, readChartDraft, useChartDraftAutosave } from "@/hooks/useChartDraftAutosave";
import {
  CHIEF_CONCERNS, TREATMENT_GOALS, MEDICAL_HISTORY, MEDICATIONS, ALLERGIES,
  PRIOR_TREATMENTS, FITZPATRICK, SKIN_ASSESSMENT, PREGNANCY_STATUS,
  GFE_ASSESSMENT_FINDINGS, GFE_PLAN_TEMPLATES,
  GFE_ASSESSMENT_GROUPS, GFE_PLAN_GROUPS, GFE_QUICK_PRESETS,
} from "@/lib/clinicalOptions";
import { format, formatDistanceToNow } from "date-fns";


const uniqueStrings = (items?: string[] | null) => Array.from(new Set((items ?? []).filter(Boolean)));
const normalizeDraftText = (value?: string | null) => (value ?? "").trim().toLowerCase();
const draftFullName = (first?: string | null, last?: string | null) => `${normalizeDraftText(first)} ${normalizeDraftText(last)}`.trim();

function draftPatientLabel(data: any) {
  const f = data?.form ?? {};
  return [f.client_first_name, f.client_last_name].filter(Boolean).join(" ").trim() || f.client_email || "this patient";
}

function hasMeaningfulGfeDraftData(data: any) {
  const f = data?.form ?? {};
  const arrayFields = [
    "chief_concerns", "treatment_goals", "medical_history", "current_medications",
    "allergies", "prior_treatments", "skin_assessment",
  ];
  const textFields = [
    "client_dob", "chief_concerns_notes", "medical_history_other", "current_medications_other",
    "allergies_other", "prior_treatments_last_date", "fitzpatrick", "bp_systolic",
    "bp_diastolic", "heart_rate", "height_ft", "height_in_part", "weight_lb",
    "pregnancy_status", "np_assessment_plan",
  ];
  return arrayFields.some(k => Array.isArray(f[k]) && f[k].length > 0)
    || textFields.some(k => typeof f[k] === "string" && f[k].trim().length > 0)
    || [data?.assessmentFindings, data?.planItems, data?.additionalApprovedServices].some(v => Array.isArray(v) && v.length > 0)
    || !!data?.planNotes?.trim()
    || !!f.patient_id_verified
    || !!f.vascular_occlusion_protocol_confirmed
    || !!f.hyaluronidase_risk_disclosed
    || !!f.photo_consent;
}

function findGfeDraftCandidate(userId: string, primaryKey: string | null, patient: { email?: string; first?: string; last?: string }) {
  const primary = readChartDraft<any>(primaryKey);
  if (primary && hasMeaningfulGfeDraftData(primary.data)) return { ...primary, confidence: "exact" as const };

  const email = normalizeDraftText(patient.email);
  const name = draftFullName(patient.first, patient.last);
  const drafts = listChartDrafts<any>(`gfe:${userId}:`).filter(d => d.noteId !== primaryKey && hasMeaningfulGfeDraftData(d.data));
  const patientMatches = drafts.filter(d => {
    const f = d.data?.form ?? {};
    return (!!email && (normalizeDraftText(f.client_email) === email || d.noteId.endsWith(`:${email}`)))
      || (!!name && draftFullName(f.client_first_name, f.client_last_name) === name);
  });
  if (patientMatches.length) return { ...patientMatches[0], confidence: "patient" as const };
  if (!email && !name && drafts.length) return { ...drafts[0], confidence: "latest" as const };
  return null;
}

export default function GFEForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { user, isNP, staffId } = useAuth();
  const [initialDraftSuffix] = useState(() => {
    const appointmentId = sp.get("appointment")?.trim();
    const initialEmail = sp.get("email")?.trim().toLowerCase();
    return initialEmail || (appointmentId ? `appointment:${appointmentId}` : "_new");
  });
  const isViewMode = !!id;
  // CA B&P §2242: only a licensed clinician (NP/PA/MD) may perform a GFE.
  // Admins without an NP role must not be able to sign — DB RLS also enforces this.
  const canSign = isNP;

  const [loading, setLoading] = useState(isViewMode);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<any>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [scribeOpen, setScribeOpen] = useState(false);


  const [form, setForm] = useState({
    client_email: sp.get("email") ?? "",
    client_first_name: sp.get("first") ?? "",
    client_last_name: sp.get("last") ?? "",
    client_dob: "",
    np_name: "",
    np_license: "",
    chief_concerns: [] as string[],
    chief_concerns_notes: "",
    treatment_goals: [] as string[],
    medical_history: [] as string[],
    medical_history_other: "",
    current_medications: [] as string[],
    current_medications_other: "",
    allergies: [] as string[],
    allergies_other: "",
    prior_treatments: [] as string[],
    prior_treatments_last_date: "",
    fitzpatrick: "",
    skin_assessment: [] as string[],
    bp_systolic: "",
    bp_diastolic: "",
    heart_rate: "",
    height_ft: "",
    height_in_part: "",
    weight_lb: "",
    pregnancy_status: "",
    photo_consent: false,
    patient_id_verified: false,
    vascular_occlusion_protocol_confirmed: false,
    hyaluronidase_risk_disclosed: false,
    np_assessment_plan: "",
    signature_png: "",
  });

  // Structured assessment & plan — auto-builds the np_assessment_plan string.
  const [assessmentFindings, setAssessmentFindings] = useState<string[]>([]);
  const [planItems, setPlanItems] = useState<string[]>([]);
  const [bookedServices, setBookedServices] = useState<string[]>([]);
  const [additionalApprovedServices, setAdditionalApprovedServices] = useState<string[]>([]);
  const [allServiceNames, setAllServiceNames] = useState<string[]>([]);
  const [planNotes, setPlanNotes] = useState("");
  const [visitModality, setVisitModality] = useState<"in_person" | "televisit">("in_person");
  // Televisit-specific litigation-tight attestations. Required only when visitModality === "televisit".
  const [televisit, setTelevisit] = useState({
    platform: "",                       // e.g., Doxy.me, Zoom for Healthcare (BAA on file)
    patient_location_state: "CA",       // state patient is physically in during the visit
    patient_location_address: "",       // city + state, for emergency reference
    np_location_state: "CA",            // NP location at time of visit
    emergency_contact_name: "",
    emergency_contact_phone: "",
    nearest_er_or_911_acknowledged: false,
    identity_verified_photo_id_on_video: false,
    consent_to_telehealth_obtained: false,
    audio_video_quality_adequate: false,
    privacy_confirmed_both_sides: false,
    hipaa_compliant_platform_baa: false,
    limitations_of_televisit_discussed: false,
    in_person_followup_offered_if_needed: false,
    no_controlled_substances_prescribed: true,
  });

  // ---- Draft autosave (per-NP, per-client) ------------------------------
  // Keyed by signed-in NP + the opening appointment/client. It must not change
  // while typing, or mobile Safari can accumulate huge stale drafts and freeze.
  const draftKey = !isViewMode && user
    ? `gfe:${user.id}:${initialDraftSuffix}`
    : null;
  const [extraDraftAliases, setExtraDraftAliases] = useState<string[]>([]);
  const draftAliases = useMemo(() => {
    if (!user) return extraDraftAliases;
    const ids: string[] = [];
    const email = normalizeDraftText(form.client_email);
    const appointmentId = sp.get("appointment")?.trim();
    if (email) ids.push(`gfe:${user.id}:${email}`);
    if (appointmentId) ids.push(`gfe:${user.id}:appointment:${appointmentId}`);
    return Array.from(new Set([...ids, ...extraDraftAliases])).filter(id => id !== draftKey);
  }, [draftKey, extraDraftAliases, form.client_email, sp, user]);
  // Strip signature_png from the autosaved bundle — it's a base64 PNG that can
  // be 50–200KB, and including it would JSON.stringify the whole thing every
  // few seconds, jank-locking mobile Safari and eating localStorage quota.
  const draftBundle = useMemo(() => {
    const { signature_png, ...formForDraft } = form;
    const compactForm = {
      ...formForDraft,
      chief_concerns: uniqueStrings(formForDraft.chief_concerns),
      treatment_goals: uniqueStrings(formForDraft.treatment_goals),
      medical_history: uniqueStrings(formForDraft.medical_history),
      current_medications: uniqueStrings(formForDraft.current_medications),
      allergies: uniqueStrings(formForDraft.allergies),
      prior_treatments: uniqueStrings(formForDraft.prior_treatments),
      skin_assessment: uniqueStrings(formForDraft.skin_assessment),
    };
    return {
      form: compactForm,
      assessmentFindings: uniqueStrings(assessmentFindings),
      planItems: uniqueStrings(planItems),
      additionalApprovedServices: uniqueStrings(additionalApprovedServices),
      planNotes,
      visitModality,
      televisit,
    };
  }, [form, assessmentFindings, planItems, additionalApprovedServices, planNotes, visitModality, televisit]);
  const autosave = useChartDraftAutosave(draftKey, draftBundle, { enabled: !isViewMode, aliases: draftAliases });
  const [draftRestored, setDraftRestored] = useState(false);
  const availableGfeDrafts = useMemo(() => {
    if (isViewMode || !user) return [];
    const email = normalizeDraftText(form.client_email);
    const name = draftFullName(form.client_first_name, form.client_last_name);
    // HIPAA: never show drafts for other patients. Require an email or full name
    // match against the patient currently on screen before listing a draft.
    if (!email && !name) return [];
    return listChartDrafts<any>(`gfe:${user.id}:`)
      .filter(d => {
        if (!hasMeaningfulGfeDraftData(d.data)) return false;
        const f = d.data?.form || {};
        const dEmail = normalizeDraftText(f.client_email);
        const dName = draftFullName(f.client_first_name, f.client_last_name);
        if (email && dEmail && dEmail === email) return true;
        if (email && d.noteId.endsWith(`:${email}`)) return true;
        if (name && dName && dName === name) return true;
        return false;
      })
      .slice(0, 5);
  }, [autosave.savedAt, draftKey, draftRestored, isViewMode, user, form.client_email, form.client_first_name, form.client_last_name]);

  const applyRestoredDraft = (restored: any, sourceNoteId?: string) => {
    if (!restored) return;
    if (sourceNoteId) setExtraDraftAliases(prev => Array.from(new Set([...prev, sourceNoteId])));
    // Signature is intentionally not autosaved; keep any current value.
    setForm(f => ({
      ...f,
      ...restored.form,
      chief_concerns: uniqueStrings(restored.form?.chief_concerns),
      treatment_goals: uniqueStrings(restored.form?.treatment_goals),
      medical_history: uniqueStrings(restored.form?.medical_history),
      current_medications: uniqueStrings(restored.form?.current_medications),
      allergies: uniqueStrings(restored.form?.allergies),
      prior_treatments: uniqueStrings(restored.form?.prior_treatments),
      skin_assessment: uniqueStrings(restored.form?.skin_assessment),
      signature_png: f.signature_png,
    }));
    setAssessmentFindings(uniqueStrings(restored.assessmentFindings));
    setPlanItems(uniqueStrings(restored.planItems));
    setAdditionalApprovedServices(uniqueStrings(restored.additionalApprovedServices));
    setPlanNotes(restored.planNotes ?? "");
    setVisitModality(restored.visitModality ?? "in_person");
    if (restored.televisit) setTelevisit(restored.televisit);
    toast.success(`Draft restored for ${draftPatientLabel(restored)}`);
  };

  // Offer to restore exactly once per mount. We intentionally do NOT re-run
  // when draftKey changes (it depends on client_email, which the user types
  // live — re-running would silently wipe what they just typed by restoring
  // a stale draft saved under an earlier email prefix).
  useEffect(() => {
    if (draftRestored || isViewMode || !user) return;
    const candidate = findGfeDraftCandidate(user.id, draftKey, {
      email: form.client_email || sp.get("email"),
      first: form.client_first_name || sp.get("first"),
      last: form.client_last_name || sp.get("last"),
    });
    setDraftRestored(true);
    if (!candidate) return;
    const restored = candidate.data;
    if (!restored) return;
    const hasEdits =
      form.client_first_name || form.client_last_name || form.client_email ||
      assessmentFindings.length || planItems.length;
    const prompt = candidate.confidence === "latest"
      ? `Restore your most recent saved GFE draft for ${draftPatientLabel(restored)}?`
      : "Restore your saved GFE draft for this patient?";
    const accept = hasEdits || candidate.confidence === "latest"
      ? window.confirm(`${prompt} Your current entries will be replaced.`)
      : true;
    if (!accept) return;
    applyRestoredDraft(restored, candidate.noteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, draftRestored, isViewMode, user]);





  useEffect(() => {
    if (!isViewMode) {
      // Prefill NP name from profile
      (async () => {
        if (!user) return;
        const { data: sp } = await supabase.from("staff_profiles").select("full_name, license_number").eq("user_id", user.id).maybeSingle();
        if (sp) setForm(f => ({ ...f, np_name: sp.full_name ?? f.np_name, np_license: (sp as any).license_number ?? f.np_license }));
      })();
      return;
    }
    (async () => {
      const { data, error } = await supabase.from("gfe_records").select("*").eq("id", id).maybeSingle();
      if (error || !data) { toast.error("GFE not found"); navigate(-1); return; }
      setRecord(data);
      // HIPAA audit: record PHI read
      void import("@/lib/phiAudit").then(({ logPhiAccess }) =>
        logPhiAccess({ resourceType: "gfe", resourceId: id, clientEmail: (data as any).client_email, action: "view" })
      );
      setLoading(false);
    })();
  }, [id, isViewMode, user, navigate]);

  // Auto-load booked services from THIS client's appointment for TODAY only
  // (the day the GFE is being completed). If the client has multiple appointments
  // on other days, we don't pull those in — providers asked for today only.
  useEffect(() => {
    if (isViewMode || !form.client_email) return;
    (async () => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
      const { data: appts } = await supabase
        .from("appointments")
        .select("id, service_id, services:service_id(name)")
        .ilike("client_email", form.client_email)
        .in("status", ["pending", "approved", "completed"])
        .gte("start_at", startOfDay)
        .lte("start_at", endOfDay)
        .order("start_at", { ascending: true });
      const apptList = (appts ?? []) as any[];
      const names = new Set<string>(apptList.map(a => a.services?.name).filter(Boolean));
      // Include additional services attached via appointment_services for today's appts
      const ids = apptList.map(a => a.id);
      if (ids.length) {
        const { fetchApptServiceNames } = await import("@/lib/apptServices");
        const map = await fetchApptServiceNames(ids);
        Object.values(map).flat().forEach(n => names.add(n));
      }
      setBookedServices(Array.from(names));
    })();
  }, [form.client_email, isViewMode]);

  // Load all active service names for the "additionally approved" picker
  useEffect(() => {
    if (isViewMode) return;
    (async () => {
      const { data } = await supabase.from("services").select("name").eq("is_active", true).order("name");
      setAllServiceNames((data ?? []).map((r: any) => r.name as string));
    })();
  }, [isViewMode]);

  // Compose the structured plan into a single string saved to np_assessment_plan.
  useEffect(() => {
    const lines: string[] = [];
    lines.push(
      visitModality === "televisit"
        ? "VISIT MODALITY: Televisit (secure synchronous audio/video)"
        : "VISIT MODALITY: In-person",
    );
    if (visitModality === "televisit") {
      lines.push(
        "",
        "TELEVISIT ATTESTATIONS:",
        `• Platform: ${televisit.platform || "—"} (HIPAA-compliant, BAA on file: ${televisit.hipaa_compliant_platform_baa ? "YES" : "NO"})`,
        `• Patient physically located in: ${televisit.patient_location_state}${televisit.patient_location_address ? ` (${televisit.patient_location_address})` : ""}`,
        `• NP physically located in: ${televisit.np_location_state}`,
        `• Emergency contact on file: ${televisit.emergency_contact_name || "—"} / ${televisit.emergency_contact_phone || "—"}`,
        `• Nearest ER / 911 access reviewed with patient: ${televisit.nearest_er_or_911_acknowledged ? "YES" : "NO"}`,
        `• Identity verified via government photo ID shown on live video: ${televisit.identity_verified_photo_id_on_video ? "YES" : "NO"}`,
        `• Informed consent to telehealth (synchronous audio/video) obtained this visit: ${televisit.consent_to_telehealth_obtained ? "YES" : "NO"}`,
        `• Audio + video quality adequate for assessment: ${televisit.audio_video_quality_adequate ? "YES" : "NO"}`,
        `• Privacy of both parties confirmed (no unauthorized observers): ${televisit.privacy_confirmed_both_sides ? "YES" : "NO"}`,
        `• Limitations of remote evaluation discussed with patient: ${televisit.limitations_of_televisit_discussed ? "YES" : "NO"}`,
        `• In-person follow-up offered if clinically indicated: ${televisit.in_person_followup_offered_if_needed ? "YES" : "NO"}`,
        `• No controlled substances prescribed via this televisit: ${televisit.no_controlled_substances_prescribed ? "YES" : "NO"}`,
      );
    }
    if (assessmentFindings.length) lines.push("", "ASSESSMENT:", ...assessmentFindings.map(f => `• ${f}`));
    if (bookedServices.length) {
      lines.push("", "BOOKED TREATMENTS:", ...bookedServices.map(s => `• ${s}`));
    }
    if (additionalApprovedServices.length) {
      lines.push("", "ADDITIONALLY APPROVED TREATMENTS:", ...additionalApprovedServices.map(s => `• ${s}`));
    }
    if (planItems.length) lines.push("", "PLAN:", ...planItems.map(p => `• ${p}`));
    if (planNotes.trim()) lines.push("", "NOTES:", planNotes.trim());
    setForm(f => ({ ...f, np_assessment_plan: lines.join("\n") }));
  }, [assessmentFindings, planItems, bookedServices, additionalApprovedServices, planNotes, visitModality, televisit]);


  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!form.client_first_name) missing.push("First name");
    if (!form.client_last_name) missing.push("Last name");
    if (!form.client_email) missing.push("Email");
    if (!form.client_dob) missing.push("DOB");
    if (!form.patient_id_verified) missing.push("Photo ID verified");
    if (!form.np_name) missing.push("NP name");
    if (!form.np_license.trim()) missing.push("NP license #");
    if (form.medical_history.length === 0) missing.push("Medical history");
    if (form.medical_history.includes("Other (specify)") && !form.medical_history_other.trim()) missing.push("Medical history — specify Other");
    if (form.current_medications.length === 0) missing.push("Current medications");
    if (form.current_medications.includes("Other (specify)") && !form.current_medications_other.trim()) missing.push("Medications — specify Other");
    if (form.allergies.length === 0) missing.push("Allergies");
    if (form.allergies.includes("Other (specify)") && !form.allergies_other.trim()) missing.push("Allergies — specify Other");
    if (!form.pregnancy_status) missing.push("Pregnancy / lactation status");
    if (!form.vascular_occlusion_protocol_confirmed) missing.push("Vascular occlusion attestation");
    if (!form.hyaluronidase_risk_disclosed) missing.push("Hyaluronidase risk disclosure");
    if (assessmentFindings.length === 0) missing.push("Assessment findings");
    if (planItems.length === 0) missing.push("Plan");
    if (!form.signature_png) missing.push("Provider signature");
    if (visitModality === "televisit") {
      if (!televisit.platform.trim()) missing.push("Televisit platform");
      if (!televisit.patient_location_state.trim()) missing.push("Patient location state");
      if (!televisit.np_location_state.trim()) missing.push("NP location state");
      if (!televisit.emergency_contact_name.trim()) missing.push("Emergency contact name");
      if (!televisit.emergency_contact_phone.trim()) missing.push("Emergency contact phone");
      if (!televisit.nearest_er_or_911_acknowledged) missing.push("ER / 911 acknowledged");
      if (!televisit.identity_verified_photo_id_on_video) missing.push("Identity verified on video");
      if (!televisit.consent_to_telehealth_obtained) missing.push("Telehealth consent obtained");
      if (!televisit.audio_video_quality_adequate) missing.push("A/V quality adequate");
      if (!televisit.privacy_confirmed_both_sides) missing.push("Privacy confirmed");
      if (!televisit.hipaa_compliant_platform_baa) missing.push("HIPAA platform + BAA");
      if (!televisit.limitations_of_televisit_discussed) missing.push("Televisit limitations discussed");
      if (!televisit.in_person_followup_offered_if_needed) missing.push("In-person follow-up offered");
    }
    return missing;
  }, [form, assessmentFindings, planItems, visitModality, televisit]);
  const requiredFilled = missingFields.length === 0;

  async function submit() {
    if (!canSign) { toast.error("Only nurse practitioners can sign a GFE."); return; }
    if (!requiredFilled) {
      toast.error(`Missing required: ${missingFields.slice(0, 4).join(", ")}${missingFields.length > 4 ? ` (+${missingFields.length - 4} more)` : ""}`, { duration: 8000 });
      return;
    }
    setSaving(true);
    try {
      const ua = navigator.userAgent;
      const payload = {
        client_email: form.client_email.trim().toLowerCase(),
        client_first_name: form.client_first_name.trim(),
        client_last_name: form.client_last_name.trim(),
        client_dob: /^\d{4}-\d{2}-\d{2}$/.test((form.client_dob ?? "").trim()) ? form.client_dob.trim() : null,
        np_user_id: user!.id,
        np_staff_id: staffId,
        np_name: form.np_name.trim(),
        np_license: form.np_license.trim() || null,
        chief_concerns: form.chief_concerns,
        chief_concerns_notes: form.chief_concerns_notes || null,
        treatment_goals: form.treatment_goals,
        medical_history: form.medical_history,
        medical_history_other: form.medical_history_other || null,
        current_medications: form.current_medications,
        current_medications_other: form.current_medications_other || null,
        allergies: form.allergies,
        allergies_other: form.allergies_other || null,
        prior_treatments: form.prior_treatments,
        prior_treatments_last_date: /^\d{4}-\d{2}-\d{2}$/.test((form.prior_treatments_last_date ?? "").trim()) ? form.prior_treatments_last_date.trim() : null,
        fitzpatrick: form.fitzpatrick || null,
        skin_assessment: form.skin_assessment,
        bp_systolic: form.bp_systolic ? Number(form.bp_systolic) : null,
        bp_diastolic: form.bp_diastolic ? Number(form.bp_diastolic) : null,
        heart_rate: form.heart_rate ? Number(form.heart_rate) : null,
        height_in: (Number(form.height_ft) * 12 + Number(form.height_in_part || 0)) || null,
        weight_lb: form.weight_lb ? Number(form.weight_lb) : null,
        pregnancy_status: form.pregnancy_status,
        photo_consent: form.photo_consent,
        patient_id_verified: form.patient_id_verified,
        vascular_occlusion_protocol_confirmed: form.vascular_occlusion_protocol_confirmed,
        hyaluronidase_risk_disclosed: form.hyaluronidase_risk_disclosed,
        np_assessment_plan: form.np_assessment_plan.trim(),
        signature_png: form.signature_png,
        signed_user_agent: ua,
      };
      const { data, error } = await supabase.from("gfe_records").insert(payload).select("id").single();
      if (error) throw error;
      await supabase.from("clinical_audit_log").insert({
        actor_user_id: user!.id,
        actor_name: form.np_name,
        resource_type: "gfe",
        resource_id: data!.id,
        action: "sign",
        user_agent: ua,
      });
      toast.success("GFE signed and saved");
      autosave.clear();
      navigate(`/staff/clinical/gfe/${data!.id}`, { replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save GFE");
    } finally { setSaving(false); }
  }

  async function downloadPdf() {
    if (!record) return;
    setPdfBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-clinical-pdf", {
        body: { kind: "gfe", id: record.id },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("No URL returned");
      void import("@/lib/phiAudit").then(({ logPhiAccess }) =>
        logPhiAccess({ resourceType: "gfe", resourceId: record.id, clientEmail: record.client_email, action: "download" })
      );
      openPdf(url, `GFE-${record.client_last_name}-${record.client_first_name}.pdf`);
    } catch (e: any) {
      toast.error(e.message ?? "PDF failed");
    } finally { setPdfBusy(false); }
  }

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  // ============ VIEW MODE ============
  if (isViewMode && record) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/staff/today")}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
          <Button onClick={downloadPdf} disabled={pdfBusy} size="sm">
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />} PDF
          </Button>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">California Good Faith Exam</div>
          <h1 className="text-2xl font-serif">{record.client_first_name} {record.client_last_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Signed {format(new Date(record.signed_at), "PPP p")} • Valid until {format(new Date(record.expires_at), "PPP")}
          </p>
        </div>
        <Section title="Chief concerns">
          <Pills items={record.chief_concerns} />
          {record.chief_concerns_notes && <p className="text-sm mt-2 whitespace-pre-wrap">{record.chief_concerns_notes}</p>}
        </Section>
        <Section title="Treatment goals"><Pills items={record.treatment_goals} /></Section>
        <Section title="Medical history">
          <Pills items={record.medical_history} />
          {record.medical_history_other && <p className="text-sm mt-2">Other: {record.medical_history_other}</p>}
        </Section>
        <Section title="Current medications">
          <Pills items={record.current_medications} />
          {record.current_medications_other && <p className="text-sm mt-2">Other: {record.current_medications_other}</p>}
        </Section>
        <Section title="Allergies">
          <Pills items={record.allergies} />
          {record.allergies_other && <p className="text-sm mt-2">Other: {record.allergies_other}</p>}
        </Section>
        <Section title="Prior aesthetic treatments">
          <Pills items={record.prior_treatments} />
          {record.prior_treatments_last_date && <p className="text-sm mt-2">Last: {record.prior_treatments_last_date}</p>}
        </Section>
        <Section title="Skin assessment">
          {record.fitzpatrick && <p className="text-sm mb-2">Fitzpatrick: <span className="font-medium">{record.fitzpatrick}</span></p>}
          <Pills items={record.skin_assessment} />
        </Section>
        <Section title="Vitals">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {record.bp_systolic && <KV k="BP" v={`${record.bp_systolic}/${record.bp_diastolic ?? "—"}`} />}
            {record.heart_rate && <KV k="HR" v={`${record.heart_rate}`} />}
            {record.height_in && <KV k="Height" v={`${Math.floor(record.height_in / 12)}′${record.height_in % 12}″`} />}
            {record.weight_lb && <KV k="Weight" v={`${record.weight_lb} lb`} />}
          </div>
        </Section>
        <Section title="Pregnancy / lactation"><p className="text-sm">{record.pregnancy_status}</p></Section>
        <Section title="Photo consent"><p className="text-sm">{record.photo_consent ? "Granted" : "Declined"}</p></Section>
        <Section title="NP assessment & plan">
          <p className="text-sm whitespace-pre-wrap">{record.np_assessment_plan}</p>
        </Section>
        <Section title="Signature">
          <p className="text-sm font-medium">{record.np_name}{record.np_license && <span className="text-muted-foreground"> • Lic. {record.np_license}</span>}</p>
          {record.signature_png && <img src={record.signature_png} alt="Signature" className="mt-2 h-20 object-contain bg-white rounded border" />}
        </Section>
      </div>
    );
  }

  // ============ CREATE MODE ============
  if (!canSign) {
    return (
      <div className="max-w-md mx-auto p-10 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 mx-auto text-warning" />
        <h2 className="text-lg font-medium">Restricted to nurse practitioners</h2>
        <p className="text-sm text-muted-foreground">California law (B&P Code §2242) requires GFEs to be performed by a qualified clinician. Ask an admin to add the Nurse Practitioner role to your account if you should have access.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 pb-32 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-10 px-3"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground text-right">California GFE • B&amp;P §2242</span>
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">New Good Faith Exam</div>
        <h1 className="text-2xl font-serif">Initial clinical evaluation</h1>
        <p className="text-sm text-muted-foreground mt-1">Valid for 12 months from signing. NP-only.</p>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-success-soft-foreground" />
          {autosave.savedAt
            ? <>Draft autosaved {formatDistanceToNow(autosave.savedAt, { addSuffix: true })}</>
            : <>Autosave on — your draft is saved as you type</>}
        </div>
        {autosave.savedAt && (
          <button
            type="button"
            onClick={() => { if (window.confirm("Discard the autosaved draft for this patient?")) autosave.clear(); }}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> Discard draft
          </button>
        )}
      </div>

      {/* AI Scribe: record consultation and auto-fill this GFE. */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-start gap-2.5 min-w-0">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs sm:text-sm">
            <div className="font-medium text-foreground">AI Scribe — auto-fill this GFE from the consult</div>
            <div className="text-muted-foreground mt-0.5">
              Record your consultation. Chief concerns, history, meds, allergies, skin, vitals, assessment & plan will be filled in for your review.
            </div>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            if (!form.client_email) { toast.error("Enter the patient's email first"); return; }
            setScribeOpen(true);
          }}
          className="gap-1.5 shrink-0"
        >
          <Sparkles className="h-4 w-4" /> Record & auto-fill
        </Button>
      </div>



      {availableGfeDrafts.length > 0 && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-3 text-xs space-y-2">
          <div className="font-medium text-foreground">Saved GFE drafts found on this device</div>
          <div className="space-y-2">
            {availableGfeDrafts.map(d => (
              <div key={d.key} className="flex items-center justify-between gap-2 rounded border border-border bg-background px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{draftPatientLabel(d.data)}</div>
                  <div className="text-muted-foreground">{d.at ? `Autosaved ${formatDistanceToNow(new Date(d.at), { addSuffix: true })}` : "Saved draft"}</div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (window.confirm(`Restore the saved GFE draft for ${draftPatientLabel(d.data)}? Current entries on screen will be replaced.`)) {
                      applyRestoredDraft(d.data, d.noteId);
                    }
                  }}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}


      <Section title="Patient">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LabeledInput label="First name *" value={form.client_first_name} onChange={v => setForm(f => ({ ...f, client_first_name: v }))} />
          <LabeledInput label="Last name *" value={form.client_last_name} onChange={v => setForm(f => ({ ...f, client_last_name: v }))} />
          <LabeledInput label="Email *" type="email" value={form.client_email} onChange={v => setForm(f => ({ ...f, client_email: v }))} />
          <LabeledInput label="DOB *" type="date" value={form.client_dob} onChange={v => setForm(f => ({ ...f, client_dob: v }))} />
        </div>
        <TapCheckbox
          checked={form.patient_id_verified}
          onChange={(c) => setForm(f => ({ ...f, patient_id_verified: c }))}
          label="Government-issued photo ID verified — matches name and DOB on file. *"
        />
      </Section>

      <Section title="Provider (NP)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LabeledInput label="NP name *" value={form.np_name} onChange={v => setForm(f => ({ ...f, np_name: v }))} placeholder="Jane Doe, NP" />
          <LabeledInput label="CA license # *" value={form.np_license} onChange={v => setForm(f => ({ ...f, np_license: v }))} placeholder="e.g., RN 123456 / NP-F 12345" />
        </div>
        <div className="space-y-2 mt-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Visit modality *</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button type="button" onClick={() => setVisitModality("in_person")}
              className={`min-h-[56px] rounded-lg border px-4 py-3 text-sm text-left touch-manipulation active:scale-[0.99] ${visitModality === "in_person" ? "border-primary bg-primary/10 ring-1 ring-primary/30 font-medium" : "border-border"}`}>
              In-person
            </button>
            <button type="button" onClick={() => setVisitModality("televisit")}
              className={`min-h-[56px] rounded-lg border px-4 py-3 text-sm text-left touch-manipulation active:scale-[0.99] ${visitModality === "televisit" ? "border-primary bg-primary/10 ring-1 ring-primary/30 font-medium" : "border-border"}`}>
              Televisit (secure video)
            </button>
          </div>
        </div>
      </Section>

      {visitModality === "televisit" && (
        <Section title="Televisit attestations (required)">
          <p className="text-xs text-muted-foreground">
            California law (B&amp;P §2290.5) treats telehealth as the standard of care only when the practitioner verifies identity, location, informed consent, platform privacy, and arranges in-person follow-up if clinically indicated. Complete every item below before signing.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <LabeledInput label="Platform used *" value={televisit.platform} onChange={v => setTelevisit(t => ({ ...t, platform: v }))} placeholder="e.g., Doxy.me, Zoom for Healthcare" />
            <LabeledInput label="Patient location — state *" value={televisit.patient_location_state} onChange={v => setTelevisit(t => ({ ...t, patient_location_state: v }))} placeholder="CA" />
            <LabeledInput label="Patient location — city (optional)" value={televisit.patient_location_address} onChange={v => setTelevisit(t => ({ ...t, patient_location_address: v }))} placeholder="San Jose, CA" />
            <LabeledInput label="NP location — state *" value={televisit.np_location_state} onChange={v => setTelevisit(t => ({ ...t, np_location_state: v }))} placeholder="CA" />
            <LabeledInput label="Emergency contact name *" value={televisit.emergency_contact_name} onChange={v => setTelevisit(t => ({ ...t, emergency_contact_name: v }))} />
            <LabeledInput label="Emergency contact phone *" value={televisit.emergency_contact_phone} onChange={v => setTelevisit(t => ({ ...t, emergency_contact_phone: v }))} placeholder="(555) 555-5555" />
          </div>
          <div className="space-y-2 mt-3">
            {[
              ["hipaa_compliant_platform_baa", "Platform is HIPAA-compliant and BAA is on file"],
              ["identity_verified_photo_id_on_video", "Patient identity verified via government photo ID shown on live video"],
              ["consent_to_telehealth_obtained", "Verbal + written informed consent to telehealth obtained this visit"],
              ["audio_video_quality_adequate", "Audio and video quality adequate for clinical assessment"],
              ["privacy_confirmed_both_sides", "Privacy confirmed on both sides (no unauthorized observers)"],
              ["nearest_er_or_911_acknowledged", "Patient acknowledged nearest ER / 911 access in case of emergency"],
              ["limitations_of_televisit_discussed", "Limitations of remote evaluation discussed with patient"],
              ["in_person_followup_offered_if_needed", "In-person follow-up offered if clinically indicated"],
              ["no_controlled_substances_prescribed", "No controlled substances prescribed via this televisit"],
            ].map(([key, label]) => (
              <TapCheckbox
                key={key as string}
                checked={(televisit as any)[key as string]}
                onChange={(c) => setTelevisit(t => ({ ...t, [key as string]: c } as any))}
                label={label as string}
              />
            ))}
          </div>
        </Section>
      )}




      <ChecklistGroup label="Chief concerns" options={CHIEF_CONCERNS} value={form.chief_concerns} onChange={v => setForm(f => ({ ...f, chief_concerns: v }))} />
      <LabeledTextarea label="Additional notes (optional)" value={form.chief_concerns_notes} onChange={v => setForm(f => ({ ...f, chief_concerns_notes: v }))} rows={2} />

      <ChecklistGroup label="Treatment goals" options={TREATMENT_GOALS} value={form.treatment_goals} onChange={v => setForm(f => ({ ...f, treatment_goals: v }))} />

      <ChecklistGroup label="Medical history" required options={MEDICAL_HISTORY} value={form.medical_history} onChange={v => setForm(f => ({ ...f, medical_history: v, ...(v.includes("Other (specify)") ? {} : { medical_history_other: "" }) }))} />
      {form.medical_history.includes("Other (specify)") && (
        <LabeledInput label="Please specify other medical history *" value={form.medical_history_other} onChange={v => setForm(f => ({ ...f, medical_history_other: v }))} />
      )}

      <ChecklistGroup label="Current medications" required options={MEDICATIONS} value={form.current_medications} onChange={v => setForm(f => ({ ...f, current_medications: v }))} />
      <Textarea
        placeholder="Type any other medications, supplements, doses, or frequency (e.g. Lisinopril 10mg daily, fish oil)…"
        value={form.current_medications_other}
        onChange={e => setForm(f => ({ ...f, current_medications_other: e.target.value }))}
        rows={2}
      />

      <ChecklistGroup label="Allergies" required options={ALLERGIES} value={form.allergies} onChange={v => setForm(f => ({ ...f, allergies: v }))} />
      <Textarea
        placeholder="Type any other allergies and the reaction (e.g. Sulfa — hives)…"
        value={form.allergies_other}
        onChange={e => setForm(f => ({ ...f, allergies_other: e.target.value }))}
        rows={2}
      />

      <ChecklistGroup label="Prior aesthetic treatments" options={PRIOR_TREATMENTS} value={form.prior_treatments} onChange={v => setForm(f => ({ ...f, prior_treatments: v }))} />
      <LabeledInput label="Date of most recent treatment" type="date" value={form.prior_treatments_last_date} onChange={v => setForm(f => ({ ...f, prior_treatments_last_date: v }))} />

      <SingleSelectChips label="Fitzpatrick skin type" options={FITZPATRICK} value={form.fitzpatrick} onChange={v => setForm(f => ({ ...f, fitzpatrick: v }))} columns={3} />
      <ChecklistGroup label="Skin assessment" options={SKIN_ASSESSMENT} value={form.skin_assessment} onChange={v => setForm(f => ({ ...f, skin_assessment: v }))} />

      <Section title="Vitals">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <LabeledInput label="BP systolic" type="number" inputMode="numeric" value={form.bp_systolic} onChange={v => setForm(f => ({ ...f, bp_systolic: v }))} />
          <LabeledInput label="BP diastolic" type="number" inputMode="numeric" value={form.bp_diastolic} onChange={v => setForm(f => ({ ...f, bp_diastolic: v }))} />
          <LabeledInput label="HR (bpm)" type="number" inputMode="numeric" value={form.heart_rate} onChange={v => setForm(f => ({ ...f, heart_rate: v }))} />
          <LabeledInput label="Height (ft)" type="number" inputMode="numeric" value={form.height_ft} onChange={v => setForm(f => ({ ...f, height_ft: v }))} />
          <LabeledInput label="Height (in)" type="number" inputMode="numeric" value={form.height_in_part} onChange={v => setForm(f => ({ ...f, height_in_part: v }))} />
          <LabeledInput label="Weight (lb)" type="number" inputMode="numeric" value={form.weight_lb} onChange={v => setForm(f => ({ ...f, weight_lb: v }))} />
        </div>
      </Section>

      <SingleSelectChips label="Pregnancy / lactation status" required options={PREGNANCY_STATUS} value={form.pregnancy_status} onChange={v => setForm(f => ({ ...f, pregnancy_status: v }))} columns={2} />

      {(form.pregnancy_status === "Pregnant" || form.pregnancy_status === "Breastfeeding") && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          ⚠️ <strong>Pregnant or breastfeeding</strong> — neurotoxins and most dermal fillers are contraindicated. Document clinical rationale in the plan notes below before proceeding with any approved treatment.
        </div>
      )}

      <Section title="Safety attestations">
        <TapCheckbox
          checked={form.vascular_occlusion_protocol_confirmed}
          onChange={(c) => setForm(f => ({ ...f, vascular_occlusion_protocol_confirmed: c }))}
          label="Hyaluronidase is on-site, injector is trained in vascular occlusion management, and the patient has been informed of this risk. *"
        />
        <TapCheckbox
          checked={form.hyaluronidase_risk_disclosed}
          onChange={(c) => setForm(f => ({ ...f, hyaluronidase_risk_disclosed: c }))}
          label="Patient counseled that hyaluronidase may be required to dissolve filler in the event of vascular occlusion or other complication, and has consented to its potential use. *"
        />
        <TapCheckbox
          checked={form.photo_consent}
          onChange={(c) => setForm(f => ({ ...f, photo_consent: c }))}
          label="Patient grants consent for clinical photography (pre/post). A separate signed photography consent is also required on file."
        />
      </Section>

      <Section title="NP assessment & plan *">
        {bookedServices.length > 0 ? (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">Booked treatments (auto-loaded)</div>
            <div className="flex flex-wrap gap-1.5">
              {bookedServices.map(s => (
                <span key={s} className="text-xs bg-background border border-border px-2 py-1 rounded">{s}</span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No services found for today's appointment — only today's booked services auto-load here.</p>
        )}
        {allServiceNames.length > 0 && (
          <ChecklistGroup
            label="Additionally approved treatments (beyond what's booked)"
            options={allServiceNames.filter(n => !bookedServices.includes(n))}
            value={additionalApprovedServices}
            onChange={setAdditionalApprovedServices}
            columns={2}
          />
        )}
        <QuickPresetRow
          onApply={(p) => {
            // Merge instead of replace so a provider can stack presets.
            setAssessmentFindings(prev => Array.from(new Set([...prev, ...p.findings])));
            setPlanItems(prev => Array.from(new Set([...prev, ...p.plan])));
            toast.success(`Applied: ${p.label}`);
          }}
        />
        <div className="space-y-4">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Assessment findings *</div>
          {GFE_ASSESSMENT_GROUPS.map(group => (
            <ChecklistGroup
              key={group.title}
              label={group.title}
              options={group.items}
              value={assessmentFindings.filter(v => group.items.includes(v))}
              onChange={(next) => {
                // Preserve selections from other groups
                setAssessmentFindings(prev => {
                  const others = prev.filter(v => !group.items.includes(v));
                  return uniqueStrings([...others, ...next]);
                });
              }}
              columns={1}
            />
          ))}
        </div>
        <div className="space-y-4">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Plan *</div>
          {GFE_PLAN_GROUPS.map(group => (
            <ChecklistGroup
              key={group.title}
              label={group.title}
              options={group.items}
              value={planItems.filter(v => group.items.includes(v))}
              onChange={(next) => {
                setPlanItems(prev => {
                  const others = prev.filter(v => !group.items.includes(v));
                  return uniqueStrings([...others, ...next]);
                });
              }}
              columns={1}
            />
          ))}
        </div>
        <LabeledTextarea label="Additional clinical notes (optional)" value={planNotes} onChange={setPlanNotes} rows={2} placeholder="Only if clinically needed." />

      </Section>


      <Section title="Provider attestation">
        <p className="text-xs text-muted-foreground mb-3">
          I attest that I have personally evaluated this patient, reviewed their history, and established a Good Faith Exam in accordance with California Business &amp; Professions Code §2242.
        </p>
        <MiniSignaturePad
          fullName={form.np_name}
          onFullNameChange={(n) => setForm(f => ({ ...f, np_name: n }))}
          signaturePng={form.signature_png}
          onSignatureChange={(s) => setForm(f => ({ ...f, signature_png: s }))}
          nameLabel="NP full legal name *"
        />
      </Section>

      <div className="fixed sm:sticky bottom-0 inset-x-0 sm:inset-auto sm:-mx-6 px-4 sm:px-6 py-3 border-t border-border bg-background/95 backdrop-blur flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 z-30">
        <div className="text-xs text-center sm:text-left max-w-full sm:max-w-md">
          {requiredFilled ? (
            <span className="text-success-soft-foreground">Ready to sign</span>
          ) : (
            <span className="text-destructive">
              Missing: {missingFields.slice(0, 3).join(", ")}
              {missingFields.length > 3 ? ` +${missingFields.length - 3} more` : ""}
            </span>
          )}
        </div>
        <Button onClick={submit} disabled={saving} size="lg" className="h-12 w-full sm:w-auto rounded-full text-base">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileCheck2 className="h-4 w-4 mr-1" />} Sign &amp; save GFE
        </Button>
      </div>

      <AIScribeDialog
        open={scribeOpen}
        onOpenChange={setScribeOpen}
        appointmentId={sp.get("appointment") ?? null}
        clientEmail={form.client_email}
        providerUserId={user?.id ?? ""}
        serviceName="Good Faith Exam"
        category="gfe"
        mode="gfe"
        generateExtraBody={{
          options: {
            chief_concerns: CHIEF_CONCERNS,
            treatment_goals: TREATMENT_GOALS,
            medical_history: MEDICAL_HISTORY,
            current_medications: MEDICATIONS,
            allergies: ALLERGIES,
            prior_treatments: PRIOR_TREATMENTS,
            skin_assessment: SKIN_ASSESSMENT,
            pregnancy_status: PREGNANCY_STATUS,
            assessment_findings: GFE_ASSESSMENT_FINDINGS,
            plan_items: GFE_PLAN_TEMPLATES,
            additional_approved_services: allServiceNames,
          },
        }}
        onGenerated={({ gfe }) => {
          const g = (gfe ?? {}) as Record<string, any>;
          const arr = (v: any, allowed: string[]) =>
            Array.isArray(v) ? v.filter(x => typeof x === "string" && allowed.includes(x)) : [];
          const num = (v: any) => (v === null || v === undefined || v === "" ? "" : String(v));
          setForm(f => ({
            ...f,
            chief_concerns: uniqueStrings([...(f.chief_concerns || []), ...arr(g.chief_concerns, CHIEF_CONCERNS)]),
            chief_concerns_notes: g.chief_concerns_notes ? [f.chief_concerns_notes, g.chief_concerns_notes].filter(Boolean).join("\n").trim() : f.chief_concerns_notes,
            treatment_goals: uniqueStrings([...(f.treatment_goals || []), ...arr(g.treatment_goals, TREATMENT_GOALS)]),
            medical_history: uniqueStrings([...(f.medical_history || []), ...arr(g.medical_history, MEDICAL_HISTORY)]),
            medical_history_other: g.medical_history_other || f.medical_history_other,
            current_medications: uniqueStrings([...(f.current_medications || []), ...arr(g.current_medications, MEDICATIONS)]),
            current_medications_other: g.current_medications_other || f.current_medications_other,
            allergies: uniqueStrings([...(f.allergies || []), ...arr(g.allergies, ALLERGIES)]),
            allergies_other: g.allergies_other || f.allergies_other,
            prior_treatments: uniqueStrings([...(f.prior_treatments || []), ...arr(g.prior_treatments, PRIOR_TREATMENTS)]),
            prior_treatments_last_date: g.prior_treatments_last_date || f.prior_treatments_last_date,
            fitzpatrick: (typeof g.fitzpatrick === "string" && FITZPATRICK.includes(g.fitzpatrick)) ? g.fitzpatrick : f.fitzpatrick,
            skin_assessment: uniqueStrings([...(f.skin_assessment || []), ...arr(g.skin_assessment, SKIN_ASSESSMENT)]),
            bp_systolic: f.bp_systolic || num(g.bp_systolic),
            bp_diastolic: f.bp_diastolic || num(g.bp_diastolic),
            heart_rate: f.heart_rate || num(g.heart_rate),
            height_ft: f.height_ft || num(g.height_ft),
            height_in_part: f.height_in_part || num(g.height_in_part),
            weight_lb: f.weight_lb || num(g.weight_lb),
            pregnancy_status: (typeof g.pregnancy_status === "string" && PREGNANCY_STATUS.includes(g.pregnancy_status)) ? g.pregnancy_status : f.pregnancy_status,
          }));
          setAssessmentFindings(prev => uniqueStrings([...prev, ...arr(g.assessment_findings, GFE_ASSESSMENT_FINDINGS)]));
          setPlanItems(prev => uniqueStrings([...prev, ...arr(g.plan_items, GFE_PLAN_TEMPLATES)]));
          setAdditionalApprovedServices(prev => uniqueStrings([...prev, ...arr(g.additional_approved_services, allServiceNames)]));
          if (g.plan_notes) setPlanNotes(prev => [prev, g.plan_notes].filter(Boolean).join("\n").trim());
        }}
      />
    </div>
  );
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-widest text-muted-foreground border-b border-border pb-1">{title}</div>
      {children}
    </div>
  );
}
function QuickPresetRow({ onApply }: { onApply: (p: typeof GFE_QUICK_PRESETS[number]) => void }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Quick fill — board-ready presets</div>
        <span className="text-[10px] text-muted-foreground">tap to add (you can still edit)</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {GFE_QUICK_PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => onApply(p)}
            className="text-left text-xs bg-background border border-border hover:border-primary hover:bg-primary/5 rounded-md px-3 py-2 transition-colors"
            title={p.description}
          >
            <div className="font-medium">{p.label}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 max-w-[240px]">{p.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
function LabeledInput({ label, value, onChange, type = "text", placeholder, inputMode }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url" | "search" | "none" }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Input type={type} inputMode={inputMode} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-12 text-base" />
    </div>
  );
}

function TapCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (c: boolean) => void; label: string }) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={`w-full text-left flex items-start gap-3 rounded-lg border px-4 py-3 min-h-[56px] touch-manipulation active:scale-[0.99] transition ${checked ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border hover:border-primary/40"}`}
    >
      <Checkbox checked={checked} aria-hidden="true" tabIndex={-1} className="h-5 w-5 shrink-0 mt-0.5 pointer-events-none" />
      <span className="text-[15px] leading-snug flex-1">{label}</span>
    </div>
  );
}
function LabeledTextarea({ label, value, onChange, rows = 3, placeholder }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
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
function KV({ k, v }: { k: string; v: string }) {
  return <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div><div>{v}</div></div>;
}
