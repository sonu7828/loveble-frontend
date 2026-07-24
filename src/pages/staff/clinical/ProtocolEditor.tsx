import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
const supabase = supabaseTyped as any;
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save, ShieldCheck, ArrowLeft, Lock, Plus, Trash2, History, Printer } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MiniSignaturePad } from "@/components/clinical/MiniSignaturePad";

type Titration = { week: string; dose: string; route: string; frequency: string; notes: string };
type Citation = { citation: string; doi: string; pmid: string; url: string };

type Version = {
  id: string;
  protocol_id: string;
  version_number: number;
  status: string;
  indication: string | null;
  regulatory_basis: string | null;
  contraindications: { absolute?: string[]; relative?: string[] } | null;
  baseline_labs: string[] | null;
  followup_labs: string[] | null;
  titration: Titration[] | null;
  max_dose: string | null;
  hold_criteria: string | null;
  taper_rules: string | null;
  monitoring: string[] | null;
  red_flags: string[] | null;
  counseling: string[] | null;
  evidence: Citation[] | null;
  necessity_template: string | null;
  patient_handout_md: string | null;
  signed_by_user_id: string | null;
  signed_by_name: string | null;
  signature_png: string | null;
  signed_at: string | null;
};
type Protocol = { id: string; title: string; category: string; slug: string; current_version_id: string | null };

const blankTit = (): Titration => ({ week: "", dose: "", route: "SC", frequency: "weekly", notes: "" });
const blankCite = (): Citation => ({ citation: "", doi: "", pmid: "", url: "" });

