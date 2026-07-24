import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
const supabase = supabaseTyped as any;
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, ShieldCheck, FileText, ArrowLeft, History, Stethoscope, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { StaffClientSearch, type StaffClientPick } from "@/components/staff/StaffClientSearch";
import { CATEGORY_OPTIONS, type Category } from "@/lib/encounterPresets";

type Protocol = {
  id: string;
  slug: string;
  title: string;
  category: string;
  current_version_id: string | null;
  updated_at: string;
};
type Version = {
  id: string;
  protocol_id: string;
  version_number: number;
  status: string;
  signed_at: string | null;
  signed_by_name: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  glp1: "GLP-1",
  
  peptide: "Peptide",
  hrt: "HRT",
  other: "Other",
};

type ProtocolTemplate = {
  category: string;
  title: string;
  slug: string;
  version: Record<string, unknown>;
};

const PROTOCOL_TEMPLATES: ProtocolTemplate[] = [
  {
    category: "glp1",
    title: "GLP-1 Weight Management Protocol",
    slug: "glp1-weight-management",
    version: {
      indication: "Adult weight-management treatment after NP evaluation, risk review, medication reconciliation, and confirmation that therapy is clinically appropriate.",
      regulatory_basis: "Use only under current Radiantilyk Aesthetic prescriber review, documented medical necessity, and applicable FDA/503A compounding requirements. Confirm product source, availability, and patient-specific rationale before prescribing.",
      contraindications: { absolute: ["Pregnancy or actively trying to conceive", "Personal or family history of medullary thyroid carcinoma or MEN2", "Prior serious hypersensitivity to therapy components", "Active pancreatitis"], relative: ["History of pancreatitis", "Gallbladder disease", "Severe GI disease or gastroparesis", "Insulin or sulfonylurea use requiring hypoglycemia planning"] },
      baseline_labs: ["CBC", "CMP", "HbA1c", "Fasting lipid panel", "TSH", "Pregnancy test when applicable"],
      followup_labs: ["CMP and HbA1c at approximately 12 weeks or per NP judgment", "Additional labs based on symptoms, comorbidities, and medication risk"],
      titration: [{ week: "1-4", dose: "Start low per prescriber order", route: "SC", frequency: "weekly", notes: "Escalate only if tolerated" }, { week: "5+", dose: "Increase per protocol and patient response", route: "SC", frequency: "weekly", notes: "Hold escalation for significant adverse effects" }],
      max_dose: "Per current prescriber order and product-specific limits.",
      hold_criteria: "Hold or reduce dose for severe/persistent GI symptoms, dehydration, suspected pancreatitis, pregnancy, hypoglycemia risk, or concerning lab/symptom changes.",
      taper_rules: "Discontinue or reassess if risks outweigh benefit, patient cannot tolerate therapy, pregnancy occurs, or clinical goals are not being met.",
      monitoring: ["Weight, BP, HR, side effects, intake/hydration, and adherence at each visit", "Review contraindications and medication changes before dose escalation"],
      red_flags: ["Severe abdominal pain radiating to back", "Persistent vomiting or dehydration", "Signs of gallbladder disease", "Pregnancy", "Allergic reaction"],
      counseling: ["Inject on the same day each week as directed", "Rotate injection sites", "Prioritize protein, hydration, and constipation prevention", "Report severe or persistent symptoms promptly"],
      evidence: [],
      necessity_template: "NP to document patient-specific medical necessity, prior history, contraindication review, dose rationale, and why the selected preparation is appropriate for this patient.",
      patient_handout_md: "This medication is used as part of a supervised weight-management plan. Use exactly as directed. Common side effects can include nausea, constipation, reflux, appetite changes, or fatigue. Call the clinic for severe abdominal pain, persistent vomiting, dehydration, allergic reaction, pregnancy, or any symptom that feels urgent.",
    },
  },
  {
    category: "peptide",
    title: "Peptide Therapy Protocol",
    slug: "peptide-therapy",
    version: {
      indication: "Peptide therapy considered after NP evaluation, goal review, medication reconciliation, and patient-specific appropriateness assessment.",
      regulatory_basis: "Use requires prescriber confirmation of current regulatory status, product source, patient-specific medical necessity, and documented informed consent.",
      contraindications: { absolute: ["Pregnancy unless explicitly cleared by prescriber", "Known hypersensitivity to therapy components"], relative: ["Active malignancy history or concern requiring physician review", "Uncontrolled chronic disease", "Complex medication regimen or immunologic condition requiring additional review"] },
      baseline_labs: ["Labs per selected peptide and NP judgment", "CMP when clinically indicated", "Pregnancy test when applicable"],
      followup_labs: ["Follow-up labs based on selected therapy, symptoms, and NP judgment"],
      titration: [{ week: "1+", dose: "Per selected peptide order", route: "Per order", frequency: "Per order", notes: "Do not change dosing without prescriber approval" }],
      max_dose: "Per selected therapy and prescriber order.",
      hold_criteria: "Hold for allergic reaction, concerning symptoms, pregnancy, infection concern, or NP direction.",
      taper_rules: "Continue, pause, or discontinue based on response, tolerability, and prescriber reassessment.",
      monitoring: ["Treatment goal response", "Side effects", "Medication changes", "Injection-site reactions if applicable"],
      red_flags: ["Allergic reaction", "Shortness of breath", "Severe rash", "Pregnancy", "Any severe or unexpected symptom"],
      counseling: ["Use only as prescribed", "Store as directed", "Do not share medication", "Report side effects promptly"],
      evidence: [],
      necessity_template: "NP to document selected peptide, patient-specific goal, clinical rationale, contraindication review, source/regulatory review, and consent.",
      patient_handout_md: "Your peptide plan is individualized by your prescriber. Use it exactly as directed, store it as instructed, and contact the clinic for allergic symptoms, severe rash, shortness of breath, pregnancy, or any unexpected severe symptom.",
    },
  },
  {
    category: "hrt",
    title: "Hormone Therapy Protocol",
    slug: "hormone-therapy",
    version: {
      indication: "Hormone therapy considered only after NP evaluation, symptom review, risk assessment, labs, and individualized shared decision-making.",
      regulatory_basis: "Therapy must follow prescriber review, applicable standards of care, documented risk-benefit discussion, and patient-specific medical necessity.",
      contraindications: { absolute: ["Pregnancy unless therapy is specifically indicated and managed", "Known hormone-sensitive malignancy without specialist clearance", "Active thromboembolic disease when relevant to selected therapy"], relative: ["Uncontrolled hypertension", "Significant cardiovascular risk", "Liver disease", "Complex endocrine history requiring specialist input"] },
      baseline_labs: ["CBC", "CMP", "Relevant hormone labs per NP judgment", "Pregnancy test when applicable", "Additional screening based on age, sex, symptoms, and risk"],
      followup_labs: ["Repeat relevant hormone and safety labs per NP schedule", "Additional labs based on symptoms or dose changes"],
      titration: [{ week: "Initial", dose: "Start per NP order", route: "Per order", frequency: "Per order", notes: "Adjust only after symptom and lab review" }],
      max_dose: "Per selected therapy, labs, symptoms, and prescriber order.",
      hold_criteria: "Hold or reassess for thromboembolic symptoms, pregnancy, concerning bleeding, severe adverse effects, abnormal labs, or NP concern.",
      taper_rules: "Adjust or discontinue based on symptoms, labs, adverse effects, risk changes, and patient preference after prescriber review.",
      monitoring: ["Symptoms, side effects, BP, relevant labs, and preventive screening status", "Document risk-benefit review at follow-up"],
      red_flags: ["Chest pain", "Shortness of breath", "Leg swelling/pain", "Severe headache or neurologic symptoms", "Concerning bleeding"],
      counseling: ["Use exactly as prescribed", "Keep lab and follow-up appointments", "Report red-flag symptoms immediately", "Do not change dose without prescriber guidance"],
      evidence: [],
      necessity_template: "NP to document symptoms, baseline labs, risk-benefit discussion, contraindication review, selected therapy rationale, and follow-up plan.",
      patient_handout_md: "Hormone therapy is individualized and requires follow-up. Use exactly as prescribed and keep recommended lab appointments. Seek urgent care for chest pain, shortness of breath, leg swelling, neurologic symptoms, severe headache, or concerning bleeding.",
    },
  },
];

