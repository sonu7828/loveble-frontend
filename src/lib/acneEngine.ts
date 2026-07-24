// Guided Acne Decision Engine
// Evidence base: AAD 2024 (Reynolds et al. JAAD 2024;90:1006), Layton 2017 (spironolactone),
// FDA iPLEDGE program, Endocrine Soc. PCOS guideline 2013.
// Pure logic — no React. Used by AcneGuidedTool to derive labs panel, Rx, and SOAP text.

import type { RxPreset } from "./encounterPresets";

export type YN = "Y" | "N" | "U";
export type Severity = "mild" | "moderate" | "severe" | "nodulocystic";
export type Phenotype = "comedonal" | "inflammatory" | "hormonal" | "mixed" | "nodulocystic";
export type Response = "worse" | "no_change" | "mild_up" | "significant_up" | "cleared";
export type TimeOnTherapy = "lt4wk" | "4to8wk" | "8to12wk" | "3to6mo" | "gt6mo";
export type OralAgent =
  | "none" | "topicals_only" | "spironolactone" | "doxycycline" | "minocycline"
  | "sarecycline" | "erythromycin" | "azithromycin" | "coc" | "isotretinoin";

export type AcneState = {
  // Step 1 — patient context
  sexAtBirth?: "F" | "M";
  childbearing?: YN;
  pregnant?: YN;
  breastfeeding?: YN;
  allergies: string[]; // "Tetracycline allergy", "Macrolide allergy"

  // Step 2 — exam
  severity?: Severity;
  phenotype: Phenotype[];
  scarringRisk?: boolean;

  // Step 3 — prior/current therapy
  currentOral?: OralAgent;
  currentDose?: string;
  timeOnTherapy?: TimeOnTherapy;
  response?: Response;
  adherent?: YN;
  topicalRegimen?: boolean;
  priorFailed: OralAgent[];

  // Step 4 — labs (entered values; band auto-derived)
  labs: Record<string, { value: string }>;

  // Safety gates
  estrogenCI?: YN;
  iPledge?: YN;

  // Court-ready
  manufacturer?: string;
  lot?: string;
  expiration?: string;

  // Weight (for weight-based isotretinoin dosing)
  weightLb?: string;

  // Step 5 — which engine option the provider chose
  selectedOptionId?: string;
};

export const EMPTY_ACNE: AcneState = {
  allergies: [], phenotype: [], priorFailed: [], labs: {},
};

// ── Lab dictionary ─────────────────────────────────────────────────
export type LabBand = "low" | "low_norm" | "optimal" | "high_norm" | "high" | "unknown";
export type LabStatus = "green" | "yellow" | "red";

export type LabDef = {
  key: string;
  label: string;
  unit: string;
  hint: string;
  // numeric ranges (mEq/L, mg/dL, U/L, etc.) — used both for band and status
  ranges: { low: number; lowNorm: number; optimal: [number, number]; highNorm: number; high: number };
  // status logic relative to band + thresholds
  statusFor: (value: number) => LabStatus;
};