export default function ProtocolEditor() {
  const { id = "" } = useParams();
  const { isNP, isAdmin, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [v, setV] = useState<Version | null>(null);
  const [p, setP] = useState<Protocol | null>(null);
  const [saving, setSaving] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [sigName, setSigName] = useState("");
  const [sigPng, setSigPng] = useState("");

  useEffect(() => {
    if (authLoading || !id) return;
    (async () => {
      // id may be a version id OR a protocol id (older links). Try version first.
      let { data: ver } = await (supabase as any).from("clinical_protocol_versions").select("*").eq("id", id).maybeSingle();
      let protoId = (ver as any)?.protocol_id ?? null;
      if (!ver) {
        // Fall back: treat id as a protocol id and load its current (or latest) version
        const { data: proto1 } = await (supabase as any)
          .from("clinical_protocols")
          .select("id, current_version_id")
          .eq("id", id)
          .maybeSingle();
        if (proto1) {
          protoId = proto1.id;
          if (proto1.current_version_id) {
            const r = await (supabase as any).from("clinical_protocol_versions").select("*").eq("id", proto1.current_version_id).maybeSingle();
            ver = r.data;
          }
          if (!ver) {
            const r2 = await (supabase as any)
              .from("clinical_protocol_versions")
              .select("*")
              .eq("protocol_id", proto1.id)
              .order("version_number", { ascending: false })
              .limit(1)
              .maybeSingle();
            ver = r2.data;
          }
        }
      }
      if (!ver) { setLoading(false); return; }
      setV(normalize(ver as Version));
      const { data: proto } = await (supabase as any).from("clinical_protocols").select("id, title, category, slug, current_version_id").eq("id", protoId ?? (ver as any).protocol_id).maybeSingle();
      setP(proto as Protocol);
      setLoading(false);
    })();
  }, [authLoading, id]);

  function normalize(x: Version): Version {
    return {
      ...x,
      contraindications: x.contraindications ?? { absolute: [], relative: [] },
      baseline_labs: x.baseline_labs ?? [],
      followup_labs: x.followup_labs ?? [],
      titration: (x.titration ?? []) as Titration[],
      monitoring: x.monitoring ?? [],
      red_flags: x.red_flags ?? [],
      counseling: x.counseling ?? [],
      evidence: (x.evidence ?? []) as Citation[],
    };
  }

  const locked = v?.status === "published" && !isAdmin;

  async function save() {
    if (!v) return;
    setSaving(true);
    const { error } = await (supabase as any).from("clinical_protocol_versions").update({
      indication: v.indication, regulatory_basis: v.regulatory_basis,
      contraindications: v.contraindications, baseline_labs: v.baseline_labs,
      followup_labs: v.followup_labs, titration: v.titration,
      max_dose: v.max_dose, hold_criteria: v.hold_criteria, taper_rules: v.taper_rules,
      monitoring: v.monitoring, red_flags: v.red_flags, counseling: v.counseling,
      evidence: v.evidence, necessity_template: v.necessity_template,
      patient_handout_md: v.patient_handout_md,
    }).eq("id", v.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved draft");
  }

  async function newDraftFromCurrent() {
    if (!v || !p || !user) return;
    const { data: last } = await (supabase as any).from("clinical_protocol_versions")
      .select("version_number").eq("protocol_id", p.id).order("version_number", { ascending: false }).limit(1).maybeSingle();
    const nextNum = ((last?.version_number as number) ?? 0) + 1;
    const { data: created, error } = await (supabase as any).from("clinical_protocol_versions").insert({
      protocol_id: p.id, version_number: nextNum, status: "draft", created_by: user.id,
      indication: v.indication, regulatory_basis: v.regulatory_basis,
      contraindications: v.contraindications, baseline_labs: v.baseline_labs,
      followup_labs: v.followup_labs, titration: v.titration,
      max_dose: v.max_dose, hold_criteria: v.hold_criteria, taper_rules: v.taper_rules,
      monitoring: v.monitoring, red_flags: v.red_flags, counseling: v.counseling,
      evidence: v.evidence, necessity_template: v.necessity_template,
      patient_handout_md: v.patient_handout_md,
    }).select("id").maybeSingle();
    if (error || !created) { toast.error(error?.message ?? "Failed"); return; }
    toast.success(`Draft v${nextNum} created`);
    navigate(`/staff/clinical/protocols/${created.id}`);
  }

  async function publishAndSign() {
    if (!v || !p || !user || !sigName.trim() || !sigPng) {
      toast.error("Type your name and sign to publish");
      return;
    }
    setSigning(true);
    const { error: vErr } = await (supabase as any).from("clinical_protocol_versions").update({
      status: "published",
      signed_by_user_id: user.id,
      signed_by_name: sigName.trim(),
      signature_png: sigPng,
      signed_at: new Date().toISOString(),
    }).eq("id", v.id);
    if (vErr) { setSigning(false); toast.error(vErr.message); return; }
    const { error: pErr } = await (supabase as any).from("clinical_protocols")
      .update({ current_version_id: v.id }).eq("id", p.id);
    setSigning(false);
    if (pErr) { toast.error(pErr.message); return; }
    setSignOpen(false);
    toast.success(`Published v${v.version_number}`);
    const { data: refreshed } = await (supabase as any).from("clinical_protocol_versions").select("*").eq("id", v.id).maybeSingle();
    if (refreshed) setV(normalize(refreshed as Version));
  }

  if (authLoading || loading) return <div className="p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isNP && !isAdmin) return <Navigate to="/staff/clinical" replace />;
  if (!v || !p) return <div className="p-10 text-sm text-muted-foreground">Protocol not found.</div>;

  return (
    <div className="p-6 md:p-10 max-w-4xl">
      <Link to="/staff/clinical/protocols" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3 w-3" /> Back to protocols
      </Link>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-3xl">{p.title}</h1>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <span>Version {v.version_number}</span>
            <span>·</span>
            <span className={v.status === "published" ? "text-success-soft-foreground" : "text-warning-soft-foreground"}>
              {v.status === "published" ? <><ShieldCheck className="inline h-3 w-3" /> Published / signed</> : "Draft"}
            </span>
            {v.signed_at && <><span>·</span><span>signed by {v.signed_by_name} on {new Date(v.signed_at).toLocaleDateString()}</span></>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Button onClick={() => printProtocol(p, v)} variant="outline" size="sm" className="gap-1.5">
            <Printer className="h-3 w-3" /> Print
          </Button>
          <Link to={`/staff/clinical/protocols/history/${p.id}`}>
            <Button variant="outline" size="sm" className="gap-1.5"><History className="h-3 w-3" /> History</Button>
          </Link>
          {!locked && v.status === "draft" && (
            <>
              <Button onClick={save} disabled={saving} variant="outline" size="sm" className="gap-1.5">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save draft
              </Button>
              <Button onClick={() => setSignOpen(true)} size="sm" className="gap-1.5">
                <ShieldCheck className="h-3 w-3" /> Publish &amp; sign
              </Button>
            </>
          )}
          {v.status === "published" && (
            <Button onClick={newDraftFromCurrent} variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-3 w-3" /> New draft from this
            </Button>
          )}
        </div>
      </div>

      {locked && (
        <div className="rounded-lg border border-success/30 bg-success-soft text-success-soft-foreground p-3 text-sm mb-6 flex items-center gap-2">
          <Lock className="h-4 w-4" /> This version is signed and locked. Create a new draft to make changes.
        </div>
      )}

      <fieldset disabled={locked} className="space-y-8">
        <Field label="Indication" required>
          <Textarea rows={2} value={v.indication ?? ""} onChange={e => setV({ ...v, indication: e.target.value })} placeholder="e.g. Chronic weight management in adults with BMI ≥ 30, or ≥ 27 with comorbidity (T2DM, HTN, dyslipidemia, OSA)." />
        </Field>

        <Field label="Regulatory basis / FDA + 503A context" required>
          <Textarea rows={3} value={v.regulatory_basis ?? ""} onChange={e => setV({ ...v, regulatory_basis: e.target.value })} placeholder="Cite FDA approval status, current shortage list status, 503A compounding eligibility, and rationale for non-commercial product if applicable." />
        </Field>

        <StringList label="Absolute contraindications" required values={v.contraindications?.absolute ?? []}
          onChange={arr => setV({ ...v, contraindications: { ...(v.contraindications ?? {}), absolute: arr } })} />
        <StringList label="Relative contraindications" values={v.contraindications?.relative ?? []}
          onChange={arr => setV({ ...v, contraindications: { ...(v.contraindications ?? {}), relative: arr } })} />

        <StringList label="Required baseline labs" required values={v.baseline_labs ?? []}
          onChange={arr => setV({ ...v, baseline_labs: arr })} placeholder="e.g. CBC, CMP, HbA1c, lipid panel, TSH, lipase, hCG (if applicable)" />
        <StringList label="Required follow-up labs" required values={v.followup_labs ?? []}
          onChange={arr => setV({ ...v, followup_labs: arr })} placeholder="e.g. CMP + HbA1c at 12 weeks, lipase if symptoms" />

        <TitrationEditor titration={v.titration ?? []} onChange={t => setV({ ...v, titration: t })} />

        <Field label="Maximum dose">
          <Input value={v.max_dose ?? ""} onChange={e => setV({ ...v, max_dose: e.target.value })} placeholder="e.g. 2.4 mg weekly SC" />
        </Field>
        <Field label="Dose-hold / dose-reduction criteria">
          <Textarea rows={2} value={v.hold_criteria ?? ""} onChange={e => setV({ ...v, hold_criteria: e.target.value })} placeholder="e.g. Severe GI intolerance, lipase >3x ULN, pregnancy, hypoglycemia <60 mg/dL." />
        </Field>
        <Field label="Taper / discontinuation rules">
          <Textarea rows={2} value={v.taper_rules ?? ""} onChange={e => setV({ ...v, taper_rules: e.target.value })} placeholder="e.g. Discontinue if <5% TBWL at 6 months at max tolerated dose." />
        </Field>

        <StringList label="Monitoring checkpoints" values={v.monitoring ?? []}
          onChange={arr => setV({ ...v, monitoring: arr })} placeholder="e.g. Weight + BP + HR every visit, HbA1c q12 weeks" />
        <StringList label="Red flags / stop criteria / ER referral triggers" required values={v.red_flags ?? []}
          onChange={arr => setV({ ...v, red_flags: arr })} placeholder="e.g. Severe abdominal pain radiating to back, persistent vomiting, gallbladder symptoms, vision changes" />
        <StringList label="Patient counseling points" values={v.counseling ?? []}
          onChange={arr => setV({ ...v, counseling: arr })} placeholder="e.g. Inject same day each week; rotate sites; expect early GI side effects" />

        <CitationsEditor evidence={v.evidence ?? []} onChange={e => setV({ ...v, evidence: e })} />

        <Field label="503A medical-necessity attestation template">
          <Textarea rows={4} value={v.necessity_template ?? ""} onChange={e => setV({ ...v, necessity_template: e.target.value })} placeholder="Justification language: why a compounded preparation is medically necessary for an individual patient (allergy, dose unavailable commercially, documented intolerance to inactive ingredients, etc.)." />
        </Field>

        <Field label="Patient handout (plain-language)">
          <Textarea rows={8} value={v.patient_handout_md ?? ""} onChange={e => setV({ ...v, patient_handout_md: e.target.value })} placeholder="What this is, how it's given, what to expect, common side effects, when to call us. Written for patients — avoid jargon." />
        </Field>
      </fieldset>

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Publish &amp; sign v{v.version_number}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Once signed, this version is immutable. Any future change requires creating a new draft.
            Your typed name and signature will be embedded in every PDF generated from this version.
          </p>
          <MiniSignaturePad fullName={sigName} onFullNameChange={setSigName} signaturePng={sigPng} onSignatureChange={setSigPng} label="Provider signature" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOpen(false)} disabled={signing}>Cancel</Button>
            <Button onClick={publishAndSign} disabled={signing || !sigName.trim() || !sigPng}>
              {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Publish &amp; sign</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

function StringList({ label, values, onChange, required, placeholder }: {
  label: string; values: string[]; onChange: (v: string[]) => void; required?: boolean; placeholder?: string;
}) {
  return (
    <Field label={label} required={required}>
      <div className="space-y-2">
        {values.map((val, i) => (
          <div key={i} className="flex gap-2">
            <Input value={val} placeholder={placeholder} onChange={e => {
              const next = [...values]; next[i] = e.target.value; onChange(next);
            }} />
            <Button type="button" variant="outline" size="icon" onClick={() => onChange(values.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => onChange([...values, ""])}>
          <Plus className="h-3 w-3" /> Add item
        </Button>
      </div>
    </Field>
  );
}

function TitrationEditor({ titration, onChange }: { titration: Titration[]; onChange: (t: Titration[]) => void }) {
  return (
    <Field label="Titration schedule" required>
      <div className="space-y-2">
        {titration.map((t, i) => (
          <div key={i} className="grid grid-cols-2 md:grid-cols-[80px_1fr_90px_120px_1fr_auto] gap-2">
            <Input placeholder="Week" value={t.week} onChange={e => upd(i, { ...t, week: e.target.value })} />
            <Input placeholder="Dose (e.g. 0.25 mg)" value={t.dose} onChange={e => upd(i, { ...t, dose: e.target.value })} />
            <Input placeholder="Route" value={t.route} onChange={e => upd(i, { ...t, route: e.target.value })} />
            <Input placeholder="Frequency" value={t.frequency} onChange={e => upd(i, { ...t, frequency: e.target.value })} />
            <Input placeholder="Notes" value={t.notes} onChange={e => upd(i, { ...t, notes: e.target.value })} />
            <Button type="button" variant="outline" size="icon" onClick={() => onChange(titration.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => onChange([...titration, blankTit()])}>
          <Plus className="h-3 w-3" /> Add titration step
        </Button>
      </div>
    </Field>
  );
  function upd(i: number, next: Titration) { const arr = [...titration]; arr[i] = next; onChange(arr); }
}

function CitationsEditor({ evidence, onChange }: { evidence: Citation[]; onChange: (e: Citation[]) => void }) {
  return (
    <Field label="Evidence citations">
      <div className="space-y-2">
        {evidence.map((c, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_180px_auto] gap-2">
            <Input placeholder="Citation (authors, year, title, journal)" value={c.citation} onChange={e => upd(i, { ...c, citation: e.target.value })} />
            <Input placeholder="DOI" value={c.doi} onChange={e => upd(i, { ...c, doi: e.target.value })} />
            <Input placeholder="PMID" value={c.pmid} onChange={e => upd(i, { ...c, pmid: e.target.value })} />
            <Input placeholder="URL" value={c.url} onChange={e => upd(i, { ...c, url: e.target.value })} />
            <Button type="button" variant="outline" size="icon" onClick={() => onChange(evidence.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => onChange([...evidence, blankCite()])}>
          <Plus className="h-3 w-3" /> Add citation
        </Button>
      </div>
    </Field>
  );
  function upd(i: number, next: Citation) { const arr = [...evidence]; arr[i] = next; onChange(arr); }
}

function esc(s: any): string {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function ul(arr: any): string {
  if (!Array.isArray(arr) || arr.length === 0) return "<p><em>—</em></p>";
  return `<ul>${arr.map((x: any) => `<li>${esc(typeof x === "string" ? x : JSON.stringify(x))}</li>`).join("")}</ul>`;
}
function printProtocol(p: Protocol, v: Version) {
  const titRows = (v.titration ?? []).map(t =>
    `<tr><td>${esc(t.week)}</td><td>${esc(t.dose)}</td><td>${esc(t.route)}</td><td>${esc(t.frequency)}</td><td>${esc(t.notes)}</td></tr>`
  ).join("") || `<tr><td colspan="5"><em>—</em></td></tr>`;
  const cites = (v.evidence ?? []).map(e => {
    const tag = [e.pmid && `PMID:${e.pmid}`, e.doi && `DOI:${e.doi}`].filter(Boolean).join(" · ");
    return `<li>${esc(e.citation || e.url || "")}${tag ? ` <span style="color:#666">(${esc(tag)})</span>` : ""}</li>`;
  }).join("") || "<li><em>—</em></li>";
  const signed = v.signed_at ? `${new Date(v.signed_at).toLocaleDateString()} by ${esc(v.signed_by_name ?? "—")}` : "Unsigned draft";
  const sigImg = v.signature_png ? `<img src="${v.signature_png}" alt="signature" style="max-height:60px;border-bottom:1px solid #111;padding-bottom:4px"/>` : "______________________________";

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.title)} — v${v.version_number}</title>
<style>
  body{font-family:Georgia,serif;color:#111;max-width:760px;margin:32px auto;padding:0 28px;line-height:1.5}
  h1{font-size:26px;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:4px}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#333;margin-top:22px;border-bottom:1px solid #ccc;padding-bottom:4px}
  ul{padding-left:22px;margin:6px 0} li{margin:3px 0}
  p{margin:6px 0} .meta{font-size:12px;color:#555}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
  th,td{border:1px solid #bbb;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f3f3f3}
  .auth{font-size:11px;color:#555;font-style:italic;margin-top:6px}
  .sigblock{margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:32px;font-size:12px}
  .sigblock .line{margin-top:32px;border-top:1px solid #111;padding-top:4px}
  @media print { body{margin:0} }
</style></head><body>
<h1>${esc(p.title)}</h1>
<p class="meta">Version ${v.version_number} · ${esc(v.status)} · ${esc(signed)}</p>
<p class="auth">Radiantilyk Aesthetic · Authored by Kiem Vukadinovic, NP — Founder & Nurse Practitioner. Medical Director: Dr. Fobi, MD — Supervising Physician.<br/>Aligned with CA BRN standardized procedures (CCR §1474) and CA Medical Board guidance for medical spas.</p>

<h2>Indication</h2><p>${esc(v.indication) || "<em>—</em>"}</p>
<h2>Regulatory basis</h2><p>${esc(v.regulatory_basis) || "<em>—</em>"}</p>
<h2>Absolute contraindications</h2>${ul(v.contraindications?.absolute)}
<h2>Relative contraindications</h2>${ul(v.contraindications?.relative)}
<h2>Required baseline labs</h2>${ul(v.baseline_labs)}
<h2>Required follow-up labs</h2>${ul(v.followup_labs)}
<h2>Titration schedule</h2>
<table><thead><tr><th>Week</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Notes</th></tr></thead><tbody>${titRows}</tbody></table>
<h2>Maximum dose</h2><p>${esc(v.max_dose) || "<em>—</em>"}</p>
<h2>Dose-hold / reduction criteria</h2><p>${esc(v.hold_criteria) || "<em>—</em>"}</p>
<h2>Taper / discontinuation rules</h2><p>${esc(v.taper_rules) || "<em>—</em>"}</p>
<h2>Monitoring checkpoints</h2>${ul(v.monitoring)}
<h2>Red flags / stop criteria</h2>${ul(v.red_flags)}
<h2>Patient counseling points</h2>${ul(v.counseling)}
<h2>Evidence citations</h2><ul>${cites}</ul>
<h2>503A medical-necessity attestation</h2><p>${esc(v.necessity_template) || "<em>—</em>"}</p>
<h2>Patient handout</h2><p style="white-space:pre-wrap">${esc(v.patient_handout_md) || "<em>—</em>"}</p>

<div class="sigblock">
  <div>
    <strong>Nurse Practitioner (Author)</strong><br/>Kiem Vukadinovic, NP — Founder
    <div class="line">${sigImg}<br/>Signature</div>
    <div class="line">______________________________<br/>Date</div>
  </div>
  <div>
    <strong>Medical Director (Supervising Physician)</strong><br/>Dr. Fobi, MD
    <div class="line">______________________________<br/>Signature</div>
    <div class="line">______________________________<br/>Date</div>
  </div>
</div>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
