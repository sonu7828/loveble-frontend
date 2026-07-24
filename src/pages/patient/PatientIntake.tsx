import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { PortalCTA } from "@/components/PortalCTA";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const ALLERGY_OPTIONS = [
  "No known allergies", "Latex", "Lidocaine", "Penicillin", "Sulfa", "Iodine/Shellfish",
  "Aspirin/NSAIDs", "Adhesive tape", "Bee/wasp stings", "Hyaluronic acid", "Lily/gram (+) bacterial proteins",
];
const MED_OPTIONS = [
  "None currently", "Aspirin", "NSAIDs (ibuprofen, naproxen)", "Blood thinners (Eliquis, warfarin, Plavix)",
  "Isotretinoin (Accutane)", "Topical retinoids", "Hormonal birth control", "Hormone replacement therapy",
  "GLP-1 (Ozempic, Mounjaro, Wegovy)", "Antibiotics", "Steroids", "Immunosuppressants",
  "Antidepressants/SSRIs", "Fish oil / Vitamin E / Ginkgo",
];
const HISTORY_OPTIONS = [
  "None", "Cold sores (HSV)", "Keloid/hypertrophic scarring", "Autoimmune disease (lupus, RA, MS)",
  "Diabetes", "Hypertension", "Heart disease", "Bleeding disorder", "Cancer (active or in last 5 yrs)",
  "Seizures", "Thyroid disease", "Hepatitis / liver disease", "HIV", "Asthma", "Migraines",
  "Bell's palsy", "Recent dental work (≤2 wks)", "Recent facial filler (≤4 wks)",
  "Recent neurotoxin (≤2 wks)", "Pacemaker/implanted device", "Active skin infection",
];
const PREGNANCY = ["Not applicable", "Not pregnant", "Pregnant", "Breastfeeding", "Trying to conceive"];

const SKIN_TYPE = [
  "I — Very fair, always burns", "II — Fair, usually burns", "III — Medium, sometimes burns",
  "IV — Olive, rarely burns", "V — Brown, very rarely burns", "VI — Dark brown/black, never burns",
];
const SKIN_CONCERNS = [
  "Fine lines & wrinkles", "Volume loss", "Acne", "Acne scarring", "Hyperpigmentation/melasma",
  "Redness/rosacea", "Sun damage", "Dull texture", "Large pores", "Sagging/laxity",
  "Under-eye circles", "Double chin / jawline",
];
const SUN_EXPOSURE = ["Minimal", "Moderate", "Heavy / outdoor work", "Tanning bed history"];
const SMOKING = ["Never", "Former smoker", "Current — occasional", "Current — daily", "Vape/e-cig"];
const ALCOHOL = ["None", "Occasional (≤2/wk)", "Moderate (3–7/wk)", "Heavy (8+/wk)"];
const EXERCISE = ["None", "1–2x/week", "3–4x/week", "5+/week"];
const SKINCARE = [
  "Sunscreen daily", "Retinol/Tretinoin", "Vitamin C", "AHA/BHA exfoliant",
  "Hydroquinone", "Growth factors/peptides", "Prescription topicals", "None",
];
const PRIOR_PROCEDURES = [
  "Neurotoxin (Botox/Dysport/etc.)", "Filler", "Sculptra/Radiesse", "Microneedling",
  "Laser resurfacing", "IPL/BBL", "Chemical peel", "PDO threads", "CoolSculpting/Emsculpt",
  "Surgical facelift / blepharoplasty", "Rhinoplasty", "None",
];
const FAMILY_HX = [
  "Heart disease", "Cancer", "Diabetes", "Autoimmune", "Bleeding disorder", "Keloids", "None significant",
];
const SOCIAL_HX = ["Recreational drug use", "Recent international travel", "Pregnancy planning <12 mo", "None"];

type Appt = {
  id: string;
  client_first_name: string | null;
  client_last_name: string | null;
  client_email: string | null;
  start_at: string | null;
  status: string;
  intake_completed_at: string | null;
  services?: { name: string } | null;
};

type LastFull = {
  id: string;
  submitted_at: string;
  allergies?: string[] | null;
  current_medications?: string[] | null;
  medical_history?: string[] | null;
  pregnancy_status?: string | null;
} | null;