export const ACNE_LABS: LabDef[] = [
  {
    key: "potassium", label: "Potassium (K+)", unit: "mEq/L",
    hint: "Spironolactone: hold/halt if K ≥5.5.",
    ranges: { low: 3.5, lowNorm: 3.8, optimal: [4.0, 4.5], highNorm: 5.0, high: 5.5 },
    statusFor: v => (v >= 5.5 ? "red" : v >= 5.1 ? "yellow" : v < 3.5 ? "yellow" : "green"),
  },
  {
    key: "creatinine", label: "Creatinine", unit: "mg/dL",
    hint: "Optimal 0.6–1.1 mg/dL · Acceptable 0.5–1.3 mg/dL",
    ranges: { low: 0.5, lowNorm: 0.6, optimal: [0.7, 1.0], highNorm: 1.1, high: 1.3 },
    statusFor: v => (v > 1.3 ? "red" : v > 1.1 ? "yellow" : "green"),
  },
  {
    key: "egfr", label: "eGFR", unit: "mL/min/1.73m²",
    hint: "≥60 acceptable; <30 avoid spironolactone.",
    ranges: { low: 30, lowNorm: 45, optimal: [90, 120], highNorm: 120, high: 140 },
    statusFor: v => (v < 30 ? "red" : v < 60 ? "yellow" : "green"),
  },
  {
    key: "ast", label: "AST", unit: "U/L",
    hint: "Optimal 15–35 U/L · Acceptable 10–50 U/L",
    ranges: { low: 10, lowNorm: 12, optimal: [15, 35], highNorm: 50, high: 80 },
    statusFor: v => (v > 80 ? "red" : v > 50 ? "yellow" : "green"),
  },
  {
    key: "alt", label: "ALT", unit: "U/L",
    hint: "Optimal 12–35 U/L · Acceptable 7–50 U/L",
    ranges: { low: 7, lowNorm: 10, optimal: [12, 35], highNorm: 50, high: 80 },
    statusFor: v => (v > 80 ? "red" : v > 35 ? "yellow" : "green"),
  },
  {
    key: "triglycerides", label: "Triglycerides", unit: "mg/dL",
    hint: "Isotretinoin: hold if TG ≥500; recheck.",
    ranges: { low: 50, lowNorm: 80, optimal: [80, 150], highNorm: 200, high: 500 },
    statusFor: v => (v >= 500 ? "red" : v >= 200 ? "yellow" : "green"),
  },
  {
    key: "ldl", label: "LDL", unit: "mg/dL",
    hint: "Optimal 70–100 mg/dL · Acceptable 40–130 mg/dL",
    ranges: { low: 40, lowNorm: 60, optimal: [70, 100], highNorm: 130, high: 160 },
    statusFor: v => (v >= 160 ? "red" : v > 130 ? "yellow" : "green"),
  },
  {
    key: "wbc", label: "WBC (CBC)", unit: "10³/µL",
    hint: "Optimal 4–10 · Acceptable 3.5–11",
    ranges: { low: 3.5, lowNorm: 4, optimal: [4, 10], highNorm: 11, high: 13 },
    statusFor: v => (v > 13 || v < 3 ? "red" : v > 11 || v < 3.5 ? "yellow" : "green"),
  },
  {
    key: "hcg", label: "Pregnancy hCG", unit: "mIU/mL",
    hint: "Must be NEGATIVE (<5 mIU/mL) before isotretinoin / spironolactone in patients of reproductive potential.",
    ranges: { low: 0, lowNorm: 0, optimal: [0, 4], highNorm: 5, high: 5 },
    statusFor: v => (v >= 5 ? "red" : "green"),
  },
];

export function classifyBand(def: LabDef, raw: string): { band: LabBand; status: LabStatus } {
  if (!raw || raw.trim() === "") return { band: "unknown", status: "green" };
  const v = Number(raw);
  if (!Number.isFinite(v)) return { band: "unknown", status: "green" };
  const r = def.ranges;
  let band: LabBand;
  if (v < r.low) band = "low";
  else if (v < r.optimal[0]) band = "low_norm";
  else if (v <= r.optimal[1]) band = "optimal";
  else if (v <= r.highNorm) band = "high_norm";
  else band = "high";
  return { band, status: def.statusFor(v) };
}

export const BAND_LABEL: Record<LabBand, string> = {
  low: "Low", low_norm: "Low-norm", optimal: "Optimal",
  high_norm: "High-norm", high: "High", unknown: "Unknown",
};

// ── Decision engine ───────────────────────────────────────────────
export type RecKind = "CONTINUE" | "ADD" | "SWAP" | "ESCALATE" | "DE-ESCALATE" | "INITIATE";

export type RecOption = {
  id: string;
  kind: RecKind;
  title: string;
  summary: string;
  prescriptions: RxPreset[];
  monitoring: string;
  blockedReason?: string;     // if present, card shows Blocked badge & cannot be selected
  recommended?: boolean;      // engine's top pick → auto-selected
};

export type Recommendation = {
  headline: string;
  rationale: string[];
  assessment: string;     // SOAP A
  plan: string;           // SOAP P narrative
  prescriptions: RxPreset[]; // = selected option's prescriptions
  recommendedLabs: Array<{
    title: string;
    summary: string;
    baseline: string[];
    monitoring: { item: string; cadence: string }[];
  }>;
  safetyHolds: string[];
  options: RecOption[];
  selectedOptionId: string | null;
};

