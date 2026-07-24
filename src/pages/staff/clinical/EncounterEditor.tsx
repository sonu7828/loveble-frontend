import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
const supabase = supabaseTyped as any;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, FileText, Loader2, ExternalLink, ShieldCheck,
} from "lucide-react";
import { MiniSignaturePad } from "@/components/clinical/MiniSignaturePad";
import { CATEGORY_OPTIONS, ENCOUNTER_PRESETS, type Category, type RxPreset } from "@/lib/encounterPresets";
import { findLabRange, classifyLab } from "@/lib/labRanges";
import AcneGuidedTool from "@/components/clinical/AcneGuidedTool";
import { EMPTY_ACNE, decodeStateFrom, encodeStateInto, stripState, type AcneState } from "@/lib/acneEngine";

type VisitType = "new" | "follow_up";

type LabRow = { id?: string; analyte: string; value: string; unit: string; drawn_on: string; source: "prior" | "ordered_today"; notes?: string };
type RxRow = RxPreset & { id?: string };
type FollowUp = {
  tolerability: string;
  adverse_events: string;
  objective_deltas: string;
  decision: "increase" | "decrease" | "continue" | "discontinue" | "switch" | "";
  rationale: string;
};

export default function EncounterEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const isNew = id === "new" || !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);

  const [encounterId, setEncounterId] = useState<string | null>(isNew ? null : id!);
  const [status, setStatus] = useState<"draft" | "signed">("draft");

  // Patient
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [first, setFirst] = useState(params.get("first") ?? "");
  const [last, setLast] = useState(params.get("last") ?? "");
  const [dob, setDob] = useState(params.get("dob") ?? "");

  // Visit
  const [visitType, setVisitType] = useState<VisitType>("new");
  const [category, setCategory] = useState<Category>("glp1");

  const preset = useMemo(() => ENCOUNTER_PRESETS[category], [category]);

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [counselingAck, setCounselingAck] = useState(false);
  const [necessity, setNecessity] = useState("");

  // Structured chip selections (litigation-tight: no free-text)
  const [subjChips, setSubjChips] = useState<string[]>([]);
  const [planChips, setPlanChips] = useState<string[]>([]);
  const [aeChips, setAeChips] = useState<string[]>([]);
  const [deltaChips, setDeltaChips] = useState<string[]>([]);
  const [rationaleChips, setRationaleChips] = useState<string[]>([]);
  const [vitals, setVitals] = useState({ bp: "", hr: "", wt: "", ht: "", bmi: "" });

  const [labs, setLabs] = useState<LabRow[]>([]);
  const [labsMode, setLabsMode] = useState<"order" | "enter" | null>(null);
  const [rx, setRx] = useState<RxRow[]>([]);
  const [followup, setFollowup] = useState<FollowUp>({
    tolerability: "", adverse_events: "", objective_deltas: "", decision: "", rationale: "",
  });

  const [signerName, setSignerName] = useState("");
  const [signerLicense, setSignerLicense] = useState("");
  const [signaturePng, setSignaturePng] = useState("");

  const [pdfs, setPdfs] = useState<{ clinical_pdf_url: string | null; handout_pdf_url: string | null } | null>(null);

  // Acne guided tool state (only used when category === 'acne')
  const [acne, setAcne] = useState<AcneState>(EMPTY_ACNE);
  const [acneDerived, setAcneDerived] = useState<{
    subjective: string; objective: string; assessment: string; plan: string;
    prescriptions: RxPreset[]; labs: Array<{ analyte: string; value: string; unit: string; source: "prior" | "ordered_today" }>; necessity: string;
  } | null>(null);

  // Generic structured-rationale / delta dictionaries (used in follow-up)
  const DELTA_OPTIONS = [
    "↓ Weight ≥ 5%", "↓ Weight 2–5%", "Weight unchanged", "↑ Weight",
    "↓ BP", "BP unchanged", "↑ BP",
    "Labs improved", "Labs unchanged", "Labs worsened",
    "Lean mass preserved",
  ];
  const RATIONALE_OPTIONS = [
    "Tolerating well — continue per plan.",
    "Partial response — escalate to next dose.",
    "GI symptoms — hold escalation × 4 weeks.",
    "Plateau — increase intensity / add adjunct.",
    "Adverse effects — reduce dose.",
    "Adverse effects — switch class.",
    "Patient request — discontinue.",
    "Lab abnormality — pause and recheck.",
  ];

  // Auto-compose narrative strings from chip selections
  useEffect(() => { if (subjChips.length) setSubjective(subjChips.join(" ")); }, [subjChips]);
  useEffect(() => { if (planChips.length) setPlan(planChips.join(" ")); }, [planChips]);
  useEffect(() => {
    if (!aeChips.length && !deltaChips.length && !rationaleChips.length) return;
    setFollowup(f => ({
      ...f,
      adverse_events: aeChips.join("; ") || f.adverse_events,
      objective_deltas: deltaChips.join("; ") || f.objective_deltas,
      rationale: rationaleChips.join(" ") || f.rationale,
    }));
  }, [aeChips, deltaChips, rationaleChips]);
  useEffect(() => {
    const parts = [
      vitals.bp && `BP ${vitals.bp}`,
      vitals.hr && `HR ${vitals.hr}`,
      vitals.wt && `Wt ${vitals.wt} lb`,
      vitals.ht && `Ht ${vitals.ht} in`,
      vitals.bmi && `BMI ${vitals.bmi}`,
    ].filter(Boolean).join(", ");
    if (!parts && objective) return; // preserve loaded text until user enters vitals
    setObjective(parts ? `${parts}. ${preset.objectiveTemplate}` : preset.objectiveTemplate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vitals, preset]);

  // Apply preset on category change for fresh encounter — locked assessment + necessity
  useEffect(() => {
    if (!isNew || status === "signed") return;
    setAssessment(preset.assessmentTemplate);
    setNecessity(preset.necessityAttestation);
    setSubjChips([]); setPlanChips([]); setAeChips([]); setDeltaChips([]); setRationaleChips([]);
    setVitals({ bp: "", hr: "", wt: "", ht: "", bmi: "" });
  }, [category, isNew, status, preset]);

  // Auto-populate DOB from client_profiles when starting a new encounter without one
  useEffect(() => {
    if (!isNew) return;
    if (dob) return;
    if (!email) return;
    let cancelled = false;
    (async () => {
      const { data: cp } = await supabase
        .from("client_profiles")
        .select("dob")
        .ilike("email", email)
        .maybeSingle();
      if (!cancelled && cp?.dob) setDob(cp.dob);
    })();
    return () => { cancelled = true; };
  }, [isNew, email, dob]);

  const toggle = (arr: string[], v: string) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  // Load existing
  useEffect(() => {
    if (isNew) return;
    (async () => {
      const { data: enc, error } = await supabase.from("clinical_encounters").select("*").eq("id", id).maybeSingle();
      if (error || !enc) { toast.error("Encounter not found"); navigate(-1); return; }
      setEncounterId(enc.id);
      setStatus(enc.status);
      setEmail(enc.client_email); setFirst(enc.client_first_name); setLast(enc.client_last_name);
      setDob(enc.client_dob ?? "");
      setVisitType(enc.visit_type); setCategory(enc.category);
      setChiefComplaint(enc.chief_complaint ?? "");
      const decoded = decodeStateFrom(enc.subjective);
      if (decoded) setAcne(decoded);
      setSubjective(stripState(enc.subjective));
      setObjective(enc.objective ?? ""); setAssessment(enc.assessment ?? "");
      setPlan(enc.plan ?? ""); setCounselingAck(!!enc.counseling_acknowledged);
      setNecessity(enc.necessity_attestation ?? "");
      setSignerName(enc.signed_by_name ?? ""); setSignerLicense(enc.signed_by_license ?? "");
      setSignaturePng(enc.signature_png ?? "");
      setPdfs({ clinical_pdf_url: enc.clinical_pdf_url, handout_pdf_url: enc.handout_pdf_url });

      const [{ data: labsRows }, { data: rxRows }, { data: fuRows }] = await Promise.all([
        supabase.from("clinical_encounter_labs").select("*").eq("encounter_id", enc.id),
        supabase.from("clinical_encounter_prescriptions").select("*").eq("encounter_id", enc.id),
        supabase.from("clinical_encounter_followups").select("*").eq("encounter_id", enc.id).maybeSingle(),
      ]);
      setLabs((labsRows ?? []).map((l: any) => ({ ...l, drawn_on: l.drawn_on ?? "" })));
      setRx((rxRows ?? []).map((r: any) => ({ ...r })));
      if (fuRows) setFollowup({
        tolerability: fuRows.tolerability ?? "", adverse_events: fuRows.adverse_events ?? "",
        objective_deltas: fuRows.objective_deltas ?? "", decision: fuRows.decision ?? "",
        rationale: fuRows.rationale ?? "",
      });
      setLoading(false);
    })();
  }, [id, isNew, navigate]);

  function addLabsFromPreset() {
    const existing = new Set(labs.map(l => l.analyte.toLowerCase()));
    const adds = preset.recommendedLabs
      .filter(a => !existing.has(a.toLowerCase()))
      .map(a => ({ analyte: a, value: "", unit: "", drawn_on: "", source: "ordered_today" as const }));
    setLabs([...labs, ...adds]);
  }

  function addBlankLab() { setLabs([...labs, { analyte: "", value: "", unit: "", drawn_on: "", source: "prior" }]); }
  function removeLab(i: number) { setLabs(labs.filter((_, idx) => idx !== i)); }
  function updateLab(i: number, patch: Partial<LabRow>) { setLabs(labs.map((l, idx) => idx === i ? { ...l, ...patch } : l)); }

  function addRxPreset(p: RxPreset) { setRx([...rx, { ...p }]); }
  function addBlankRx() {
    setRx([...rx, { drug: "", strength: "", route: "", frequency: "", duration: "", dispense: "", refills: 0, titration: [] }]);
  }
  function removeRx(i: number) { setRx(rx.filter((_, idx) => idx !== i)); }
  function updateRx(i: number, patch: Partial<RxRow>) { setRx(rx.map((r, idx) => idx === i ? { ...r, ...patch } : r)); }

  async function persistChildren(encId: string) {
    const isAcne = category === "acne";
    const effectiveLabs = isAcne && acneDerived
      ? acneDerived.labs.map(l => ({ analyte: l.analyte, value: l.value, unit: l.unit, drawn_on: "", source: l.source }))
      : labs;
    const effectiveRx = isAcne && acneDerived ? acneDerived.prescriptions : rx;

    // CRITICAL: check every delete + insert. Previously, a transient network
    // error on the insert side silently wiped the encounter's labs / Rx.
    const labRows = effectiveLabs
      .filter((l: any) => l.analyte && l.analyte.trim())
      .map((l: any) => ({
        encounter_id: encId, analyte: l.analyte, value: l.value || null, unit: l.unit || null,
        drawn_on: l.drawn_on || null, source: l.source, notes: l.notes || null,
      }));
    const { error: labDelErr } = await supabase.from("clinical_encounter_labs").delete().eq("encounter_id", encId);
    if (labDelErr) throw new Error(`Could not clear previous labs: ${labDelErr.message}`);
    if (labRows.length) {
      const { error: labInsErr } = await supabase.from("clinical_encounter_labs").insert(labRows);
      if (labInsErr) throw new Error(`Could not save labs: ${labInsErr.message}`);
    }

    const rxRows = effectiveRx
      .filter((r: any) => r.drug && r.drug.trim())
      .map((r: any) => ({
        encounter_id: encId, drug: r.drug, strength: r.strength || null, route: r.route || null,
        frequency: r.frequency || null, duration: r.duration || null, dispense: r.dispense || null,
        refills: r.refills ?? 0, titration: r.titration ?? [], notes: r.notes || null,
      }));
    const { error: rxDelErr } = await supabase.from("clinical_encounter_prescriptions").delete().eq("encounter_id", encId);
    if (rxDelErr) throw new Error(`Could not clear previous prescriptions: ${rxDelErr.message}`);
    if (rxRows.length) {
      const { error: rxInsErr } = await supabase.from("clinical_encounter_prescriptions").insert(rxRows);
      if (rxInsErr) throw new Error(`Could not save prescriptions: ${rxInsErr.message}`);
    }

    if (visitType === "follow_up" && !isAcne) {
      const { error: fuDelErr } = await supabase.from("clinical_encounter_followups").delete().eq("encounter_id", encId);
      if (fuDelErr) throw new Error(`Could not clear previous follow-up: ${fuDelErr.message}`);
      const { error: fuInsErr } = await supabase.from("clinical_encounter_followups").insert({
        encounter_id: encId,
        tolerability: followup.tolerability || null,
        adverse_events: followup.adverse_events || null,
        objective_deltas: followup.objective_deltas || null,
        decision: followup.decision || null,
        rationale: followup.rationale || null,
      });
      if (fuInsErr) throw new Error(`Could not save follow-up: ${fuInsErr.message}`);
    }
  }

  async function saveDraft(silent = false): Promise<string | null> {
    if (!email || !first || !last) { toast.error("Patient email and name are required"); return null; }
    setSaving(true);
    const isAcne = category === "acne";
    const subjForSave = isAcne
      ? encodeStateInto(acneDerived?.subjective ?? "", acne)
      : (subjective || null);
    const payload = {
      visit_type: visitType, category, client_email: email.toLowerCase().trim(),
      client_first_name: first, client_last_name: last, client_dob: dob || null,
      chief_complaint: chiefComplaint || null,
      subjective: subjForSave,
      objective: isAcne ? (acneDerived?.objective || null) : (objective || null),
      assessment: isAcne ? (acneDerived?.assessment || null) : (assessment || null),
      plan: isAcne ? (acneDerived?.plan || null) : (plan || null),
      counseling_acknowledged: isAcne ? true : counselingAck,
      necessity_attestation: isAcne ? (acneDerived?.necessity || null) : (necessity || null),
    };
    let encId = encounterId;
    if (!encId) {
      const { data, error } = await supabase.from("clinical_encounters").insert(payload).select("id").maybeSingle();
      if (error || !data) { setSaving(false); toast.error(error?.message ?? "Save failed"); return null; }
      encId = data.id; setEncounterId(encId);
      window.history.replaceState(null, "", `/staff/clinical/encounters/${encId}`);
    } else {
      const { error } = await supabase.from("clinical_encounters").update(payload).eq("id", encId);
      if (error) { setSaving(false); toast.error(error.message); return null; }
    }
    try {
      await persistChildren(encId!);
    } catch (e: any) {
      setSaving(false);
      toast.error(e?.message ?? "Could not save encounter details");
      return null;
    }
    setSaving(false);
    if (!silent) toast.success("Draft saved");
    return encId;
  }

  async function signAndGenerate() {
    if (!signerName.trim() || !signaturePng) { toast.error("Sign and type your name to attest"); return; }
    if (!counselingAck) { toast.error("Confirm counseling was reviewed with the patient"); return; }
    const encId = await saveDraft(true);
    if (!encId) return;
    setSigning(true);
    // Mark signed in DB
    const { error: uErr } = await supabase.from("clinical_encounters").update({
      status: "signed",
      signed_by_name: signerName, signed_by_license: signerLicense || null,
      signature_png: signaturePng, signed_at: new Date().toISOString(),
    }).eq("id", encId);
    if (uErr) { setSigning(false); toast.error(uErr.message); return; }
    // Generate PDFs
    const { data, error } = await supabase.functions.invoke("generate-encounter-pdf", { body: { encounter_id: encId } });
    setSigning(false);
    if (error) { toast.error(error.message); return; }
    const r = data as any;
    if (r?.error) { toast.error(r.error); return; }
    setStatus("signed");
    setPdfs({ clinical_pdf_url: r?.clinical_pdf_url ?? null, handout_pdf_url: r?.handout_pdf_url ?? null });
    toast.success("Signed. PDFs generated and attached to chart.");
  }

  if (loading) {
    return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const readOnly = status === "signed";

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-32 space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant={readOnly ? "default" : "secondary"}>{readOnly ? "Signed" : "Draft"}</Badge>
          {!readOnly && <Button variant="outline" size="sm" onClick={() => saveDraft()} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save draft"}</Button>}
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{readOnly ? "Visit note" : (isNew ? (visitType === "follow_up" ? "New follow-up visit" : "New protocol visit") : (visitType === "follow_up" ? "Edit follow-up visit" : "Edit visit"))}</h1>
        <p className="text-sm text-muted-foreground">Patient-specific encounter — auto-fills patient info, recommended labs, evidence-based Rx.</p>
      </div>

      {/* Visit type */}
      <Card>
        <CardHeader><CardTitle className="text-base">Visit</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(["new","follow_up"] as VisitType[]).map(v => (
              <button key={v} type="button" disabled={readOnly}
                onClick={() => setVisitType(v)}
                className={`rounded-lg border px-4 py-3 text-left transition ${visitType === v ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border hover:border-primary/40"}`}>
                <div className="font-medium">{v === "new" ? "New visit" : "Follow-up"}</div>
                <div className="text-xs text-muted-foreground">{v === "new" ? "Initial workup + Rx" : "Reassess, titrate, continue/stop"}</div>
              </button>
            ))}
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Category</Label>
            <select disabled={readOnly} value={category} onChange={e => setCategory(e.target.value as Category)}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Bookable with Kiem only.</p>
          </div>
        </CardContent>
      </Card>

      {/* Patient */}
      <Card>
        <CardHeader><CardTitle className="text-base">Patient</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>First name</Label><Input value={first} disabled={readOnly} onChange={e => setFirst(e.target.value)} /></div>
          <div><Label>Last name</Label><Input value={last} disabled={readOnly} onChange={e => setLast(e.target.value)} /></div>
          <div><Label>Email</Label><Input value={email} disabled={readOnly} onChange={e => setEmail(e.target.value)} /></div>
          <div><Label>DOB</Label><Input type="date" value={dob} disabled={readOnly} onChange={e => setDob(e.target.value)} /></div>
          <div className="md:col-span-2">
            <Label>Chief complaint</Label>
            <select disabled={readOnly} value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">— Select chief complaint —</option>
              {preset.chiefComplaintOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>


      {category === "acne" ? (
        <>
          <AcneGuidedTool value={acne} onChange={setAcne} onDerived={setAcneDerived} readOnly={readOnly} />
          {/* Output: Prescription + SOAP */}
          {acneDerived && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-primary">OUTPUT</div>
                  <CardTitle className="text-xl font-serif">Prescription</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm font-mono bg-secondary/30 p-3 rounded">{
                    [
                      "Radiantilyk Aesthetic — Provider Rx",
                      "San Mateo, 1528 S El Camino Real, Unit 200",
                      "San Jose, 2100 Curtner Ave, Unit 1B, San Jose CA 95124",
                      `Provider: ${signerName || "—"}`,
                      `Patient: ${first} ${last}`,
                      `Date: ${new Date().toLocaleDateString()}`,
                      "",
                      ...acneDerived.prescriptions.map(p =>
                        `Rx: ${p.drug} ${p.strength}\nSig: ${p.frequency}\nQty: ${p.dispense}    Refills: ${p.refills}\nDuration: ${p.duration}${p.notes ? `\nNotes: ${p.notes}` : ""}`
                      ),
                      "",
                      "Clinician decision support only. Final medical judgement remains with the licensed provider.",
                    ].join("\n")
                  }</pre>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-primary">OUTPUT</div>
                  <CardTitle className="text-xl font-serif">SOAP / HPI</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm font-mono bg-secondary/30 p-3 rounded">{
                    [
                      `Provider: ${signerName || "—"}    Date: ${new Date().toLocaleString()}`,
                      "",
                      `S: ${acneDerived.subjective || "—"}`,
                      `O: ${acneDerived.objective || "—"}`,
                      `A: ${acneDerived.assessment || "—"}`,
                      `P: ${acneDerived.plan || "—"}`,
                    ].join("\n")
                  }</pre>
                </CardContent>
              </Card>
            </>
          )}
        </>
      ) : (
      <>
      {/* Labs — order today OR enter prior values */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Labs</CardTitle>
          <p className="text-xs text-muted-foreground">
            Choose whether to order today's panel or enter lab values the patient already has.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Mode toggle */}
          <div>
            <Label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">How are we handling labs?</Label>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={readOnly}
                onClick={() => setLabsMode("order")}
                className={`text-sm rounded-full border px-3.5 py-2 transition ${labsMode === "order" ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-card hover:border-primary/40"}`}>
                Order labs today
              </button>
              <button type="button" disabled={readOnly}
                onClick={() => {
                  setLabsMode("enter");
                  // Prepopulate recommended labs as empty prior rows if none exist yet
                  const existing = new Set(
                    labs.filter(l => l.source === "prior").map(l => l.analyte.toLowerCase())
                  );
                  const adds = preset.recommendedLabs
                    .filter(a => !existing.has(a.toLowerCase()))
                    .map(a => ({ analyte: a, value: "", unit: "", drawn_on: "", source: "prior" as const }));
                  if (adds.length) setLabs([...labs, ...adds]);
                }}
                className={`text-sm rounded-full border px-3.5 py-2 transition ${labsMode === "enter" ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-card hover:border-primary/40"}`}>
                I already have labs
              </button>
            </div>
          </div>

          {/* Order today — chip select from recommended panel */}
          {labsMode === "order" && (
            <div>
              <Label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
                Order today — {preset.label} recommended panel
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {preset.recommendedLabs.map((a) => {
                  const idx = labs.findIndex(l => l.analyte.toLowerCase() === a.toLowerCase() && l.source === "ordered_today");
                  const on = idx >= 0;
                  return (
                    <button key={a} type="button" disabled={readOnly}
                      onClick={() => {
                        if (on) setLabs(labs.filter((_, i) => i !== idx));
                        else setLabs([...labs, { analyte: a, value: "", unit: "", drawn_on: "", source: "ordered_today" }]);
                      }}
                      className={`text-xs rounded-full border px-2.5 py-1 transition ${on ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-secondary/40 hover:border-primary/40"}`}>
                      {on ? "✓ " : "+ "}{a}
                    </button>
                  );
                })}
              </div>
              {!readOnly && (
                <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={addLabsFromPreset}>
                  Select all recommended
                </Button>
              )}
            </div>
          )}

          {/* Prior values — entry rows */}
          {labsMode === "enter" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Prior lab values</Label>
                {!readOnly && (
                  <Button variant="outline" size="sm" onClick={addBlankLab}><Plus className="h-3 w-3 mr-1" />Prior value</Button>
                )}
              </div>
              {labs.filter(l => l.source === "prior").length === 0 && (
                <p className="text-xs text-muted-foreground">No prior values entered.</p>
              )}
              {labs.map((l, i) => {
                if (l.source !== "prior") return null;
                const isKnown = preset.recommendedLabs.includes(l.analyte);
                const refRange = findLabRange(l.analyte);
                const classified = classifyLab(l.analyte, l.value);
                const statusColor =
                  classified?.status === "red" ? "bg-destructive/10 text-destructive border-destructive/40"
                  : classified?.status === "yellow" ? "bg-warning/15 text-warning-soft-foreground dark:text-warning border-warning"
                  : classified?.status === "green" ? "bg-success/15 text-success-soft-foreground dark:text-success border-success"
                  : "";
                const statusLabel = classified?.status === "red" ? "Out of range"
                  : classified?.status === "yellow" ? "Borderline"
                  : classified?.status === "green" ? "Within range" : "";
                return (
                  <div key={i} className="rounded border border-border p-2 mb-2">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <select className="col-span-12 md:col-span-3 h-10 rounded-md border border-input bg-background px-2 text-sm" disabled={readOnly}
                        value={isKnown ? l.analyte : (l.analyte ? "__custom" : "")}
                        onChange={e => {
                          const a = e.target.value === "__custom" ? "" : e.target.value;
                          const r = findLabRange(a);
                          updateLab(i, { analyte: a, unit: r ? r.unit : l.unit });
                        }}>
                        <option value="">— Analyte —</option>
                        {preset.recommendedLabs.map(a => <option key={a} value={a}>{a}</option>)}
                        <option value="__custom">Other…</option>
                      </select>
                      {!isKnown && (
                        <Input className="col-span-12 md:col-span-3" placeholder="Custom analyte" value={l.analyte} disabled={readOnly} onChange={e => updateLab(i, { analyte: e.target.value })} />
                      )}
                      <Input className="col-span-5 md:col-span-2" inputMode="decimal" placeholder="Value" value={l.value} disabled={readOnly} onChange={e => updateLab(i, { value: e.target.value })} />
                      <Input className="col-span-3 md:col-span-1" placeholder="Unit" value={l.unit} disabled={readOnly} onChange={e => updateLab(i, { unit: e.target.value })} />
                      <Input className="col-span-4 md:col-span-2" type="date" value={l.drawn_on} disabled={readOnly} onChange={e => updateLab(i, { drawn_on: e.target.value })} />
                      {!readOnly && <Button variant="ghost" size="icon" className="col-span-12 md:col-span-1 justify-self-end" onClick={() => removeLab(i)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                    {(refRange || classified) && (
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap pl-1">
                        {refRange && (
                          <span className="text-[11px] text-muted-foreground">{refRange.hint}</span>
                        )}
                        {classified && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusColor}`}>
                            {statusLabel}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SOAP — chip & vitals driven, no free-text */}
      <Card>
        <CardHeader><CardTitle className="text-base">Subjective / Objective / Assessment</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Subjective (HPI / ROS) — tap to include</Label>
            <div className="flex flex-wrap gap-1.5">
              {preset.subjectiveChips.map((c, i) => {
                const on = subjChips.includes(c);
                return (
                  <button key={i} type="button" disabled={readOnly}
                    onClick={() => setSubjChips(arr => toggle(arr, c))}
                    className={`text-xs rounded-full border px-2.5 py-1 transition ${on ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-secondary/40 hover:border-primary/40"}`}>
                    {on ? "✓ " : "+ "}{c}
                  </button>
                );
              })}
            </div>
            {subjective && <div className="mt-2 rounded bg-secondary/30 p-2.5 text-xs leading-relaxed">{subjective}</div>}
          </div>

          <div>
            <Label className="mb-2 block">Objective — vitals + standard exam</Label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div><Label className="text-[10px] tracking-widest text-muted-foreground">BP</Label><Input placeholder="120/80" value={vitals.bp} disabled={readOnly} onChange={e => setVitals(v => ({ ...v, bp: e.target.value }))} /></div>
              <div><Label className="text-[10px] tracking-widest text-muted-foreground">HR</Label><Input placeholder="72" value={vitals.hr} disabled={readOnly} onChange={e => setVitals(v => ({ ...v, hr: e.target.value }))} /></div>
              <div><Label className="text-[10px] tracking-widest text-muted-foreground">Wt (lb)</Label><Input placeholder="180" value={vitals.wt} disabled={readOnly} onChange={e => setVitals(v => ({ ...v, wt: e.target.value }))} /></div>
              <div><Label className="text-[10px] tracking-widest text-muted-foreground">Ht (in)</Label><Input placeholder="66" value={vitals.ht} disabled={readOnly} onChange={e => setVitals(v => ({ ...v, ht: e.target.value }))} /></div>
              <div><Label className="text-[10px] tracking-widest text-muted-foreground">BMI</Label><Input placeholder="29.1" value={vitals.bmi} disabled={readOnly} onChange={e => setVitals(v => ({ ...v, bmi: e.target.value }))} /></div>
            </div>
            <div className="mt-2 rounded bg-secondary/30 p-2.5 text-xs leading-relaxed">{objective}</div>
          </div>

          <div>
            <Label className="mb-2 block flex items-center gap-2">Assessment <Badge variant="outline" className="text-[10px]">Locked template</Badge></Label>
            <div className="rounded bg-secondary/30 p-2.5 text-xs leading-relaxed whitespace-pre-wrap">{assessment}</div>
          </div>
        </CardContent>
      </Card>

      {/* Follow-up specific — chip-driven */}
      {visitType === "follow_up" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Follow-up assessment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Tolerability</Label>
              <select disabled={readOnly} value={followup.tolerability}
                onChange={e => setFollowup({ ...followup, tolerability: e.target.value })}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">— Select —</option>
                {preset.tolerabilityOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <Label className="mb-2 block">Adverse events — tap any</Label>
              <div className="flex flex-wrap gap-1.5">
                {preset.adverseEventOptions.map((c, i) => {
                  const on = aeChips.includes(c);
                  return (
                    <button key={i} type="button" disabled={readOnly}
                      onClick={() => setAeChips(arr => toggle(arr, c))}
                      className={`text-xs rounded-full border px-2.5 py-1 transition ${on ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-secondary/40 hover:border-primary/40"}`}>
                      {on ? "✓ " : "+ "}{c}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Objective deltas — tap any</Label>
              <div className="flex flex-wrap gap-1.5">
                {DELTA_OPTIONS.map((c, i) => {
                  const on = deltaChips.includes(c);
                  return (
                    <button key={i} type="button" disabled={readOnly}
                      onClick={() => setDeltaChips(arr => toggle(arr, c))}
                      className={`text-xs rounded-full border px-2.5 py-1 transition ${on ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-secondary/40 hover:border-primary/40"}`}>
                      {on ? "✓ " : "+ "}{c}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Decision</Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {(["increase","decrease","continue","discontinue","switch"] as const).map(d => (
                  <button key={d} type="button" disabled={readOnly}
                    onClick={() => setFollowup({ ...followup, decision: d })}
                    className={`rounded-md border px-3 py-2 text-sm capitalize transition ${followup.decision === d ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Rationale — tap any</Label>
              <div className="flex flex-wrap gap-1.5">
                {RATIONALE_OPTIONS.map((c, i) => {
                  const on = rationaleChips.includes(c);
                  return (
                    <button key={i} type="button" disabled={readOnly}
                      onClick={() => setRationaleChips(arr => toggle(arr, c))}
                      className={`text-xs rounded-full border px-2.5 py-1 transition ${on ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-secondary/40 hover:border-primary/40"}`}>
                      {on ? "✓ " : "+ "}{c}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Prescriptions — locked preset cards, only titration step is selectable */}
      <Card>
        <CardHeader><CardTitle className="text-base">Plan & Prescriptions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!readOnly && (
            <div className="rounded border border-dashed border-border p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">Add from {preset.label}</p>
              <div className="flex flex-wrap gap-2">
                {preset.prescriptions.map((p, i) => (
                  <Button key={i} variant="secondary" size="sm" onClick={() => addRxPreset(p)}>+ {p.drug} {p.strength}</Button>
                ))}
              </div>
            </div>
          )}
          {rx.map((r, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2 bg-card/40">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{r.drug || "—"} <span className="text-muted-foreground font-normal">{r.strength}</span></div>
                  <div className="text-xs text-muted-foreground">{r.route} · {r.duration} · Dispense {r.dispense} · Refills {r.refills}</div>
                  <div className="text-sm mt-1"><span className="text-[10px] tracking-widest text-primary font-semibold">SIG </span>{r.frequency || "— pick a titration step below —"}</div>
                  {r.notes && <div className="text-xs text-muted-foreground mt-1">{r.notes}</div>}
                </div>
                {!readOnly && <Button variant="ghost" size="icon" onClick={() => removeRx(i)} className="text-destructive shrink-0"><Trash2 className="h-4 w-4" /></Button>}
              </div>
              {Array.isArray(r.titration) && r.titration.length > 0 && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <div className="text-[10px] font-semibold tracking-[0.18em] text-primary">EVIDENCE-BASED TITRATION — TAP TO SELECT</div>
                  <div className="divide-y divide-primary/15">
                    {r.titration!.map((t, j) => {
                      const isCurrent = r.frequency?.includes(t.dose);
                      return (
                        <div key={j} className="flex items-center justify-between gap-2 py-2 text-sm">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="inline-flex items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-semibold w-12 h-6 shrink-0">WK {t.week}</span>
                            <div className="min-w-0">
                              <div className={`font-medium truncate ${isCurrent ? "text-primary" : ""}`}>{t.dose}</div>
                              {t.notes && <div className="text-xs text-muted-foreground truncate">{t.notes}</div>}
                            </div>
                          </div>
                          {!readOnly && (
                            <Button type="button" variant={isCurrent ? "default" : "outline"} size="sm" className="h-7 text-xs shrink-0"
                              onClick={() => updateRx(i, { frequency: `${t.dose} (start at week ${t.week}${t.notes ? ` — ${t.notes}` : ""})` })}>
                              {isCurrent ? "Selected" : "Use this dose"}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div>
            <Label className="mb-2 block">Plan — tap to include</Label>
            <div className="flex flex-wrap gap-1.5">
              {preset.planChips.map((c, i) => {
                const on = planChips.includes(c);
                return (
                  <button key={i} type="button" disabled={readOnly}
                    onClick={() => setPlanChips(arr => toggle(arr, c))}
                    className={`text-xs rounded-full border px-2.5 py-1 transition ${on ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border bg-secondary/40 hover:border-primary/40"}`}>
                    {on ? "✓ " : "+ "}{c}
                  </button>
                );
              })}
            </div>
            {plan && <div className="mt-2 rounded bg-secondary/30 p-2.5 text-xs leading-relaxed">{plan}</div>}
          </div>
        </CardContent>
      </Card>

      </>
      )}

      {/* Counseling + attestation */}
      <Card>
        <CardHeader><CardTitle className="text-base">Counseling & attestation</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded bg-secondary/40 p-3 text-sm space-y-1">
            <div className="font-medium">Counseling points reviewed with patient</div>
            {preset.counselingPoints.map((p, i) => <div key={i}>• {p}</div>)}
          </div>
          <div className="rounded bg-secondary/40 p-3 text-sm space-y-1">
            <div className="font-medium">Red flags / when to call</div>
            {preset.redFlags.map((p, i) => <div key={i}>• {p}</div>)}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={counselingAck} disabled={readOnly} onCheckedChange={v => setCounselingAck(!!v)} />
            I reviewed the counseling points and red flags above with the patient; the patient verbalized understanding.
          </label>
          <div>
            <Label className="mb-1 block flex items-center gap-2">503A / medical-necessity attestation <Badge variant="outline" className="text-[10px]">Locked template</Badge></Label>
            <div className="rounded bg-secondary/30 p-2.5 text-xs leading-relaxed whitespace-pre-wrap">{necessity}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            <div className="font-medium uppercase tracking-widest mb-1">Evidence</div>
            {preset.evidence.map((e, i) => <div key={i}>• {e}</div>)}
          </div>
        </CardContent>
      </Card>

      {/* Signature & PDFs */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Provider attestation</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!readOnly ? (
            <>
              <MiniSignaturePad
                fullName={signerName}
                onFullNameChange={setSignerName}
                signaturePng={signaturePng}
                onSignatureChange={setSignaturePng}
              />
              <div><Label>License #</Label><Input value={signerLicense} onChange={e => setSignerLicense(e.target.value)} placeholder="e.g. NP12345 / CA" /></div>
              <Button onClick={signAndGenerate} disabled={signing} className="w-full md:w-auto">
                {signing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Sign & generate PDFs
              </Button>
            </>
          ) : (
            <div className="text-sm">
              <div>Signed by <span className="font-medium">{signerName}</span> {signerLicense && `(${signerLicense})`}</div>
              {pdfs?.clinical_pdf_url && (
                <a href={pdfs.clinical_pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline mt-2">
                  <FileText className="h-4 w-4" /> Clinical visit note PDF <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {pdfs?.handout_pdf_url && (
                <div><a href={pdfs.handout_pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline mt-1">
                  <FileText className="h-4 w-4" /> Patient handout PDF <ExternalLink className="h-3 w-3" />
                </a></div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