export default function PatientIntake() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appt, setAppt] = useState<Appt | null>(null);
  const [done, setDone] = useState(false);

  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergiesOther, setAllergiesOther] = useState("");
  const [meds, setMeds] = useState<string[]>([]);
  const [medsOther, setMedsOther] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyOther, setHistoryOther] = useState("");
  const [pregnancy, setPregnancy] = useState("Not applicable");

  const [skinType, setSkinType] = useState("");
  const [skinConcerns, setSkinConcerns] = useState<string[]>([]);
  const [sunExposure, setSunExposure] = useState("");
  const [smoking, setSmoking] = useState("");
  const [alcohol, setAlcohol] = useState("");
  const [exercise, setExercise] = useState("");
  const [skincare, setSkincare] = useState<string[]>([]);
  const [priorProcedures, setPriorProcedures] = useState<string[]>([]);
  const [familyHx, setFamilyHx] = useState<string[]>([]);
  const [socialHx, setSocialHx] = useState<string[]>([]);

  const [pcp, setPcp] = useState("");
  const [emName, setEmName] = useState("");
  const [emPhone, setEmPhone] = useState("");
  const [emRel, setEmRel] = useState("");

  const [concerns, setConcerns] = useState("");
  const [goals, setGoals] = useState("");
  const [recent, setRecent] = useState("");

  const [hipaaAck, setHipaaAck] = useState(false);
  const [nppAck, setNppAck] = useState(false);
  const [truthfulAck, setTruthfulAck] = useState(false);
  const [aiScribeAck, setAiScribeAck] = useState(false);
  const [sigName, setSigName] = useState("");


  // Annual check-in mode
  const [lastFull, setLastFull] = useState<LastFull>(null);
  const [checkinMode, setCheckinMode] = useState(false); // true when prior full <12mo exists
  const [hasChanges, setHasChanges] = useState<null | boolean>(null);
  const [changesMeds, setChangesMeds] = useState("");
  const [changesAllergies, setChangesAllergies] = useState("");
  const [changesHistory, setChangesHistory] = useState("");
  const [changesPregnancy, setChangesPregnancy] = useState("");
  const [recentIllness, setRecentIllness] = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/public-client-intake?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!res.ok) { toast.error(json.error ?? "Could not load"); return; }
        setAppt(json.appointment);
        if (json.submission) {
          const s = json.submission;
          setAllergies(s.allergies ?? []);
          setAllergiesOther(s.allergies_other ?? "");
          setMeds(s.current_medications ?? []);
          setMedsOther(s.current_medications_other ?? "");
          setHistory(s.medical_history ?? []);
          setHistoryOther(s.medical_history_other ?? "");
          setPregnancy(s.pregnancy_status ?? "Not applicable");
          setSkinType(s.skin_type ?? "");
          setSkinConcerns(s.skin_concerns ?? []);
          setSunExposure(s.sun_exposure ?? "");
          setSmoking(s.smoking_status ?? "");
          setAlcohol(s.alcohol_use ?? "");
          setExercise(s.exercise_frequency ?? "");
          setSkincare(s.skincare_products ?? []);
          setPriorProcedures(s.prior_cosmetic_procedures ?? []);
          setFamilyHx(s.family_history ?? []);
          setSocialHx(s.social_history ?? []);
          setPcp(s.primary_care_physician ?? "");
          setEmName(s.emergency_contact_name ?? "");
          setEmPhone(s.emergency_contact_phone ?? "");
          setEmRel(s.emergency_contact_relation ?? "");
          setConcerns(s.concerns ?? "");
          setGoals(s.goals ?? "");
          setRecent(s.recent_treatments ?? "");
          setHipaaAck(!!s.hipaa_acknowledged);
          setTruthfulAck(!!s.truthful_acknowledged);
          setAiScribeAck(!!s.ai_scribe_consent);
          setSigName(s.signature_full_name ?? "");

          if (json.appointment?.intake_completed_at) setDone(true);
        }
        if (json.lastFull && !json.submission) {
          setLastFull(json.lastFull);
          setCheckinMode(true);
          // Prefill arrays from last full so "yes, changes" can edit them
          setAllergies(json.lastFull.allergies ?? []);
          setMeds(json.lastFull.current_medications ?? []);
          setHistory(json.lastFull.medical_history ?? []);
          setPregnancy(json.lastFull.pregnancy_status ?? "Not applicable");
          setAiScribeAck(!!json.lastFull.ai_scribe_consent);

        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const toggle = (set: (v: string[]) => void, list: string[], v: string) => {
    set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  };

  const submit = async () => {
    if (!token) return;

    if (checkinMode) {
      if (hasChanges === null) { toast.error("Please confirm whether anything has changed since your last visit."); return; }
      if (hasChanges && !changesMeds.trim() && !changesAllergies.trim() && !changesHistory.trim() && !changesPregnancy.trim() && !recentIllness.trim()) {
        toast.error("Please describe what changed.");
        return;
      }
      if (!truthfulAck) { toast.error("Please confirm the information above is accurate."); return; }
      if (!nppAck) { toast.error("Please acknowledge the Notice of Privacy Practices (NPP)."); return; }
      if (!aiScribeAck) { toast.error("Please acknowledge the AI Scribe consent to continue."); return; }
      if (!sigName.trim()) { toast.error("Please type your full legal name as your signature."); return; }
    } else {
      if (!allergies.length && !allergiesOther.trim()) {
        toast.error("Please select your allergies (or 'No known allergies').");
        return;
      }
      if (!meds.length) { toast.error("Please select your medications (or 'None currently')."); return; }
      if (!history.length) { toast.error("Please select your medical history (or 'None')."); return; }
      if (!skinType) { toast.error("Please pick your skin type."); return; }
      if (!emName.trim() || !emPhone.trim()) { toast.error("Emergency contact name + phone are required."); return; }
      if (!hipaaAck || !truthfulAck) { toast.error("Please acknowledge HIPAA and the truthfulness attestation."); return; }
      if (!nppAck) { toast.error("Please acknowledge the Notice of Privacy Practices (NPP)."); return; }
      if (!aiScribeAck) { toast.error("Please acknowledge the AI Scribe consent to continue."); return; }
      if (!sigName.trim()) { toast.error("Please type your full legal name as your signature."); return; }
    }


    setSubmitting(true);
    try {
      const payload: any = checkinMode
        ? {
            submission_kind: "checkin",
            based_on_submission_id: lastFull?.id ?? null,
            has_changes: hasChanges,
            changes_meds: changesMeds,
            changes_allergies: changesAllergies,
            changes_history: changesHistory,
            changes_pregnancy: changesPregnancy,
            recent_illness_or_event: recentIllness,
            // Carry forward last full so chart still has current snapshot
            allergies, allergies_other: allergiesOther,
            current_medications: meds, current_medications_other: medsOther,
            medical_history: history, medical_history_other: historyOther,
            pregnancy_status: pregnancy,
            concerns, goals, recent_treatments: recent,
            truthful_acknowledged: truthfulAck,
            hipaa_acknowledged: true,
            signature_full_name: sigName,
            signature_date: new Date().toISOString().slice(0, 10),
            ai_scribe_consent: aiScribeAck,
            npp_acknowledged: nppAck,

          }
        : {
            submission_kind: "full",
            allergies, allergies_other: allergiesOther,
            current_medications: meds, current_medications_other: medsOther,
            medical_history: history, medical_history_other: historyOther,
            pregnancy_status: pregnancy,
            skin_type: skinType,
            skin_concerns: skinConcerns,
            sun_exposure: sunExposure,
            smoking_status: smoking,
            alcohol_use: alcohol,
            exercise_frequency: exercise,
            skincare_products: skincare,
            prior_cosmetic_procedures: priorProcedures,
            family_history: familyHx,
            social_history: socialHx,
            primary_care_physician: pcp,
            emergency_contact_name: emName,
            emergency_contact_phone: emPhone,
            emergency_contact_relation: emRel,
            concerns, goals, recent_treatments: recent,
            hipaa_acknowledged: hipaaAck,
            truthful_acknowledged: truthfulAck,
            signature_full_name: sigName,
            signature_date: new Date().toISOString().slice(0, 10),
            ai_scribe_consent: aiScribeAck,
            npp_acknowledged: nppAck,

          };

      const res = await fetch(`${SUPABASE_URL}/functions/v1/public-client-intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, payload }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Submission failed"); return; }
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!appt) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6 text-center">
        <div>
          <h1 className="text-xl font-serif mb-2">Intake link not found</h1>
          <p className="text-sm text-muted-foreground">This link may have expired. Please contact us.</p>
        </div>
      </div>
    );
  }

  const apptTime = appt.start_at
    ? new Date(appt.start_at).toLocaleString("en-US", {
        weekday: "long", month: "long", day: "numeric",
        hour: "numeric", minute: "2-digit",
      })
    : "your upcoming visit";

  if (done) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-8 text-center mt-12">
          <CheckCircle2 className="h-12 w-12 text-success-soft-foreground mx-auto mb-3" />
          <h1 className="text-2xl font-serif mb-2">Thank you, {appt.client_first_name}</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Your health history is saved and goes straight to your provider for {apptTime}.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => setDone(false)}>Edit responses</Button>
            <PortalCTA tab="forms" />
          </div>
        </div>
      </div>
    );
  }

  if (checkinMode) {
    const lastDate = lastFull?.submitted_at
      ? new Date(lastFull.submitted_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "your last visit";
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-xl mx-auto space-y-5">
          <header className="text-center">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Radiantilyk Aesthetic</p>
            <h1 className="text-2xl font-serif mt-1">Pre-visit check-in</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Hi {appt.client_first_name}, you're booked for <strong>{appt.services?.name ?? "your treatment"}</strong> on {apptTime}.
            </p>
            <p className="text-[11px] text-muted-foreground mt-2">
              Your full health assessment from <strong>{lastDate}</strong> is on file. Please confirm if anything has changed.
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Confidential — HIPAA & California Civil Code §56
            </p>
          </header>

          <Section title="Has anything changed since your last visit?" required>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setHasChanges(false)}
                className={`text-sm rounded-full border px-3 py-3 transition ${hasChanges === false ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}>
                No — nothing has changed
              </button>
              <button type="button" onClick={() => setHasChanges(true)}
                className={`text-sm rounded-full border px-3 py-3 transition ${hasChanges === true ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}>
                Yes — something has changed
              </button>
            </div>
          </Section>

          {hasChanges === true && (
            <>
              <Section title="New or changed medications / supplements">
                <Textarea rows={2} maxLength={500} placeholder="List any new, stopped, or changed meds (incl. blood thinners, GLP-1, hormones)" value={changesMeds} onChange={e => setChangesMeds(e.target.value)} />
              </Section>
              <Section title="New allergies or reactions">
                <Textarea rows={2} maxLength={500} placeholder="Any new allergies or reactions since last visit?" value={changesAllergies} onChange={e => setChangesAllergies(e.target.value)} />
              </Section>
              <Section title="New medical history / diagnoses">
                <Textarea rows={2} maxLength={500} placeholder="Any new conditions, surgeries, hospitalizations, or treatments?" value={changesHistory} onChange={e => setChangesHistory(e.target.value)} />
              </Section>
              <Section title="Pregnancy / breastfeeding status change">
                <Input placeholder="e.g. Currently pregnant, breastfeeding, trying to conceive" value={changesPregnancy} onChange={e => setChangesPregnancy(e.target.value)} />
              </Section>
            </>
          )}

          <Section title="Recent illness or events (last 2 weeks)">
            <Textarea rows={2} maxLength={500} placeholder="Cold, fever, dental work, vaccines, sun exposure, recent injectables…" value={recentIllness} onChange={e => setRecentIllness(e.target.value)} />
          </Section>

          <Section title="Today's concerns or goals (optional)">
            <Textarea rows={2} maxLength={500} placeholder="Anything you want your provider to know for this visit" value={concerns} onChange={e => setConcerns(e.target.value)} />
          </Section>

          <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Confirm & sign *</Label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={truthfulAck} onCheckedChange={(v) => setTruthfulAck(!!v)} className="mt-0.5" />
              <span>I attest the information on file from {lastDate} remains accurate except for what I've noted above, to the best of my knowledge.</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={nppAck} onCheckedChange={(v) => setNppAck(!!v)} className="mt-0.5" />
              <span>I acknowledge that I have received and reviewed the <a href="/privacy" target="_blank" className="underline text-primary hover:text-primary/80">Notice of Privacy Practices (NPP)</a>.</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={aiScribeAck} onCheckedChange={(v) => setAiScribeAck(!!v)} className="mt-0.5" />
              <span>
                <strong>AI Scribe consent (required, valid 12 months):</strong> I consent to Radiantilyk Aesthetic using an AI-assisted medical scribe to audio-record my visit conversation for the sole purpose of drafting my clinical chart. Recordings are encrypted, reviewed and signed by my licensed provider, kept confidential under HIPAA & California Civil Code §56, and auto-deleted within 30 days. I may ask my provider to pause or stop recording at any time during the visit (California two-party consent, Cal. Penal Code §632).
              </span>
            </label>

            <div>
              <Label className="text-xs text-muted-foreground">Type your full legal name as your electronic signature</Label>
              <Input className="mt-1" placeholder="First and last name" value={sigName} onChange={e => setSigName(e.target.value)} />
              <p className="text-[11px] text-muted-foreground mt-1">
                Signed electronically on {new Date().toLocaleDateString()} (California UETA / federal E-SIGN Act).
              </p>
            </div>
          </section>

          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-t border-border">
            <Button className="w-full rounded-full h-12" onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit check-in
            </Button>
            <button type="button" onClick={() => { setCheckinMode(false); setHasChanges(null); }}
              className="block mx-auto mt-2 text-[11px] text-muted-foreground underline">
              Complete a full health assessment instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-xl mx-auto space-y-5">
        <header className="text-center">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Radiantilyk Aesthetic</p>
          <h1 className="text-2xl font-serif mt-1">Patient health assessment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hi {appt.client_first_name}, you're booked for <strong>{appt.services?.name ?? "your treatment"}</strong> on {apptTime}.
          </p>
          <p className="text-[11px] text-muted-foreground mt-2 flex items-center justify-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Confidential — protected under HIPAA & California Civil Code §56
          </p>
        </header>

        <Section title="Allergies" required>
          <Chips options={ALLERGY_OPTIONS} value={allergies} onToggle={(v) => toggle(setAllergies, allergies, v)} />
          <Input className="mt-2" placeholder="Other allergies (optional)" value={allergiesOther} onChange={e => setAllergiesOther(e.target.value)} />
        </Section>

        <Section title="Current medications & supplements" required>
          <Chips options={MED_OPTIONS} value={meds} onToggle={(v) => toggle(setMeds, meds, v)} />
          <Input className="mt-2" placeholder="Other medications (optional)" value={medsOther} onChange={e => setMedsOther(e.target.value)} />
        </Section>

        <Section title="Medical history" required>
          <Chips options={HISTORY_OPTIONS} value={history} onToggle={(v) => toggle(setHistory, history, v)} />
          <Input className="mt-2" placeholder="Other conditions (optional)" value={historyOther} onChange={e => setHistoryOther(e.target.value)} />
        </Section>

        <Section title="Family history">
          <Chips options={FAMILY_HX} value={familyHx} onToggle={(v) => toggle(setFamilyHx, familyHx, v)} />
        </Section>

        <Section title="Pregnancy status">
          <SingleChips options={PREGNANCY} value={pregnancy} onChange={setPregnancy} cols={2} />
        </Section>

        <Section title="Fitzpatrick skin type" required>
          <SingleChips options={SKIN_TYPE} value={skinType} onChange={setSkinType} cols={1} />
        </Section>

        <Section title="Primary skin concerns">
          <Chips options={SKIN_CONCERNS} value={skinConcerns} onToggle={(v) => toggle(setSkinConcerns, skinConcerns, v)} />
        </Section>

        <Section title="Sun exposure">
          <SingleChips options={SUN_EXPOSURE} value={sunExposure} onChange={setSunExposure} cols={2} />
        </Section>

        <Section title="Smoking">
          <SingleChips options={SMOKING} value={smoking} onChange={setSmoking} cols={2} />
        </Section>

        <Section title="Alcohol use">
          <SingleChips options={ALCOHOL} value={alcohol} onChange={setAlcohol} cols={2} />
        </Section>

        <Section title="Exercise frequency">
          <SingleChips options={EXERCISE} value={exercise} onChange={setExercise} cols={2} />
        </Section>

        <Section title="Current skincare routine">
          <Chips options={SKINCARE} value={skincare} onToggle={(v) => toggle(setSkincare, skincare, v)} />
        </Section>

        <Section title="Prior cosmetic procedures">
          <Chips options={PRIOR_PROCEDURES} value={priorProcedures} onToggle={(v) => toggle(setPriorProcedures, priorProcedures, v)} />
        </Section>

        <Section title="Social history">
          <Chips options={SOCIAL_HX} value={socialHx} onToggle={(v) => toggle(setSocialHx, socialHx, v)} />
        </Section>

        <Section title="Primary care physician">
          <Input placeholder="Dr. name & city (optional)" value={pcp} onChange={e => setPcp(e.target.value)} />
        </Section>

        <Section title="Emergency contact" required>
          <div className="grid grid-cols-1 gap-2">
            <Input placeholder="Full name" value={emName} onChange={e => setEmName(e.target.value)} />
            <Input placeholder="Phone number" inputMode="tel" value={emPhone} onChange={e => setEmPhone(e.target.value)} />
            <Input placeholder="Relationship (spouse, parent, friend…)" value={emRel} onChange={e => setEmRel(e.target.value)} />
          </div>
        </Section>

        <Section title="What brings you in?">
          <Textarea maxLength={500} placeholder="Briefly describe your main concerns" value={concerns} onChange={e => setConcerns(e.target.value)} rows={3} />
        </Section>

        <Section title="Your goals for this visit">
          <Textarea maxLength={500} placeholder="Desired outcome" value={goals} onChange={e => setGoals(e.target.value)} rows={3} />
        </Section>

        <Section title="Recent aesthetic treatments (last 6 mo)">
          <Textarea maxLength={500} placeholder="e.g. Botox 6 weeks ago, filler 3 months ago" value={recent} onChange={e => setRecent(e.target.value)} rows={2} />
        </Section>

        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Acknowledgements & signature *</Label>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={hipaaAck} onCheckedChange={(v) => setHipaaAck(!!v)} className="mt-0.5" />
            <span>I authorize Radiantilyk Aesthetic to use my health information for treatment, payment, and operations as permitted by HIPAA and California Civil Code §56 (Confidentiality of Medical Information Act).</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={nppAck} onCheckedChange={(v) => setNppAck(!!v)} className="mt-0.5" />
            <span>I acknowledge that I have received and reviewed the <a href="/privacy" target="_blank" className="underline text-primary hover:text-primary/80">Notice of Privacy Practices (NPP)</a>.</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={truthfulAck} onCheckedChange={(v) => setTruthfulAck(!!v)} className="mt-0.5" />
            <span>I attest that the information above is true and complete to the best of my knowledge. I understand that omissions or inaccuracies may affect my safety and the outcome of my treatment.</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={aiScribeAck} onCheckedChange={(v) => setAiScribeAck(!!v)} className="mt-0.5" />
            <span>
              <strong>AI Scribe consent (required, valid 12 months):</strong> I consent to Radiantilyk Aesthetic using an AI-assisted medical scribe to audio-record my visit conversation for the sole purpose of drafting my clinical chart. Recordings are encrypted, reviewed and signed by my licensed provider, kept confidential under HIPAA & California Civil Code §56, and auto-deleted within 30 days. I may ask my provider to pause or stop recording at any time during the visit (California two-party consent, Cal. Penal Code §632).
            </span>
          </label>

          <div>
            <Label className="text-xs text-muted-foreground">Type your full legal name as your electronic signature</Label>
            <Input className="mt-1" placeholder="First and last name" value={sigName} onChange={e => setSigName(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">
              Signed electronically on {new Date().toLocaleDateString()} (California UETA / federal E-SIGN Act).
            </p>
          </div>
        </section>

        <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-t border-border">
          <Button className="w-full rounded-full h-12" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Submit health assessment
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Your responses are private and go directly to your clinical chart.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, required }: { title: string; children: React.ReactNode; required?: boolean }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">
        {title}{required ? " *" : ""}
      </Label>
      {children}
    </section>
  );
}

function Chips({ options, value, onToggle }: { options: string[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" onClick={() => onToggle(o)}
            className={`text-xs rounded-full border px-3 py-1.5 transition ${
              on ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:border-primary/50"
            }`}
          >{o}</button>
        );
      })}
    </div>
  );
}

function SingleChips({ options, value, onChange, cols = 2 }: { options: string[]; value: string; onChange: (v: string) => void; cols?: number }) {
  return (
    <div className={`grid gap-2 ${cols === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {options.map(o => (
        <button key={o} type="button"
          onClick={() => onChange(o)}
          className={`text-xs rounded-full border px-3 py-2 text-left transition ${
            value === o ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"
          }`}
        >{o}</button>
      ))}
    </div>
  );
}