const RX: Record<string, RxPreset> = {
  tretinoin: {
    drug: "Tretinoin cream", strength: "0.025%", route: "Topical",
    frequency: "Pea-size to entire face qhs (start 3×/wk, titrate up)",
    duration: "90 days", dispense: "45 g tube", refills: 3,
    notes: "Pair with BPO wash AM. Daily SPF 30+.",
  },
  bpoWash: {
    drug: "Benzoyl peroxide wash", strength: "4–5%", route: "Topical",
    frequency: "Daily AM — lather 1–2 min, rinse",
    duration: "90 days", dispense: "170 g bottle", refills: 3,
    notes: "Reduces antibiotic resistance when combined with topical/oral abx.",
  },
  clindaBpo: {
    drug: "Clindamycin 1% / BPO 5% gel", strength: "1% / 5%", route: "Topical",
    frequency: "Thin layer to affected areas BID",
    duration: "90 days", dispense: "50 g pump", refills: 3,
  },
  doxy: {
    drug: "Doxycycline hyclate", strength: "100 mg", route: "Oral",
    frequency: "1 cap PO BID with food",
    duration: "12 weeks max, then reassess for taper",
    dispense: "180 capsules", refills: 0,
    notes: "ALWAYS combine with topical BPO. Photosensitivity — daily SPF.",
  },
  sare: {
    drug: "Sarecycline", strength: "60/100/150 mg (weight-based)",
    route: "Oral", frequency: "1 tab PO daily with food",
    duration: "12 weeks", dispense: "90 tablets", refills: 0,
    notes: "Narrow-spectrum tetracycline; preferred for stewardship.",
  },
  spiro: {
    drug: "Spironolactone", strength: "50 mg", route: "Oral",
    frequency: "1 tab PO daily x 4 wks, then 100 mg daily if tolerated",
    duration: "90 days", dispense: "90 tablets", refills: 3,
    titration: [
      { week: 1, dose: "50 mg PO daily", notes: "starting dose" },
      { week: 5, dose: "100 mg PO daily", notes: "if tolerated and partial response" },
      { week: 13, dose: "150–200 mg PO daily (max)", notes: "only if persistent hormonal acne and K+/BP stable" },
    ],
    notes: "Female only. Reliable contraception required. Check K+ if on ACE/ARB, age >45, or renal impairment.",
  },
  coc: {
    drug: "Combined oral contraceptive (FDA-approved for acne)",
    strength: "EE 20–35 mcg + progestin", route: "Oral",
    frequency: "1 tab PO daily per pack schedule",
    duration: "90 days", dispense: "3 packs", refills: 3,
    notes: "Screen for VTE/migraine w/ aura/smoker>35/uncontrolled HTN. BP at baseline + every 3–6 mo.",
  },
  isotretinoin: {
    drug: "Isotretinoin (iPLEDGE)", strength: "0.5 mg/kg/day starting; goal 120–150 mg/kg cumulative",
    route: "Oral", frequency: "Divided BID with fatty meal",
    duration: "5–6 month course", dispense: "Per iPLEDGE monthly", refills: 0,
    notes: "iPLEDGE enrollment, 2 forms contraception (female), monthly hCG + CMP + lipids. No blood donation. Enter patient weight in Step 1 to auto-calculate weight-based dosing.",
  },
};

