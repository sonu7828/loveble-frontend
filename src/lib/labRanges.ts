// Reference ranges for individual lab analytes — used by EncounterEditor's
// "I already have labs" entry mode to show normal range hints and color-coded status.
//
// Sources: LabCorp/Quest adult reference ranges; ADA HbA1c criteria; ATP III lipids;
// AGA/AACE lipase; KDIGO eGFR. These are widely accepted clinical reference ranges
// and intended as guidance only — final interpretation rests with the clinician.

export type LabStatus = "green" | "yellow" | "red";

export type LabRange = {
  analyte: string;          // canonical analyte name (matches recommendedLabs entry exactly)
  unit: string;             // display unit
  normalLow: number;
  normalHigh: number;
  hint: string;             // "Normal X–Y unit" tagline
  // Returns red for clinically significant / actionable; yellow for borderline; green otherwise.
  statusFor: (v: number) => LabStatus;
};

const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi;

export const LAB_RANGES: LabRange[] = [
  // ── BMP / CMP ─────────────────────────────────────────────
  { analyte: "Sodium", unit: "mmol/L", normalLow: 135, normalHigh: 145,
    hint: "Normal 135–145 mmol/L",
    statusFor: v => (v < 130 || v > 150 ? "red" : inRange(v, 135, 145) ? "green" : "yellow") },
  { analyte: "Potassium", unit: "mmol/L", normalLow: 3.5, normalHigh: 5.0,
    hint: "Normal 3.5–5.0 mmol/L · Hold GLP-1 escalation if K ≥5.5",
    statusFor: v => (v < 3.0 || v >= 5.5 ? "red" : inRange(v, 3.5, 5.0) ? "green" : "yellow") },
  { analyte: "Chloride", unit: "mmol/L", normalLow: 98, normalHigh: 107,
    hint: "Normal 98–107 mmol/L",
    statusFor: v => (inRange(v, 98, 107) ? "green" : v < 95 || v > 112 ? "red" : "yellow") },
  { analyte: "CO2 (Bicarbonate)", unit: "mmol/L", normalLow: 22, normalHigh: 29,
    hint: "Normal 22–29 mmol/L",
    statusFor: v => (inRange(v, 22, 29) ? "green" : v < 18 || v > 32 ? "red" : "yellow") },
  { analyte: "BUN", unit: "mg/dL", normalLow: 7, normalHigh: 20,
    hint: "Normal 7–20 mg/dL",
    statusFor: v => (inRange(v, 7, 20) ? "green" : v > 30 ? "red" : "yellow") },
  { analyte: "Creatinine", unit: "mg/dL", normalLow: 0.6, normalHigh: 1.2,
    hint: "Normal 0.6–1.2 mg/dL",
    statusFor: v => (inRange(v, 0.6, 1.2) ? "green" : v > 1.5 ? "red" : "yellow") },
  { analyte: "eGFR", unit: "mL/min/1.73m²", normalLow: 60, normalHigh: 120,
    hint: "≥60 acceptable · <30 avoid most renally-cleared meds",
    statusFor: v => (v >= 60 ? "green" : v < 30 ? "red" : "yellow") },
  { analyte: "Glucose (fasting)", unit: "mg/dL", normalLow: 70, normalHigh: 99,
    hint: "Normal 70–99 mg/dL · Pre-DM 100–125 · DM ≥126",
    statusFor: v => (v >= 126 || v < 60 ? "red" : v > 99 ? "yellow" : "green") },
  { analyte: "Calcium", unit: "mg/dL", normalLow: 8.5, normalHigh: 10.5,
    hint: "Normal 8.5–10.5 mg/dL",
    statusFor: v => (inRange(v, 8.5, 10.5) ? "green" : v < 8.0 || v > 11.0 ? "red" : "yellow") },
  { analyte: "Total Protein", unit: "g/dL", normalLow: 6.0, normalHigh: 8.3,
    hint: "Normal 6.0–8.3 g/dL",
    statusFor: v => (inRange(v, 6.0, 8.3) ? "green" : "yellow") },
  { analyte: "Albumin", unit: "g/dL", normalLow: 3.5, normalHigh: 5.0,
    hint: "Normal 3.5–5.0 g/dL",
    statusFor: v => (inRange(v, 3.5, 5.0) ? "green" : v < 3.0 ? "red" : "yellow") },
  { analyte: "Total Bilirubin", unit: "mg/dL", normalLow: 0.1, normalHigh: 1.2,
    hint: "Normal 0.1–1.2 mg/dL",
    statusFor: v => (v <= 1.2 ? "green" : v > 2.5 ? "red" : "yellow") },
  { analyte: "ALP (Alkaline Phosphatase)", unit: "U/L", normalLow: 44, normalHigh: 147,
    hint: "Normal 44–147 U/L",
    statusFor: v => (inRange(v, 44, 147) ? "green" : v > 250 ? "red" : "yellow") },
  { analyte: "AST", unit: "U/L", normalLow: 10, normalHigh: 40,
    hint: "Normal 10–40 U/L · Hold if >3× ULN (>120)",
    statusFor: v => (v > 120 ? "red" : v > 40 ? "yellow" : "green") },
  { analyte: "ALT", unit: "U/L", normalLow: 7, normalHigh: 56,
    hint: "Normal 7–56 U/L · Hold if >3× ULN (>168)",
    statusFor: v => (v > 168 ? "red" : v > 56 ? "yellow" : "green") },
  { analyte: "Lipase", unit: "U/L", normalLow: 13, normalHigh: 60,
    hint: "Normal 13–60 U/L · STOP GLP-1 if >3× ULN (pancreatitis risk)",
    statusFor: v => (v > 180 ? "red" : v > 60 ? "yellow" : "green") },

  // ── CBC ───────────────────────────────────────────────────
  { analyte: "WBC", unit: "10³/µL", normalLow: 4.0, normalHigh: 11.0,
    hint: "Normal 4.0–11.0 × 10³/µL",
    statusFor: v => (v < 3.0 || v > 13 ? "red" : inRange(v, 4.0, 11.0) ? "green" : "yellow") },
  { analyte: "Hemoglobin", unit: "g/dL", normalLow: 12.0, normalHigh: 17.0,
    hint: "Normal F 12–16 · M 13.5–17.5 g/dL",
    statusFor: v => (v < 10 ? "red" : inRange(v, 12.0, 17.5) ? "green" : "yellow") },
  { analyte: "Hematocrit", unit: "%", normalLow: 36, normalHigh: 50,
    hint: "Normal F 36–46 · M 41–53 %",
    statusFor: v => (v < 30 ? "red" : inRange(v, 36, 53) ? "green" : "yellow") },
  { analyte: "Platelets", unit: "10³/µL", normalLow: 150, normalHigh: 400,
    hint: "Normal 150–400 × 10³/µL",
    statusFor: v => (v < 100 || v > 500 ? "red" : inRange(v, 150, 400) ? "green" : "yellow") },

  // ── HbA1c / Insulin ───────────────────────────────────────
  { analyte: "HbA1c", unit: "%", normalLow: 4.0, normalHigh: 5.6,
    hint: "Normal <5.7% · Pre-DM 5.7–6.4 · DM ≥6.5",
    statusFor: v => (v >= 6.5 ? "red" : v >= 5.7 ? "yellow" : "green") },
  { analyte: "Fasting Insulin", unit: "µIU/mL", normalLow: 2, normalHigh: 25,
    hint: "Normal 2–25 µIU/mL (lower better)",
    statusFor: v => (v > 25 ? "yellow" : "green") },

  // ── Lipids ────────────────────────────────────────────────
  { analyte: "Total Cholesterol", unit: "mg/dL", normalLow: 100, normalHigh: 199,
    hint: "Desirable <200 mg/dL",
    statusFor: v => (v >= 240 ? "red" : v >= 200 ? "yellow" : "green") },
  { analyte: "LDL", unit: "mg/dL", normalLow: 0, normalHigh: 99,
    hint: "Optimal <100 · High ≥160 mg/dL",
    statusFor: v => (v >= 160 ? "red" : v >= 100 ? "yellow" : "green") },
  { analyte: "HDL", unit: "mg/dL", normalLow: 40, normalHigh: 100,
    hint: "M ≥40 · F ≥50 mg/dL (higher better)",
    statusFor: v => (v < 40 ? "red" : v < 50 ? "yellow" : "green") },
  { analyte: "Triglycerides", unit: "mg/dL", normalLow: 0, normalHigh: 149,
    hint: "Normal <150 · Hold isotretinoin if ≥500",
    statusFor: v => (v >= 500 ? "red" : v >= 150 ? "yellow" : "green") },

  // ── Thyroid / Vitamin D / hCG ─────────────────────────────
  { analyte: "TSH", unit: "mIU/L", normalLow: 0.4, normalHigh: 4.5,
    hint: "Normal 0.4–4.5 mIU/L",
    statusFor: v => (v < 0.1 || v > 10 ? "red" : inRange(v, 0.4, 4.5) ? "green" : "yellow") },
  { analyte: "Free T4", unit: "ng/dL", normalLow: 0.8, normalHigh: 1.8,
    hint: "Normal 0.8–1.8 ng/dL",
    statusFor: v => (inRange(v, 0.8, 1.8) ? "green" : "yellow") },
  { analyte: "Free T3", unit: "pg/mL", normalLow: 2.3, normalHigh: 4.2,
    hint: "Normal 2.3–4.2 pg/mL",
    statusFor: v => (inRange(v, 2.3, 4.2) ? "green" : "yellow") },
  { analyte: "Vitamin D 25-OH", unit: "ng/mL", normalLow: 30, normalHigh: 100,
    hint: "Sufficient ≥30 ng/mL · Deficient <20",
    statusFor: v => (v < 20 ? "red" : v < 30 ? "yellow" : "green") },
  { analyte: "hCG (pregnancy)", unit: "mIU/mL", normalLow: 0, normalHigh: 5,
    hint: "Must be NEGATIVE (<5 mIU/mL) before GLP-1, isotretinoin, spironolactone",
    statusFor: v => (v >= 5 ? "red" : "green") },

  // ── Sex hormones (HRT) — for completeness if used in HRT visits ───
  { analyte: "Estradiol", unit: "pg/mL", normalLow: 15, normalHigh: 350,
    hint: "Premenopausal varies by cycle · Postmenopausal <30",
    statusFor: () => "green" },
  { analyte: "Total Testosterone", unit: "ng/dL", normalLow: 264, normalHigh: 916,
    hint: "M 264–916 ng/dL · F 8–60",
    statusFor: () => "green" },
  { analyte: "Free Testosterone", unit: "pg/mL", normalLow: 9, normalHigh: 30,
    hint: "M 9–30 pg/mL · F 0.3–1.9",
    statusFor: () => "green" },
  { analyte: "SHBG", unit: "nmol/L", normalLow: 10, normalHigh: 80,
    hint: "M 10–57 · F 18–144 nmol/L",
    statusFor: () => "green" },
  { analyte: "DHEA-S", unit: "µg/dL", normalLow: 35, normalHigh: 430,
    hint: "Age-dependent; declines with age",
    statusFor: () => "green" },
  { analyte: "IGF-1", unit: "ng/mL", normalLow: 80, normalHigh: 300,
    hint: "Age-dependent · Peptide therapy target mid-normal",
    statusFor: v => (v > 400 ? "red" : v > 300 ? "yellow" : "green") },
];

export function findLabRange(analyte: string): LabRange | undefined {
  const n = analyte.trim().toLowerCase();
  return LAB_RANGES.find(r => r.analyte.toLowerCase() === n);
}

export function classifyLab(analyte: string, rawValue: string): { range: LabRange; status: LabStatus } | null {
  if (!rawValue || !rawValue.trim()) return null;
  const v = Number(rawValue);
  if (!Number.isFinite(v)) return null;
  const range = findLabRange(analyte);
  if (!range) return null;
  return { range, status: range.statusFor(v) };
}