export default function Protocols() {
  const { isNP, isAdmin, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [versions, setVersions] = useState<Record<string, Version | null>>({});
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isNP && !isAdmin) return;
    (async () => {
      const { data: ps } = await supabase
        .from("clinical_protocols")
        .select("id, slug, title, category, current_version_id, updated_at")
        .order("category").order("title");
      setProtocols((ps ?? []) as Protocol[]);
      const protocolIds = (ps ?? []).map(p => p.id).filter(Boolean) as string[];
      if (protocolIds.length) {
        const { data: vs } = await supabase
          .from("clinical_protocol_versions")
          .select("id, protocol_id, version_number, status, signed_at, signed_by_name")
          .in("protocol_id", protocolIds)
          .order("version_number", { ascending: false });
        const map: Record<string, Version | null> = {};
        for (const v of (vs ?? []) as Version[]) if (!map[v.protocol_id]) map[v.protocol_id] = v;
        setVersions(map);
      }
      setLoading(false);
    })();
  }, [authLoading, isNP, isAdmin]);

  async function createProtocol(template: ProtocolTemplate) {
    if (!user) return;
    setCreating(true);
    const { data: p, error: pErr } = await supabase
      .from("clinical_protocols")
      .insert({ slug: template.slug, title: template.title, category: template.category, created_by: user.id })
      .select("id").maybeSingle();
    if (pErr || !p) { toast.error(pErr?.message ?? "Failed"); setCreating(false); return; }
    const { data: v, error: vErr } = await supabase
      .from("clinical_protocol_versions")
      .insert({ protocol_id: p.id, version_number: 1, status: "draft", created_by: user.id, ...template.version })
      .select("id").maybeSingle();
    setCreating(false);
    if (vErr || !v) { toast.error(vErr?.message ?? "Failed"); return; }
    navigate(`/staff/clinical/protocols/${v.id}`);
  }

  if (authLoading) return <div className="p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isNP && !isAdmin) return <Navigate to="/staff/clinical" replace />;

  const grouped: Record<string, Protocol[]> = {};
  for (const p of protocols) (grouped[p.category] ||= []).push(p);

  return (
    <div className="p-6 md:p-10 max-w-5xl">
      <Link to="/staff/clinical" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3 w-3" /> Back to charts
      </Link>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="font-serif text-3xl">Clinical visits & protocols</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Start a patient-specific visit (New or Follow-up) — recommended labs, evidence-based prescriptions,
            counseling and 503A attestation auto-populate. Sign once to generate a litigation-grade PDF
            and patient handout attached to the chart.
          </p>
        </div>
      </div>

      <EncounterLauncher />

      <RecentEncounters />

      <div className="mt-10 mb-4">
        <h2 className="font-serif text-xl">Reference protocol library</h2>
        <p className="text-xs text-muted-foreground">Read-only evidence library used to seed the visit form. Drafts editable; published versions immutable.</p>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        <NewProtocolButton onCreate={createProtocol} disabled={creating} />
      </div>


      {loading && <Loader2 className="h-5 w-5 animate-spin" />}

      {!loading && protocols.length === 0 && (
        <div className="border border-dashed border-border rounded-xl p-10 text-center text-muted-foreground">
          No protocols yet. Click "New protocol" to author your first one.
        </div>
      )}

      <div className="space-y-10">
        {Object.keys(grouped).map(cat => (
          <section key={cat}>
            <h2 className="font-serif text-xl mb-3">{CATEGORY_LABEL[cat] ?? cat}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {grouped[cat].map(p => {
                const v = versions[p.id];
                return (
                  <Link
                    key={p.id}
                    to={v?.id ? `/staff/clinical/protocols/${v.id}` : `/staff/clinical/protocols/history/${p.id}`}
                    className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {v ? (
                            <span className="inline-flex items-center gap-1">
                              <ShieldCheck className={v.status === "published" ? "h-3 w-3 text-success-soft-foreground" : "h-3 w-3 text-warning-soft-foreground"} />
                              {v.status === "published" ? "Active" : "Draft"} v{v.version_number}{v.status === "published" ? ` · signed ${v.signed_at ? format(new Date(v.signed_at), "MMM d, yyyy") : "—"} by ${v.signed_by_name ?? "—"}` : " — ready to review"}
                            </span>
                          ) : (
                            <span className="text-warning-soft-foreground">Draft — not yet signed</span>
                          )}
                        </div>
                      </div>
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs">
                      <Link to={`/staff/clinical/protocols/history/${p.id}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                        <History className="h-3 w-3" /> Version history
                      </Link>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function NewProtocolButton({ onCreate, disabled }: { onCreate: (template: ProtocolTemplate) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <Button onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> New protocol</Button>;
  }
  return (
    <div className="w-full rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Choose a protocol template</div>
          <p className="text-xs text-muted-foreground mt-1">The title and starter content are filled in automatically.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {PROTOCOL_TEMPLATES.map((template) => (
          <Button
            key={template.slug}
            variant="outline"
            className="h-auto justify-start whitespace-normal text-left py-3"
            disabled={disabled}
            onClick={() => onCreate(template)}
          >
            <span>
              <span className="block font-medium">{template.title}</span>
              <span className="block text-xs text-muted-foreground mt-1">{CATEGORY_LABEL[template.category]}</span>
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}

function EncounterLauncher() {
  const navigate = useNavigate();
  const [client, setClient] = useState<StaffClientPick>({ firstName: "", lastName: "", email: "", phone: "", dob: "" });
  const [visitType, setVisitType] = useState<"new" | "follow_up">("new");
  const [category, setCategory] = useState<Category>("glp1");

  function start() {
    if (!client.email || !client.firstName || !client.lastName) {
      toast.error("Pick a patient first (search by name or email)");
      return;
    }
    const params = new URLSearchParams({
      email: client.email,
      first: client.firstName,
      last: client.lastName,
      dob: client.dob ?? "",
      visit: visitType,
      category,
    });
    navigate(`/staff/clinical/encounters/new?${params.toString()}`);
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Stethoscope className="h-4 w-4 text-primary" />
        <div className="font-medium">Start a protocol visit</div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Patient</div>
        <StaffClientSearch value={client} onChange={setClient} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(["new", "follow_up"] as const).map(v => (
          <button key={v} type="button" onClick={() => setVisitType(v)}
            className={`rounded-lg border px-4 py-3 text-left transition ${visitType === v ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border hover:border-primary/40"}`}>
            <div className="font-medium text-sm">{v === "new" ? "New visit" : "Follow-up"}</div>
            <div className="text-xs text-muted-foreground">{v === "new" ? "Initial workup + Rx" : "Reassess, titrate, decision"}</div>
          </button>
        ))}
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Category</div>
        <select value={category} onChange={e => setCategory(e.target.value as Category)}
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
          {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <Button onClick={start} className="w-full gap-1.5"><FileText className="h-4 w-4" /> Start visit</Button>
    </div>
  );
}

type EncounterRow = {
  id: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  visit_type: string;
  category: string;
  status: string;
  updated_at: string;
  signed_at: string | null;
};

function RecentEncounters() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<EncounterRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("clinical_encounters")
        .select("id, client_first_name, client_last_name, client_email, visit_type, category, status, updated_at, signed_at")
        .order("updated_at", { ascending: false })
        .limit(10);
      setRows((data ?? []) as EncounterRow[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-serif text-lg">Recent visits</h2>
      </div>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> :
        rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No protocol visits yet. Use "Start a protocol visit" above.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {rows.map(r => (
              <button key={r.id} onClick={() => navigate(`/staff/clinical/encounters/${r.id}`)}
                className="w-full text-left px-4 py-3 hover:bg-muted/40 transition flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.client_first_name} {r.client_last_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.visit_type === "new" ? "New visit" : "Follow-up"} · {r.category} · {r.client_email}
                  </div>
                </div>
                <div className="text-xs text-right shrink-0">
                  <div className={r.status === "signed" ? "text-success-soft-foreground" : "text-warning-soft-foreground"}>
                    {r.status === "signed" ? `Signed ${r.signed_at ? format(new Date(r.signed_at), "MMM d") : ""}` : "Draft"}
                  </div>
                  <div className="text-muted-foreground">{format(new Date(r.updated_at), "MMM d, h:mma")}</div>
                </div>
              </button>
            ))}
          </div>
        )
      }
    </div>
  );
}