// ── Isotretinoin weight-based dosing calculator ───────────────────
const RX_BASE = {
  isotretinoin: {
    drug: "Isotretinoin (iPLEDGE)", strength: "0.5 mg/kg/day starting; goal 120–150 mg/kg cumulative",
    route: "Oral", frequency: "Divided BID with fatty meal",
    duration: "5–6 month course", dispense: "Per iPLEDGE monthly", refills: 0,
    notes: "Enter patient weight to auto-calculate weight-based dose.",
  } satisfies RxPreset,
};
const ISO_CAPSULES = [10, 20, 30, 40]; // mg
function nearestIsoDailyDose(targetMg: number): number {
  let best = 20;
  let bestDiff = Infinity;
  for (const am of ISO_CAPSULES) {
    for (const pm of ISO_CAPSULES) {
      const total = am + pm;
      const diff = Math.abs(total - targetMg);
      if (diff < bestDiff) { bestDiff = diff; best = total; }
    }
  }
  return best;
}
export function computeIsotretinoinRx(weightLbRaw?: string): RxPreset {
  const base = RX_BASE.isotretinoin;
  const lb = Number(weightLbRaw ?? "");
  if (!Number.isFinite(lb) || lb <= 0) return base;
  const kg = lb / 2.2046226218;
  const startDaily = nearestIsoDailyDose(0.5 * kg);
  const goalDaily = nearestIsoDailyDose(1.0 * kg);
  const cumLow = Math.round(120 * kg);
  const cumHigh = Math.round(150 * kg);
  const cumTarget = Math.round(135 * kg);
  const days = Math.round(cumTarget / goalDaily);
  const months = Math.max(4, Math.min(8, Math.round(days / 30)));
  const startAm = Math.floor(startDaily / 2 / 10) * 10 || 10;
  const startPm = startDaily - startAm;
  const goalAm = Math.floor(goalDaily / 2 / 10) * 10 || 10;
  const goalPm = goalDaily - goalAm;
  const splitStart = `${startAm} mg AM + ${startPm} mg PM`;
  const splitGoal = `${goalAm} mg AM + ${goalPm} mg PM`;
  return {
    ...base,
    strength: `Weight-based — ${lb} lb (${kg.toFixed(1)} kg). Start ${startDaily} mg/day (≈0.5 mg/kg), goal ${goalDaily} mg/day (≈1.0 mg/kg).`,
    frequency: `Start: ${splitStart} (BID with fatty meal). Goal at month 2: ${splitGoal} BID.`,
    duration: `~${months} months to reach cumulative ${cumLow}–${cumHigh} mg/kg (target ${cumTarget} mg)`,
    dispense: "Per iPLEDGE — dispensed monthly",
    titration: [
      { week: 1, dose: `${startDaily} mg/day (${splitStart})`, notes: "Starting dose 0.5 mg/kg/day; recheck LFTs + lipids at 4 wks." },
      { week: 5, dose: `${Math.round((startDaily + goalDaily) / 2 / 10) * 10} mg/day`, notes: "Escalate toward goal if tolerated & labs ok." },
      { week: 9, dose: `${goalDaily} mg/day (${splitGoal})`, notes: "Goal dose 1.0 mg/kg/day; maintain through cumulative target." },
    ],
    notes:
      `Cumulative goal ${cumLow}–${cumHigh} mg/kg over ~${months} months. ` +
      `iPLEDGE enrollment, 2 forms contraception (female), monthly hCG + CMP + lipids. ` +
      `Hold if AST/ALT >3× ULN or TG ≥500. No blood donation during therapy + 1 mo after.`,
  };
}

