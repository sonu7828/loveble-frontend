// Guided Acne Decision Tool — taps-only stepped UI matching reference screenshots.
// Owns its own structured state and pushes derived SOAP/labs/Rx into parent EncounterEditor.

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, OctagonAlert, FlaskConical, ShieldCheck } from "lucide-react";
import {
  ACNE_LABS, BAND_LABEL, EMPTY_ACNE, classifyBand, decide,
  type AcneState, type LabBand, type OralAgent, type Phenotype,
  type Recommendation, type Response, type Severity, type TimeOnTherapy, type YN,
} from "@/lib/acneEngine";
import type { RxPreset } from "@/lib/encounterPresets";

type DerivedFields = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  prescriptions: RxPreset[];
  labs: Array<{ analyte: string; value: string; unit: string; source: "prior" | "ordered_today"; notes?: string }>;
  necessity: string;
  recommendation: Recommendation;
};

type Props = {
  value: AcneState;
  onChange: (s: AcneState) => void;
  onDerived: (d: DerivedFields) => void;
  readOnly?: boolean;
};

// Tiny pill button used everywhere
function Pill({
  active, onClick, children, disabled, intent = "default",
}: { active?: boolean; onClick?: () => void; children: React.ReactNode; disabled?: boolean; intent?: "default" | "danger" }) {
  return (
    <button
      type="button" disabled={disabled} onClick={onClick}
      className={[
        "rounded-full border px-3.5 py-2 text-sm transition select-none",
        active
          ? intent === "danger"
            ? "border-destructive bg-destructive/10 text-destructive"
            : "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
          : "border-border bg-card hover:border-primary/40",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Section({ step, title, subtitle, children }: { step: number; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="text-[11px] font-semibold tracking-[0.18em] text-primary">STEP {step}</div>
        <CardTitle className="text-xl font-serif">{title}</CardTitle>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-2 h-px w-12 bg-primary/40" />
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const PHENOTYPES: { value: Phenotype; label: string }[] = [
  { value: "comedonal", label: "Comedonal" },
  { value: "inflammatory", label: "Inflammatory" },
  { value: "hormonal", label: "Hormonal / jawline" },
  { value: "mixed", label: "Mixed" },
  { value: "nodulocystic", label: "Nodulocystic" },
];
const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "mild", label: "Mild" }, { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" }, { value: "nodulocystic", label: "Nodulocystic" },
];
const ORAL: { value: OralAgent; label: string }[] = [
  { value: "none", label: "None" }, { value: "topicals_only", label: "Topicals only" },
  { value: "spironolactone", label: "Spironolactone" }, { value: "doxycycline", label: "Doxycycline" },
  { value: "minocycline", label: "Minocycline" }, { value: "sarecycline", label: "Sarecycline" },
  { value: "erythromycin", label: "Erythromycin" }, { value: "azithromycin", label: "Azithromycin" },
  { value: "coc", label: "COC" }, { value: "isotretinoin", label: "Isotretinoin" },
];
const TIMES: { value: TimeOnTherapy; label: string }[] = [
  { value: "lt4wk", label: "< 4 wk" }, { value: "4to8wk", label: "4–8 wk" },
  { value: "8to12wk", label: "8–12 wk" }, { value: "3to6mo", label: "3–6 mo" }, { value: "gt6mo", label: "> 6 mo" },
];
const RESPONSES: { value: Response; label: string }[] = [
  { value: "worse", label: "Worse" }, { value: "no_change", label: "No change" },
  { value: "mild_up", label: "Mild ↑" }, { value: "significant_up", label: "Significant ↑" },
  { value: "cleared", label: "Cleared" },
];
const SPIRO_DOSES = ["25 mg", "50 mg", "100 mg", "150 mg", "200 mg"];
const DOXY_DOSES = ["50 mg", "100 mg", "100 mg BID", "150 mg"];
const ISO_DOSES = ["20 mg", "30 mg", "40 mg", "60 mg", "80 mg"];

function statusBadge(s: "green" | "yellow" | "red") {
  if (s === "red") return <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 text-destructive px-2.5 py-1 text-xs font-medium"><OctagonAlert className="h-3.5 w-3.5" /> Red</span>;
  if (s === "yellow") return <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 text-warning-soft-foreground dark:text-warning px-2.5 py-1 text-xs font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Yellow</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 text-success-soft-foreground dark:text-success px-2.5 py-1 text-xs font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Green</span>;
}

export default function AcneGuidedTool({ value, onChange, onDerived, readOnly }: Props) {
  const s = { ...EMPTY_ACNE, ...value };
  const set = (patch: Partial<AcneState>) => onChange({ ...s, ...patch });
  const toggleArr = <K extends keyof AcneState>(key: K, item: any) => {
    const arr = (s[key] as unknown as any[]) ?? [];
    set({ [key]: arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item] } as any);
  };

  const dosesForCurrent = s.currentOral === "spironolactone" ? SPIRO_DOSES
    : s.currentOral === "doxycycline" || s.currentOral === "minocycline" || s.currentOral === "sarecycline" ? DOXY_DOSES
    : s.currentOral === "isotretinoin" ? ISO_DOSES : [];

  const rec = useMemo(() => decide(s), [s]);
  const [labsMode, setLabsMode] = useState<"order" | "enter" | null>(null);

  // Push derived fields up
  useEffect(() => {
    const subjective = [
      s.sexAtBirth && `Sex at birth: ${s.sexAtBirth === "F" ? "Female" : "Male"}.`,
      s.sexAtBirth === "F" && s.childbearing && `Childbearing potential: ${s.childbearing === "Y" ? "yes" : "no"}.`,
      s.pregnant === "Y" && "Currently PREGNANT.",
      s.breastfeeding === "Y" && "Currently breastfeeding.",
      s.allergies.length ? `Allergies: ${s.allergies.join(", ")}.` : null,
      s.currentOral && s.currentOral !== "none" && `Current oral therapy: ${s.currentOral}${s.currentDose ? ` ${s.currentDose}` : ""}${s.timeOnTherapy ? ` × ${TIMES.find(t => t.value === s.timeOnTherapy)?.label}` : ""}.`,
      s.topicalRegimen && "Currently using a topical regimen.",
      s.response && `Response to current therapy: ${RESPONSES.find(r => r.value === s.response)?.label}.`,
      s.adherent && `Adherence: ${s.adherent === "Y" ? "yes" : s.adherent === "N" ? "no" : "unsure"}.`,
      s.priorFailed.length ? `Prior failed systemic agents: ${s.priorFailed.join(", ")}.` : null,
    ].filter(Boolean).join(" ");

    const labLines = ACNE_LABS
      .filter(d => s.labs[d.key]?.value)
      .map(d => {
        const { band, status } = classifyBand(d, s.labs[d.key].value);
        return `${d.label}: ${s.labs[d.key].value} ${d.unit} (${BAND_LABEL[band]}, ${status.toUpperCase()})`;
      }).join("\n");

    const objective = [
      s.severity && `Severity (IGA-mapped): ${SEVERITIES.find(x => x.value === s.severity)?.label}.`,
      s.phenotype.length && `Phenotype: ${s.phenotype.map(p => PHENOTYPES.find(x => x.value === p)?.label).join(", ")}.`,
      s.scarringRisk && "Scarring risk / active scarring noted.",
      labLines && "Labs:\n" + labLines,
      s.estrogenCI && `Estrogen contraindication: ${s.estrogenCI === "Y" ? "PRESENT" : s.estrogenCI === "N" ? "absent" : "unknown"}.`,
      s.iPledge && `iPLEDGE + 2 forms contraception: ${s.iPledge === "Y" ? "confirmed" : s.iPledge === "N" ? "NOT confirmed" : "unknown"}.`,
    ].filter(Boolean).join(" ");

    const labs = ACNE_LABS
      .filter(d => s.labs[d.key]?.value)
      .map(d => ({ analyte: d.label, value: s.labs[d.key].value, unit: d.unit, source: "prior" as const }));

    const necessity =
      "Treatment prescribed per AAD 2024 evidence-based acne guidelines. Therapy individualized to severity, phenotype, scarring risk, and patient-specific contraindications. " +
      (s.manufacturer || s.lot || s.expiration
        ? `Product source — manufacturer: ${s.manufacturer || "—"}; lot: ${s.lot || "—"}; expiration: ${s.expiration || "—"}.`
        : "Product source/lot to be recorded at dispense.");

    onDerived({ subjective, objective, assessment: rec.assessment, plan: rec.plan, prescriptions: rec.prescriptions, labs, necessity, recommendation: rec });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(s)]);

  return (
    <div className="space-y-5">
      {/* Hard safety holds banner */}
      {rec.safetyHolds.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 space-y-1.5">
            {rec.safetyHolds.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-destructive text-sm">
                <OctagonAlert className="h-4 w-4 mt-0.5 shrink-0" /><span>{h}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* STEP 1 — patient context */}
      <Section step={1} title="Patient context" subtitle="A few taps for safety logic.">
        <FieldRow label="Sex at birth">
          {(["F", "M"] as const).map(v => (
            <Pill key={v} disabled={readOnly} active={s.sexAtBirth === v} onClick={() => set({ sexAtBirth: v })}>{v === "F" ? "Female" : "Male"}</Pill>
          ))}
        </FieldRow>
        {s.sexAtBirth === "F" && (
          <>
            <FieldRow label="Childbearing potential">
              {(["Y", "N"] as const).map(v => (
                <Pill key={v} disabled={readOnly} active={s.childbearing === v} onClick={() => set({ childbearing: v })}>{v === "Y" ? "Yes" : "No"}</Pill>
              ))}
            </FieldRow>
            <FieldRow label="Pregnant?">
              {(["Y", "N"] as const).map(v => (
                <Pill key={v} disabled={readOnly} active={s.pregnant === v} onClick={() => set({ pregnant: v })} intent={v === "Y" ? "danger" : "default"}>{v === "Y" ? "Yes" : "No"}</Pill>
              ))}
            </FieldRow>
            <FieldRow label="Breastfeeding?">
              {(["Y", "N"] as const).map(v => (
                <Pill key={v} disabled={readOnly} active={s.breastfeeding === v} onClick={() => set({ breastfeeding: v })}>{v === "Y" ? "Yes" : "No"}</Pill>
              ))}
            </FieldRow>
          </>
        )}
        <FieldRow label="Allergies (tap any)">
          {["Tetracycline allergy", "Macrolide allergy", "Sulfa allergy", "Retinoid intolerance"].map(a => (
            <Pill key={a} disabled={readOnly} active={s.allergies.includes(a)} onClick={() => toggleArr("allergies", a)}>{a}</Pill>
          ))}
        </FieldRow>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Patient weight</Label>
          <p className="text-xs text-muted-foreground -mt-1">
            Used to auto-calculate isotretinoin dose (0.5 mg/kg/day start → 1.0 mg/kg/day goal; cumulative 120–150 mg/kg).
          </p>
          <div className="relative max-w-[200px]">
            <Input
              inputMode="decimal" disabled={readOnly}
              value={s.weightLb ?? ""}
              onChange={e => set({ weightLb: e.target.value })}
              placeholder="e.g. 150"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">lb</span>
          </div>
          {(() => {
            const lb = Number(s.weightLb ?? "");
            if (!Number.isFinite(lb) || lb <= 0) return null;
            const kg = lb / 2.2046226218;
            const startDaily = Math.round(0.5 * kg / 10) * 10 || 10;
            const goalDaily = Math.round(1.0 * kg / 10) * 10 || 20;
            const cumLow = Math.round(120 * kg);
            const cumHigh = Math.round(150 * kg);
            return (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-0.5">
                <div><span className="font-semibold">{kg.toFixed(1)} kg</span> · Start ≈ <span className="font-semibold">{startDaily} mg/day</span> (0.5 mg/kg)</div>
                <div>Goal ≈ <span className="font-semibold">{goalDaily} mg/day</span> (1.0 mg/kg) · Cumulative target {cumLow}–{cumHigh} mg</div>
              </div>
            );
          })()}
        </div>
      </Section>

      {/* STEP 2 — exam */}
      <Section step={2} title="Today's exam" subtitle="Choose severity and phenotype.">
        <FieldRow label="Severity">
          {SEVERITIES.map(o => (
            <Pill key={o.value} disabled={readOnly} active={s.severity === o.value} onClick={() => set({ severity: o.value })}>{o.label}</Pill>
          ))}
        </FieldRow>
        <FieldRow label="Phenotype">
          {PHENOTYPES.map(o => (
            <Pill key={o.value} disabled={readOnly} active={s.phenotype.includes(o.value)} onClick={() => toggleArr("phenotype", o.value)}>{o.label}</Pill>
          ))}
        </FieldRow>
        <FieldRow label="Risk modifier">
          <Pill disabled={readOnly} active={!!s.scarringRisk} onClick={() => set({ scarringRisk: !s.scarringRisk })}>Scarring risk / active scarring</Pill>
        </FieldRow>
      </Section>

      {/* STEP 3 — prior/current */}
      <Section step={3} title="Prior / current therapy"
        subtitle="The engine reads these answers to decide whether to up-titrate, combine, swap, or escalate. Failed therapy is acknowledged in the SOAP.">
        <FieldRow label="Current oral therapy">
          {ORAL.map(o => (
            <Pill key={o.value} disabled={readOnly} active={s.currentOral === o.value} onClick={() => set({ currentOral: o.value })}>{o.label}</Pill>
          ))}
        </FieldRow>
        {dosesForCurrent.length > 0 && (
          <FieldRow label="Current dose">
            {dosesForCurrent.map(d => (
              <Pill key={d} disabled={readOnly} active={s.currentDose === d} onClick={() => set({ currentDose: d })}>{d}</Pill>
            ))}
          </FieldRow>
        )}
        {s.currentOral && s.currentOral !== "none" && (
          <FieldRow label="Time on therapy">
            {TIMES.map(t => (
              <Pill key={t.value} disabled={readOnly} active={s.timeOnTherapy === t.value} onClick={() => set({ timeOnTherapy: t.value })}>{t.label}</Pill>
            ))}
          </FieldRow>
        )}
        <FieldRow label="Response">
          {RESPONSES.map(r => (
            <Pill key={r.value} disabled={readOnly} active={s.response === r.value} onClick={() => set({ response: r.value })}>{r.label}</Pill>
          ))}
        </FieldRow>
        <FieldRow label="Adherent as prescribed?">
          {(["Y", "N", "U"] as YN[]).map(v => (
            <Pill key={v} disabled={readOnly} active={s.adherent === v} onClick={() => set({ adherent: v })}>{v === "Y" ? "Yes" : v === "N" ? "No" : "Unsure"}</Pill>
          ))}
        </FieldRow>
        <FieldRow label="Topical regimen">
          <Pill disabled={readOnly} active={!!s.topicalRegimen} onClick={() => set({ topicalRegimen: !s.topicalRegimen })}>Currently using a topical regimen</Pill>
        </FieldRow>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Prior failed systemic agents (besides current)</Label>
          <p className="text-xs text-muted-foreground -mt-1">Select any that previously failed an adequate trial.</p>
          <div className="flex flex-wrap gap-2">
            {ORAL.filter(o => o.value !== "none" && o.value !== "topicals_only").map(o => (
              <Pill key={o.value} disabled={readOnly} active={s.priorFailed.includes(o.value)} onClick={() => toggleArr("priorFailed", o.value)}>{o.label}</Pill>
            ))}
          </div>
        </div>
      </Section>

      {/* STEP 4 — labs */}
      <Section step={4} title="Labs"
        subtitle="Order labs today, or enter values the patient already has.">
        <div className="space-y-2">
          <Label className="text-sm font-medium">How are we handling labs?</Label>
          <div className="flex flex-wrap gap-2">
            <Pill disabled={readOnly} active={labsMode === "order"} onClick={() => setLabsMode("order")}>Order labs today</Pill>
            <Pill disabled={readOnly} active={labsMode === "enter"} onClick={() => setLabsMode("enter")}>Enter existing lab values</Pill>
          </div>
        </div>

        {labsMode === "order" && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm space-y-1">
            <div className="font-medium">Labs will be ordered today.</div>
            <p className="text-muted-foreground text-xs">
              The recommended panels appear below and will be included in the plan. Results can be entered at a follow-up visit.
            </p>
          </div>
        )}

        {labsMode === "enter" && ACNE_LABS.map(def => {
          const raw = s.labs[def.key]?.value ?? "";
          const { band, status } = classifyBand(def, raw);
          return (
            <div key={def.key} className="rounded-lg border border-border bg-card/40 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{def.label}</div>
                  <div className="text-xs text-muted-foreground">{def.hint}</div>
                </div>
                {raw ? statusBadge(status) : <Badge variant="outline">—</Badge>}
              </div>
              <div className="relative">
                <Input inputMode="decimal" disabled={readOnly} value={raw}
                  onChange={e => set({ labs: { ...s.labs, [def.key]: { value: e.target.value } } })}
                  placeholder="Value" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{def.unit}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["low", "low_norm", "optimal", "high_norm", "high", "unknown"] as LabBand[]).map(b => (
                  <Pill key={b} disabled active={raw ? band === b : b === "unknown"}>{BAND_LABEL[b]}</Pill>
                ))}
              </div>
            </div>
          );
        })}

        {/* Safety gates */}
        <div className="rounded-lg border border-border bg-card/40 p-4 space-y-3">
          <div>
            <Label className="text-sm font-medium">Estrogen contraindication present?</Label>
            <p className="text-xs text-muted-foreground">VTE, migraine w/ aura, smoker &gt;35, uncontrolled HTN.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["Y", "N", "U"] as YN[]).map(v => (
              <Pill key={v} disabled={readOnly} active={s.estrogenCI === v} onClick={() => set({ estrogenCI: v })} intent={v === "Y" ? "danger" : "default"}>{v === "Y" ? "Yes" : v === "N" ? "No" : "Unknown"}</Pill>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card/40 p-4 space-y-3">
          <Label className="text-sm font-medium">iPLEDGE registered + 2 forms of contraception confirmed?</Label>
          <div className="flex flex-wrap gap-2">
            {(["Y", "N", "U"] as YN[]).map(v => (
              <Pill key={v} disabled={readOnly} active={s.iPledge === v} onClick={() => set({ iPledge: v })}>{v === "Y" ? "Yes" : v === "N" ? "No" : "Unknown"}</Pill>
            ))}
          </div>
        </div>
      </Section>

      {/* STEP 5 — Recommendations (selectable cards) */}
      {rec.options.length > 0 && (
        <Section step={5} title="Recommendations"
          subtitle="Tap one to drive Rx and SOAP. Recommendations factor in your prior dose and response.">
          <div className="space-y-3">
            {rec.options.map(opt => {
              const selected = opt.id === rec.selectedOptionId;
              const blocked = !!opt.blockedReason;
              return (
                <button key={opt.id} type="button" disabled={readOnly || blocked}
                  onClick={() => set({ selectedOptionId: opt.id })}
                  className={[
                    "w-full text-left rounded-xl border p-4 transition",
                    selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-card hover:border-primary/40",
                    blocked ? "opacity-80 cursor-not-allowed" : "",
                  ].join(" ")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[11px] font-semibold tracking-[0.18em] text-primary">{opt.kind}</div>
                    {selected && !blocked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success-soft-foreground dark:text-success px-2.5 py-1 text-xs font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-lg font-serif">{opt.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{opt.summary}</p>
                  {blocked && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-destructive/10 text-destructive px-2.5 py-1 text-xs font-medium">
                      <OctagonAlert className="h-3.5 w-3.5" /> {opt.blockedReason}
                    </div>
                  )}
                  {opt.prescriptions.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {opt.prescriptions.map((p, i) => (
                        <div key={i} className="rounded-lg border border-border bg-background/60 p-3">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><div className="text-[10px] tracking-widest text-primary font-semibold">DRUG</div><div>{p.drug} {p.strength}</div></div>
                            <div><div className="text-[10px] tracking-widest text-primary font-semibold">ROUTE</div><div>{p.route}</div></div>
                            <div><div className="text-[10px] tracking-widest text-primary font-semibold">SIG</div><div>{p.frequency}</div></div>
                            <div><div className="text-[10px] tracking-widest text-primary font-semibold">DURATION</div><div>{p.duration}</div></div>
                            <div><div className="text-[10px] tracking-widest text-primary font-semibold">QUANTITY</div><div>{p.dispense}</div></div>
                            <div><div className="text-[10px] tracking-widest text-primary font-semibold">REFILLS</div><div>{p.refills}</div></div>
                          </div>
                          {Array.isArray(p.titration) && p.titration.length > 0 && (
                            <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-2.5">
                              <div className="text-[10px] font-semibold tracking-[0.18em] text-primary mb-2">TITRATION SCHEDULE</div>
                              <div className="divide-y divide-primary/15">
                                {p.titration.map((t, j) => (
                                  <div key={j} className="flex items-center gap-3 py-1.5 text-sm">
                                    <span className="inline-flex items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-semibold w-12 h-6 shrink-0">WK {t.week}</span>
                                    <div className="min-w-0">
                                      <div className="font-medium truncate">{t.dose}</div>
                                      {t.notes && <div className="text-xs text-muted-foreground truncate">{t.notes}</div>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {p.notes && <div className="mt-2 text-xs text-muted-foreground">{p.notes}</div>}
                          <div className="mt-2 text-[11px] text-muted-foreground"><span className="font-semibold text-primary">Monitoring:</span> {opt.monitoring}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Section>
      )}


      {/* Recommended labs panel */}
      {rec.recommendedLabs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-primary">
              <FlaskConical className="h-3.5 w-3.5" /> RECOMMENDED LABS
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {rec.recommendedLabs.map((l, i) => (
              <div key={i} className="space-y-2">
                <div className="text-lg font-serif">{l.title}</div>
                <p className="text-sm text-muted-foreground">{l.summary}</p>
                <div className="h-px w-12 bg-primary/40" />
                <div className="text-sm font-medium">Baseline · before initiation / escalation</div>
                <ul className="text-sm space-y-1 pl-5 list-disc">{l.baseline.map((b, j) => <li key={j}>{b}</li>)}</ul>
                <div className="text-sm font-medium mt-2">Monitoring</div>
                <ul className="text-sm space-y-1 pl-5 list-disc">{l.monitoring.map((m, j) => <li key={j}><span className="font-medium">{m.item}</span> — {m.cadence}</li>)}</ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