const LAB_PANELS: Record<string, Recommendation["recommendedLabs"][number]> = {
  spiro: {
    title: "Spironolactone — initiation",
    summary: "Baseline labs only required in select patients; routine monitoring not needed in healthy young women per AAD 2024.",
    baseline: ["BMP (K+, creatinine, eGFR) — if age >45, ACE/ARB, renal disease, or comorbidity", "Pregnancy test (urine hCG)", "Baseline BP"],
    monitoring: [
      { item: "Potassium", cadence: "Only if symptomatic or risk factor present" },
      { item: "Blood pressure", cadence: "Every 3–6 months" },
    ],
  },
  doxy: {
    title: "Doxycycline / tetracycline-class — initiation",
    summary: "No routine labs required for short course. Reassess at 12 weeks for antibiotic stewardship.",
    baseline: ["Pregnancy test (urine hCG) — confirm not pregnant", "Allergy screen (tetracycline class)"],
    monitoring: [
      { item: "Clinical response & adverse events", cadence: "Every 4–8 weeks" },
      { item: "Antibiotic course duration", cadence: "Cap at 12 weeks; transition to topical maintenance" },
    ],
  },
  coc: {
    title: "Combined oral contraceptive (COC) — initiation",
    summary: "FDA-approved for moderate acne in females ≥14–15 yr who desire contraception. Screen for VTE and estrogen contraindications.",
    baseline: ["Blood pressure", "Lipid panel (if indicated by personal/family history)", "Pregnancy test (urine hCG)", "Migraine with aura screen + smoking status"],
    monitoring: [
      { item: "Blood pressure", cadence: "Every 3–6 months" },
      { item: "VTE symptom review", cadence: "Every visit" },
    ],
  },
  isotretinoin: {
    title: "Isotretinoin — initiation & monthly monitoring (iPLEDGE)",
    summary: "iPLEDGE-mandated. Two forms of contraception in females of reproductive potential. Monthly visits required.",
    baseline: ["CBC", "CMP (LFTs)", "Fasting lipid panel", "Pregnancy test (serum hCG) x2, 30 days apart"],
    monitoring: [
      { item: "Pregnancy test (hCG)", cadence: "Monthly + 1 mo after stopping" },
      { item: "LFTs (AST/ALT)", cadence: "Monthly until stable, then q3 months" },
      { item: "Fasting lipids", cadence: "Monthly until stable, then q3 months" },
      { item: "Mood / mental health check", cadence: "Every visit" },
    ],
  },
  hormonal_workup: {
    title: "Hormonal acne workup (suspected PCOS / refractory)",
    summary: "Order if sudden-onset adult female acne, hirsutism, irregular menses, or refractory to standard therapy.",
    baseline: ["Total + Free Testosterone", "DHEA-S", "17-OH progesterone", "LH / FSH", "Prolactin", "TSH", "HbA1c + fasting insulin"],
    monitoring: [{ item: "Repeat abnormal panel", cadence: "At 12 weeks" }],
  },
};

export function decide(s: AcneState): Recommendation {
  const safetyHolds: string[] = [];

  const female = s.sexAtBirth === "F";
  const repro = female && s.childbearing === "Y";
  const pregnant = s.pregnant === "Y";
  const bf = s.breastfeeding === "Y";
  const tetAllergy = s.allergies.includes("Tetracycline allergy");

  if (pregnant) safetyHolds.push("PREGNANT — isotretinoin, spironolactone, doxycycline, COC all CONTRAINDICATED. Topical azelaic acid or erythromycin only.");
  if (bf) safetyHolds.push("Breastfeeding — avoid tetracyclines, isotretinoin, spironolactone, COC. Use topicals (azelaic acid, erythromycin).");

  const k = s.labs.potassium?.value ? Number(s.labs.potassium.value) : NaN;
  const kHigh = Number.isFinite(k) && k >= 5.5;
  if (kHigh) safetyHolds.push(`Potassium ${k} mEq/L ≥ 5.5 — HOLD spironolactone, repeat.`);
  const egfr = s.labs.egfr?.value ? Number(s.labs.egfr.value) : NaN;
  const egfrLow = Number.isFinite(egfr) && egfr < 30;
  if (egfrLow) safetyHolds.push(`eGFR ${egfr} <30 — AVOID spironolactone.`);
  const tg = s.labs.triglycerides?.value ? Number(s.labs.triglycerides.value) : NaN;
  const tgHigh = Number.isFinite(tg) && tg >= 500;
  if (tgHigh) safetyHolds.push(`TG ${tg} ≥500 — HOLD isotretinoin; treat hypertriglyceridemia.`);
  const ldl = s.labs.ldl?.value ? Number(s.labs.ldl.value) : NaN;
  const ldlHigh = Number.isFinite(ldl) && ldl >= 160;
  const ast = s.labs.ast?.value ? Number(s.labs.ast.value) : NaN;
  const alt = s.labs.alt?.value ? Number(s.labs.alt.value) : NaN;
  const lftHigh = (Number.isFinite(ast) && ast > 80) || (Number.isFinite(alt) && alt > 80);
  const lipidsAbn = tgHigh || ldlHigh || lftHigh;
  const hcg = s.labs.hcg?.value ? Number(s.labs.hcg.value) : NaN;
  const hcgPos = Number.isFinite(hcg) && hcg >= 5;
  if (hcgPos) safetyHolds.push(`hCG ${hcg} mIU/mL POSITIVE — STOP, manage as pregnancy.`);

  const sev = s.severity ?? "mild";
  const hormonal = s.phenotype.includes("hormonal") || s.phenotype.includes("mixed");
  const inflamm = s.phenotype.includes("inflammatory") || s.phenotype.includes("nodulocystic") || s.phenotype.includes("mixed");
  const failedAdequate = s.priorFailed.length > 0;
  const inadequateTrial = s.timeOnTherapy === "lt4wk" || s.timeOnTherapy === "4to8wk";
  const responder = s.response === "significant_up" || s.response === "cleared";
  const noResp = s.response === "no_change" || s.response === "worse";

  const options: RecOption[] = [];

  // Pregnant / BF path
  if (pregnant || bf) {
    options.push({
      id: "topicals-only", kind: "INITIATE",
      title: "Topicals-only regimen (pregnancy/lactation safe)",
      summary: "Azelaic acid 15–20% BID. Topical erythromycin if inflammatory. Avoid retinoids/tetracyclines/spiro/COC/isotretinoin.",
      prescriptions: [
        { drug: "Azelaic acid", strength: "15–20%", route: "Topical", frequency: "Thin layer BID",
          duration: "Through pregnancy/lactation", dispense: "50 g tube", refills: 3,
          notes: "Pregnancy category B equivalent; safe in lactation." },
      ],
      monitoring: "Clinical reassessment every 8–12 weeks. No labs required.",
      recommended: true,
    });
  } else {
    // CONTINUE — when responder & adequate trial
    if (responder && s.currentOral && s.currentOral !== "none" && s.currentOral !== "topicals_only") {
      options.push({
        id: "continue", kind: "CONTINUE",
        title: `Continue current ${s.currentOral}${s.currentDose ? ` ${s.currentDose}` : ""}`,
        summary: "Patient responding; maintain current regimen and reassess.",
        prescriptions: [],
        monitoring: "Reassess at next visit. Continue topical adjuncts. Stewardship: cap oral antibiotics at ~12 weeks.",
        recommended: true,
      });
    }

    // EXTEND TRIAL — inadequate duration
    if (inadequateTrial && noResp && s.currentOral && s.currentOral !== "none") {
      options.push({
        id: "extend", kind: "CONTINUE",
        title: "Extend current trial 4–8 weeks before escalating",
        summary: "Trial <8 weeks — most agents need 8–12 weeks to show response. Confirm adherence and topical co-therapy.",
        prescriptions: [],
        monitoring: "Reassess at 8–12 weeks. Reinforce adherence + sun protection.",
        recommended: true,
      });
    }

    // MILD
    if (sev === "mild") {
      options.push({
        id: "mild-topicals", kind: "INITIATE",
        title: "Topical retinoid + BPO (Step 1)",
        summary: "AAD first-line for mild acne. Tretinoin qhs + BPO wash AM; add clindamycin/BPO combo if inflammatory.",
        prescriptions: inflamm ? [RX.tretinoin, RX.bpoWash, RX.clindaBpo] : [RX.tretinoin, RX.bpoWash],
        monitoring: "No labs. Reassess at 12 weeks. Daily SPF 30+.",
        recommended: !responder,
      });
    }

    // MODERATE
    if (sev === "moderate") {
      if (!tetAllergy && !repro) {
        options.push({
          id: "mod-doxy", kind: "ADD",
          title: "Add doxycycline 100 mg BID to topicals",
          summary: "Inflammatory moderate acne, adequate trial of topicals or scarring risk. Combine with BPO to limit resistance.",
          prescriptions: [RX.tretinoin, RX.bpoWash, RX.doxy],
          monitoring: "Cap at 12 weeks; reassess for taper. Pregnancy test pre-Rx. SPF (photosensitivity).",
          recommended: !hormonal,
        });
      }
      if (!tetAllergy && repro) {
        options.push({
          id: "mod-sare", kind: "ADD",
          title: "Add sarecycline (narrow-spectrum tetracycline)",
          summary: "Preferred for stewardship in females of reproductive potential without contraception plan.",
          prescriptions: [RX.tretinoin, RX.bpoWash, RX.sare],
          monitoring: "Pregnancy test pre-Rx. Reassess at 12 weeks.",
        });
      }
      if (hormonal && female) {
        options.push({
          id: "mod-spiro", kind: "ADD",
          title: "Add spironolactone (titrate to 100–150 mg)",
          summary: "Hormonal/jawline phenotype in female. Start 50 mg → 100 mg at 4 wk if tolerated. Reliable contraception required.",
          prescriptions: [RX.tretinoin, RX.bpoWash, RX.spiro],
          monitoring: "Baseline K+/Cr only if age >45, ACE/ARB, or renal disease. BP q3–6 mo.",
          blockedReason: kHigh ? "Potassium ≥5.5 — repeat before initiating" : egfrLow ? "eGFR <30 — avoid" : undefined,
          recommended: hormonal,
        });
      }
      if (hormonal && repro) {
        options.push({
          id: "mod-coc", kind: "ADD",
          title: "Add combined oral contraceptive (COC) to spironolactone",
          summary: "On spironolactone with worsening after 4–8 weeks. Combine for synergistic anti-androgen effect; provides contraception required during spiro.",
          prescriptions: [RX.coc],
          monitoring: "Screen VTE risk, BP, migraine pattern; counsel on contraception timing.",
          blockedReason: s.estrogenCI === "Y" ? "Estrogen contraindication present (VTE/migraine w/ aura/smoker>35/uncontrolled HTN)" : undefined,
        });
      }
    }

    // SEVERE / SCARRING — Isotretinoin
    if (sev === "severe" || sev === "nodulocystic" || s.scarringRisk || (failedAdequate && noResp)) {
      const blocks: string[] = [];
      if (lipidsAbn) blocks.push("Abnormal lipids");
      if (lftHigh) blocks.push("LFTs >2× ULN");
      if (repro && s.iPledge !== "Y") blocks.push("iPLEDGE + 2 contraception not confirmed");
      options.push({
        id: "iso", kind: "ESCALATE",
        title: "Initiate isotretinoin pathway",
        summary: "Severe / nodulocystic / scarring or failure of ≥2 prior systemic agents. Verify iPLEDGE and labs.",
        prescriptions: [computeIsotretinoinRx(s.weightLb)],
        monitoring: "iPLEDGE monthly pregnancy tests + 2 forms of contraception; baseline + ~1-month LFTs and lipids; mood monitoring; annual derm if recurrence.",
        blockedReason: blocks.length ? `Blocked: ${blocks.join("; ")}` : undefined,
        recommended: (sev === "severe" || sev === "nodulocystic") && !lipidsAbn,
      });
    }

    // SWAP — failed adequate trial of current agent
    if (failedAdequate && noResp && !inadequateTrial) {
      options.push({
        id: "swap", kind: "SWAP",
        title: "Swap class — failed adequate trial",
        summary: `Failed prior adequate trial of ${s.priorFailed.join(", ")}. Switch class rather than re-trial.`,
        prescriptions: [],
        monitoring: "Document failure rationale in chart.",
      });
    }

    // DE-ESCALATE — responder on antibiotic >12 wk
    if (responder && (s.currentOral === "doxycycline" || s.currentOral === "minocycline") &&
        (s.timeOnTherapy === "3to6mo" || s.timeOnTherapy === "gt6mo")) {
      options.push({
        id: "de-esc", kind: "DE-ESCALATE",
        title: "Taper oral antibiotic → topical maintenance",
        summary: "Antibiotic stewardship — cap systemic abx at ~12 weeks; transition responders to topical maintenance.",
        prescriptions: [RX.tretinoin, RX.bpoWash, RX.clindaBpo],
        monitoring: "Reassess at 8–12 weeks off antibiotic.",
        recommended: true,
      });
    }
  }

  // Pick selected option: explicit > recommended > first
  const selectable = options.filter(o => !o.blockedReason);
  const selectedId =
    (s.selectedOptionId && options.some(o => o.id === s.selectedOptionId && !o.blockedReason))
      ? s.selectedOptionId
      : (selectable.find(o => o.recommended)?.id ?? selectable[0]?.id ?? null);

  const selected = options.find(o => o.id === selectedId) ?? null;
  const prescriptions = selected?.prescriptions ?? [];

  // Recommended labs panels for selected prescriptions
  const recommendedLabs: Recommendation["recommendedLabs"] = [];
  const needsSpiro = prescriptions.some(p => p.drug.startsWith("Spironolactone"));
  const needsDoxy = prescriptions.some(p => /doxycycline|sarecycline/i.test(p.drug));
  const needsCoc = prescriptions.some(p => p.drug.startsWith("Combined oral"));
  const needsIso = prescriptions.some(p => p.drug.startsWith("Isotretinoin"));
  if (needsSpiro) recommendedLabs.push(LAB_PANELS.spiro);
  if (needsDoxy) recommendedLabs.push(LAB_PANELS.doxy);
  if (needsCoc) recommendedLabs.push(LAB_PANELS.coc);
  if (needsIso) recommendedLabs.push(LAB_PANELS.isotretinoin);
  if (hormonal && female && (noResp || failedAdequate)) recommendedLabs.push(LAB_PANELS.hormonal_workup);

  const sevLabel = sev[0].toUpperCase() + sev.slice(1);
  const phen = s.phenotype.length ? s.phenotype.map(p => p.replace("_", " ")).join(", ") : "unspecified";
  const assessment =
    `Acne vulgaris — ${sevLabel}${hormonal ? " hormonal" : ""}; phenotype: ${phen}${s.scarringRisk ? "; scarring risk / active scarring present" : ""}. ` +
    (selected ? `Plan focuses on ${selected.kind.toLowerCase()} via ${selected.title}. ` : "") +
    `Safety screen reviewed: ${pregnant ? "PREGNANT (teratogen-restricted). " : ""}${bf ? "Breastfeeding (restricted). " : ""}` +
    `${repro ? "Female of reproductive potential — contraception requirement reviewed. " : ""}` +
    `Allergies: ${s.allergies.length ? s.allergies.join(", ") : "none reported"}. ` +
    `Risks/benefits/alternatives discussed per AAD 2024; patient verbalized understanding.`;

  const planLines: string[] = [];
  if (selected) planLines.push(`Recommendation: ${selected.title}.`);
  if (prescriptions.length) {
    for (const p of prescriptions) {
      planLines.push(`Rx: ${p.drug} ${p.strength} — ${p.frequency}. Qty ${p.dispense}, refills ${p.refills}, duration ${p.duration}.`);
    }
  }
  if (selected?.monitoring) planLines.push(`Monitoring: ${selected.monitoring}.`);
  if (safetyHolds.length) for (const h of safetyHolds) planLines.push(`⚠ ${h}`);
  planLines.push(`Follow-up: ${sev === "mild" ? "12 weeks" : "8 weeks"}.`);

  return {
    headline: selected?.title ?? "Initiate stepwise therapy",
    rationale: [],
    assessment,
    plan: planLines.join("\n"),
    prescriptions,
    recommendedLabs,
    safetyHolds,
    options,
    selectedOptionId: selectedId,
  };
}

// ── State persistence helpers ────────────────────────────────────
const MARK_START = "[[ACNE_STATE]]";
const MARK_END = "[[/ACNE_STATE]]";
export function encodeStateInto(text: string, s: AcneState): string {
  const json = JSON.stringify(s);
  const stripped = stripState(text);
  return `${MARK_START}${json}${MARK_END}\n${stripped}`.trim();
}
export function decodeStateFrom(text: string | null | undefined): AcneState | null {
  if (!text) return null;
  const m = text.match(/\[\[ACNE_STATE\]\](.*?)\[\[\/ACNE_STATE\]\]/s);
  if (!m) return null;
  try { return { ...EMPTY_ACNE, ...JSON.parse(m[1]) }; } catch { return null; }
}
export function stripState(text: string | null | undefined): string {
  return (text ?? "").replace(/\[\[ACNE_STATE\]\].*?\[\[\/ACNE_STATE\]\]\s*/s, "").trim();
}
