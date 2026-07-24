// Evidence-based recommended labs and default prescriptions per category.
// All Medical Wellness offerings are bookable only with Kiem (per project memory).
// Citations included so the printed PDF can reference them.

export type Category = "glp1" | "hrt" | "peptide" | "acne";

export type RxPreset = {
  drug: string;
  strength: string;
  route: string;
  frequency: string;
  duration: string;
  dispense: string;
  refills: number;
  titration?: Array<{ week: number; dose: string; notes?: string }>;
  notes?: string;
};

export type CategoryPreset = {
  label: string;
  recommendedLabs: string[];
  chiefComplaintOptions: string[];
  subjectiveChips: string[];
  objectiveTemplate: string;
  assessmentTemplate: string;
  planChips: string[];
  tolerabilityOptions: string[];
  adverseEventOptions: string[];
  counselingPoints: string[];
  redFlags: string[];
  necessityAttestation: string;
  evidence: string[];
  prescriptions: RxPreset[];
};

const COMMON_HRT_LABS = [
  "Estradiol", "Total Testosterone", "Free Testosterone", "SHBG",
  "FSH", "LH", "DHEA-S", "Progesterone", "Prolactin",
  "TSH", "Free T4", "Free T3",
  // CMP (individual)
  "Sodium", "Potassium", "Creatinine", "eGFR", "Glucose (fasting)", "AST", "ALT",
  // CBC
  "WBC", "Hemoglobin", "Hematocrit", "Platelets",
  // Lipids + others
  "Total Cholesterol", "LDL", "HDL", "Triglycerides", "HbA1c", "Vitamin D 25-OH",
  "PSA (male)", "Mammogram up to date (female)",
];

const COMMON_VITALS = "BP ___/___, HR ___, Wt ___ lb, Ht ___ in, BMI ___. Gen: WDWN, NAD. CV: RRR. Resp: CTAB. Abd: soft, NT, ND.";

export const ENCOUNTER_PRESETS: Record<Category, CategoryPreset> = {
  glp1: {
    label: "GLP-1 Weight Management (Semaglutide / Tirzepatide)",
    // Individual analytes (not panel names) so values + reference ranges show inline.
    recommendedLabs: [
      // CMP
      "Sodium", "Potassium", "Chloride", "CO2 (Bicarbonate)", "BUN", "Creatinine", "eGFR",
      "Glucose (fasting)", "Calcium", "Total Protein", "Albumin", "Total Bilirubin",
      "ALP (Alkaline Phosphatase)", "AST", "ALT", "Lipase",
      // Metabolic
      "HbA1c", "Fasting Insulin",
      // Lipid panel
      "Total Cholesterol", "LDL", "HDL", "Triglycerides",
      // Thyroid + others
      "TSH", "Vitamin D 25-OH",
      // CBC
      "WBC", "Hemoglobin", "Hematocrit", "Platelets",
      // Pregnancy
      "hCG (pregnancy)",
    ],
    chiefComplaintOptions: [
      "Weight loss — initial consult",
      "GLP-1 follow-up — tolerating well",
      "GLP-1 follow-up — GI side effects",
      "Weight plateau — dose escalation",
    ],
    subjectiveChips: [
      "Diet/exercise reviewed; protein 1.2-1.6 g/kg discussed.",
      "Denies severe nausea, vomiting, abdominal pain.",
      "Denies personal/family hx of MTC or MEN-2.",
      "No active pancreatitis or gallbladder disease.",
      "Not pregnant; not planning pregnancy in next 2 months.",
      "Mild nausea, improving with smaller meals.",
      "Constipation — counseled on hydration & fiber.",
    ],
    objectiveTemplate: COMMON_VITALS + " No abdominal tenderness, no thyroid nodules.",
    assessmentTemplate:
      "Patient meets criteria for GLP-1 therapy for weight management. BMI and comorbidities reviewed. No personal or family history of MTC, MEN-2, or active pancreatitis. Risks, benefits, and alternatives discussed. Patient verbalizes understanding.",
    planChips: [
      "Continue current dose x 4 weeks.",
      "Titrate up at next interval as tolerated.",
      "Hold dose escalation due to GI symptoms; reassess in 4 weeks.",
      "Repeat CMP + HbA1c in 12 weeks.",
      "Follow-up visit in 4 weeks.",
      "Follow-up visit in 8 weeks.",
    ],
    tolerabilityOptions: [
      "Well tolerated, no AEs",
      "Mild nausea, manageable",
      "Moderate GI side effects",
      "Severe GI intolerance",
    ],
    adverseEventOptions: [
      "None reported",
      "Nausea (mild)",
      "Constipation",
      "Diarrhea",
      "Fatigue",
      "Injection-site reaction",
    ],
    counselingPoints: [
      "Inject SC in abdomen, thigh, or upper arm; rotate sites weekly.",
      "Expect nausea, early satiety, constipation in first 4-8 weeks; titrate slowly if symptomatic.",
      "Stay hydrated, prioritize protein 1.2-1.6 g/kg, resistance training 2-3x/wk to preserve lean mass.",
      "Hold dose and call clinic for severe abdominal pain, persistent vomiting, dehydration, or vision changes.",
      "Stop and notify provider immediately if pregnancy is suspected; discontinue 2 months before planned conception.",
    ],
    redFlags: [
      "Severe persistent abdominal pain (pancreatitis r/o)",
      "Intractable vomiting / dehydration",
      "Gallbladder pain, jaundice",
      "Hypoglycemia (esp. if on insulin/sulfonylurea)",
      "New thyroid nodule or neck mass",
      "Suicidal ideation",
    ],
    necessityAttestation:
      "503A compounded therapy is medically necessary because the patient requires an individualized dose/strength not available as a commercially manufactured product, and/or the commercial product is on FDA-listed shortage. Patient has been counseled on commercially available alternatives.",
    evidence: [
      "Wilding JPH, et al. Once-Weekly Semaglutide in Adults with Overweight or Obesity (STEP 1). NEJM 2021;384:989-1002. PMID: 33567185",
      "Jastreboff AM, et al. Tirzepatide Once Weekly for the Treatment of Obesity (SURMOUNT-1). NEJM 2022;387:205-216. PMID: 35658024",
      "AACE/ACE Clinical Practice Guidelines for Comprehensive Medical Care of Patients with Obesity. Endocr Pract 2016;22(Suppl 3):1-203.",
    ],
    prescriptions: [
      {
        drug: "Semaglutide (compounded)",
        strength: "2.5 mg/mL",
        route: "Subcutaneous injection",
        frequency: "Once weekly",
        duration: "12 weeks (titration)",
        dispense: "1 multi-dose vial (per month)",
        refills: 2,
        titration: [
          { week: 1, dose: "0.25 mg SC weekly" },
          { week: 5, dose: "0.5 mg SC weekly" },
          { week: 9, dose: "1.0 mg SC weekly" },
          { week: 13, dose: "1.7 mg SC weekly", notes: "if tolerated" },
          { week: 17, dose: "2.4 mg SC weekly (max)", notes: "maintenance" },
        ],
      },
      {
        drug: "Tirzepatide (compounded)",
        strength: "10 mg/mL",
        route: "Subcutaneous injection",
        frequency: "Once weekly",
        duration: "16 weeks (titration)",
        dispense: "1 multi-dose vial (per month)",
        refills: 2,
        titration: [
          { week: 1, dose: "2.5 mg SC weekly" },
          { week: 5, dose: "5 mg SC weekly" },
          { week: 9, dose: "7.5 mg SC weekly" },
          { week: 13, dose: "10 mg SC weekly" },
          { week: 17, dose: "12.5 mg SC weekly" },
          { week: 21, dose: "15 mg SC weekly (max)" },
        ],
      },
    ],
  },


  hrt: {
    label: "Hormone Replacement Therapy (HRT)",
    recommendedLabs: COMMON_HRT_LABS,
    chiefComplaintOptions: [
      "Perimenopausal symptoms — initial consult",
      "Menopause/HRT initiation",
      "Low T (male) — initial consult",
      "HRT follow-up — symptom check",
      "HRT follow-up — labs review",
    ],
    subjectiveChips: [
      "Vasomotor symptoms (hot flashes, night sweats).",
      "Sleep disturbance, mood lability.",
      "Low libido, dyspareunia, GU symptoms.",
      "Fatigue, low energy, reduced muscle mass.",
      "Denies hx of breast/uterine/ovarian cancer.",
      "Denies hx of VTE, CVA, or unexplained vaginal bleeding.",
      "Mammogram up to date (female).",
      "PSA up to date (male).",
      "Symptoms improved on current regimen.",
    ],
    objectiveTemplate: COMMON_VITALS + " Thyroid: no nodules. Breast exam deferred / unremarkable. No edema.",
    assessmentTemplate:
      "Patient with symptomatic hormone deficiency. Symptoms, prior trials, contraindications (hormone-sensitive cancer, active VTE, undiagnosed vaginal bleeding, severe liver disease) reviewed and absent. Mammogram / PSA up to date as appropriate. Risks (VTE, breast cancer, stroke per WHI / ELITE data) and benefits (vasomotor, GU, mood, bone, cardio-metabolic) discussed in detail. Patient elects to proceed.",
    planChips: [
      "Initiate HRT per Rx above.",
      "Continue current regimen; reassess in 12 weeks.",
      "Increase estradiol dose (next step).",
      "Decrease estradiol dose (next step).",
      "Recheck trough labs in 6-8 weeks.",
      "Annual mammogram / PSA reminder given.",
    ],
    tolerabilityOptions: [
      "Symptoms well controlled",
      "Partial relief, dose adjustment needed",
      "Side effects — bloating/breast tenderness",
      "No improvement — switch route/regimen",
    ],
    adverseEventOptions: [
      "None reported",
      "Breast tenderness",
      "Bloating",
      "Spotting/breakthrough bleeding",
      "Mood changes",
      "Skin reaction (patch)",
      "Acne (testosterone)",
    ],
    counselingPoints: [
      "Apply estradiol patch to clean, dry skin below the waist; rotate sites; replace per schedule.",
      "Take oral micronized progesterone at bedtime (sedating).",
      "Testosterone (female): apply cream to inner thigh, alternate sides daily. Avoid skin-to-skin transfer for 4 h.",
      "Testosterone (male): inject SC weekly; rotate sites; monitor for fluid retention, mood lability, acne.",
      "Report: new breast lump, abnormal vaginal bleeding, calf pain/swelling, severe HA / vision change, chest pain.",
    ],
    redFlags: [
      "New breast mass",
      "Abnormal uterine bleeding",
      "Unilateral leg swelling / pain (DVT)",
      "Sudden severe HA, focal neuro deficit, vision loss",
      "Chest pain, shortness of breath",
    ],
    necessityAttestation:
      "Bioidentical hormone therapy is prescribed per patient-specific dose. Where compounded, the formulation is medically necessary due to individualized strength, allergy to commercial excipients, or unavailable commercial route (e.g., compounded testosterone cream for female patient).",
    evidence: [
      "The 2022 Hormone Therapy Position Statement of The North American Menopause Society. Menopause 2022;29:767-794. PMID: 35797481",
      "Endocrine Society Clinical Practice Guideline: Testosterone Therapy in Men with Hypogonadism. JCEM 2018;103:1715-1744. PMID: 29562364",
      "Davis SR, et al. Global Consensus Position Statement on the Use of Testosterone Therapy for Women. JCEM 2019;104:4660-4666. PMID: 31498871",
    ],
    prescriptions: [
      {
        drug: "Estradiol transdermal patch",
        strength: "0.05 mg/24 h",
        route: "Transdermal",
        frequency: "Apply 1 patch every 3 days (twice weekly)",
        duration: "90 days",
        dispense: "24 patches (90-day supply)",
        refills: 3,
      },
      {
        drug: "Micronized Progesterone (Prometrium)",
        strength: "100 mg",
        route: "Oral",
        frequency: "1 capsule PO qhs",
        duration: "90 days",
        dispense: "90 capsules",
        refills: 3,
        notes: "Required for patients with intact uterus on estrogen therapy.",
      },
      {
        drug: "Testosterone Cypionate (female)",
        strength: "20 mg/mL (compounded)",
        route: "Subcutaneous",
        frequency: "10 mg SC once weekly",
        duration: "90 days",
        dispense: "1 vial 5 mL",
        refills: 3,
        notes: "Target free T mid-normal female range. Recheck labs at 6-8 weeks.",
      },
      {
        drug: "Testosterone Cypionate (male)",
        strength: "200 mg/mL",
        route: "Subcutaneous",
        frequency: "100 mg SC once weekly (split BIW optional)",
        duration: "90 days",
        dispense: "1 vial 10 mL",
        refills: 3,
        notes: "Target total T 500-900 ng/dL. Trough labs at 6-8 weeks. Monitor H/H, PSA.",
      },
      {
        drug: "Estradiol Cream (compounded)",
        strength: "1 mg/g",
        route: "Vaginal",
        frequency: "0.5 g per vagina nightly x 2 wks, then 2x/week",
        duration: "90 days",
        dispense: "30 g",
        refills: 3,
        notes: "For GSM / vulvovaginal atrophy.",
      },
    ],
  },

  peptide: {
    label: "Peptide Therapy",
    recommendedLabs: [
      // CMP
      "Sodium", "Potassium", "Creatinine", "eGFR", "Glucose (fasting)",
      "ALP (Alkaline Phosphatase)", "AST", "ALT",
      // CBC
      "WBC", "Hemoglobin", "Hematocrit", "Platelets",
      // Metabolic + lipids + thyroid
      "HbA1c", "Fasting Insulin", "IGF-1",
      "Total Cholesterol", "LDL", "HDL", "Triglycerides", "TSH", "Vitamin D 25-OH",
    ],
    chiefComplaintOptions: [
      "Peptide therapy — initial consult",
      "Tissue repair / recovery (BPC-157)",
      "GH optimization (Ipamorelin/CJC)",
      "Peptide follow-up — tolerability",
    ],
    subjectiveChips: [
      "Discussed 503A compounded status; informed consent obtained.",
      "Denies active malignancy or recent cancer dx.",
      "No retinopathy, severe edema, or carpal tunnel sx.",
      "Tolerating injections well.",
      "Cycling protocol reviewed (e.g., 12 wks on / 4 wks off).",
    ],
    objectiveTemplate: COMMON_VITALS + " No peripheral edema, no thyroid enlargement.",
    assessmentTemplate:
      "Patient seeking peptide therapy for tissue repair / metabolic / wellness indication. Compounded peptide therapy discussed including 503A regulatory status and limited long-term safety data. Risks/benefits/alternatives reviewed. Patient consents.",
    planChips: [
      "Initiate per Rx above.",
      "Continue cycle; reassess in 8 weeks.",
      "Add cycle break (4 weeks off).",
      "Recheck IGF-1 / CMP in 12 weeks.",
    ],
    tolerabilityOptions: [
      "Well tolerated",
      "Mild injection-site reaction",
      "Fluid retention",
      "Discontinue due to AE",
    ],
    adverseEventOptions: [
      "None reported",
      "Injection-site redness",
      "Headache",
      "Fluid retention / edema",
      "Carpal tunnel symptoms",
    ],
    counselingPoints: [
      "Reconstitute with bacteriostatic water per pharmacy instructions; store refrigerated.",
      "Inject SC at recommended time of day (BPC/TB-500 anytime; GH secretagogues at bedtime on empty stomach).",
      "Cycle therapy per protocol (typically 8-12 weeks on, 4 weeks off) to reduce receptor desensitization.",
      "Discontinue and call clinic for injection-site reaction, persistent HA, palpitations, severe edema.",
    ],
    redFlags: [
      "Suspected malignancy (relative contraindication to GH secretagogues)",
      "Active retinopathy",
      "Severe edema / fluid retention",
      "Carpal tunnel symptoms",
    ],
    necessityAttestation:
      "Peptide therapy is compounded under 503A pharmacy regulations per patient-specific prescription. Patient counseled that these formulations are not FDA-approved for the indication and elects therapy with informed consent.",
    evidence: [
      "Sigalos JT, Pastuszak AW. The Safety and Efficacy of Growth Hormone Secretagogues. Sex Med Rev 2018;6:45-53. PMID: 28526632",
      "Chang CH, et al. Pentadecapeptide BPC 157 — A Review of Current Status. Curr Pharm Des 2018;24:1856-1864. PMID: 29879879",
    ],
    prescriptions: [
      {
        drug: "BPC-157 (compounded)",
        strength: "5 mg vial",
        route: "Subcutaneous",
        frequency: "250 mcg SC twice daily",
        duration: "8 weeks",
        dispense: "2 vials",
        refills: 1,
      },
      {
        drug: "Ipamorelin / CJC-1295 (no DAC) (compounded)",
        strength: "5 mg / 5 mg blend per vial",
        route: "Subcutaneous",
        frequency: "300 mcg SC at bedtime, 5 nights/week",
        duration: "12 weeks",
        dispense: "3 vials",
        refills: 1,
        notes: "Empty stomach; cycle 12 wks on / 4 wks off.",
      },
      {
        drug: "Tesamorelin (compounded)",
        strength: "2 mg vial",
        route: "Subcutaneous",
        frequency: "1 mg SC at bedtime daily",
        duration: "12 weeks",
        dispense: "12 vials",
        refills: 1,
      },
    ],
  },

  acne: {
    label: "Acne Vulgaris (AAD 2024 Guidelines)",
    // Short analyte names only. The Guided Acne tool drives the conditional logic
    // (which labs are needed for which pathway: isotretinoin / iPLEDGE / hormonal / spiro).
    recommendedLabs: [
      "hCG (urine)",
      "CBC",
      "CMP",
      "Lipid panel",
      "AST/ALT",
      "Potassium",
      "Creatinine / eGFR",
      "Total Testosterone",
      "Free Testosterone",
      "DHEA-S",
      "17-OH progesterone",
      "LH",
      "FSH",
      "Prolactin",
      "HbA1c",
      "Fasting insulin",
    ],
    chiefComplaintOptions: [
      "Acne — initial consult (mild)",
      "Acne — initial consult (moderate)",
      "Acne — initial consult (severe / nodulocystic)",
      "Acne follow-up — response check",
      "Acne — hormonal (female, jawline)",
      "Acne — isotretinoin evaluation",
    ],
    subjectiveChips: [
      "Comedonal (blackheads/whiteheads) predominant.",
      "Inflammatory papules and pustules.",
      "Nodulocystic lesions, scarring present.",
      "Jawline / perimenstrual flare — hormonal pattern.",
      "Failed OTC benzoyl peroxide / salicylic acid.",
      "Failed prior topical retinoid / antibiotic.",
      "No current pregnancy; reliable contraception in place.",
      "Denies hx of IBD, depression, or hyperlipidemia (isotretinoin screening).",
      "Skin care reviewed: gentle cleanser BID, non-comedogenic moisturizer, daily SPF 30+.",
    ],
    objectiveTemplate:
      "Face: comedones ___, inflammatory papules ___, pustules ___, nodules/cysts ___. Distribution: forehead / cheeks / chin / jawline / chest / back. Scarring: none / atrophic / hypertrophic. PIH: present / absent. Severity (IGA): 0 clear / 1 almost clear / 2 mild / 3 moderate / 4 severe.",
    assessmentTemplate:
      "Acne vulgaris, severity per IGA scale. Treatment selected per AAD 2024 evidence-based guidelines using a stepwise approach. Risks/benefits/alternatives reviewed including pregnancy considerations, photosensitivity, antibiotic stewardship, and isotretinoin teratogenicity where applicable. Patient verbalizes understanding.",
    planChips: [
      "STEP 1 (mild): Topical retinoid qhs + BPO wash AM.",
      "STEP 2 (moderate): Add topical clindamycin or oral doxycycline 100 mg BID x 12 wks.",
      "STEP 3 (severe/scarring): Refer/initiate isotretinoin workup (iPLEDGE).",
      "Hormonal (female): Add spironolactone 50 mg PO daily, titrate to 100 mg.",
      "Reassess at 8-12 weeks for response.",
      "If improved: continue current regimen.",
      "If no improvement at 12 wks: step up to next tier.",
      "Maintenance (when clear): topical retinoid + BPO, taper antibiotics.",
      "Discontinue oral antibiotic — switch to topical maintenance.",
      "Follow-up visit in 8 weeks.",
      "Follow-up visit in 12 weeks.",
    ],
    tolerabilityOptions: [
      "Well tolerated, lesion count improving",
      "Mild dryness/irritation — manageable",
      "Significant irritation — reduce frequency",
      "No improvement at 12 weeks — step up",
      "Cleared — transition to maintenance",
    ],
    adverseEventOptions: [
      "None reported",
      "Dryness / peeling",
      "Erythema / irritation",
      "Photosensitivity",
      "GI upset (oral antibiotic)",
      "Hyperkalemia symptoms (spironolactone)",
      "Mood changes / dryness (isotretinoin)",
    ],
    counselingPoints: [
      "Apply topicals to clean, dry skin; pea-sized amount for entire face. Retinoids at bedtime only.",
      "Expect 8-12 weeks before judging efficacy; initial purge/dryness common in first 2-4 weeks.",
      "Daily broad-spectrum SPF 30+ — retinoids and doxycycline increase photosensitivity.",
      "Doxycycline: take with full glass of water, remain upright 30 min, avoid dairy/antacids within 2 h, no sun.",
      "Spironolactone (female only): reliable contraception required (anti-androgen, teratogenic to male fetus); monitor K+ if on ACE/ARB or > 45 yo.",
      "Isotretinoin: iPLEDGE enrollment, 2 forms contraception, monthly hCG + labs, no blood donation, dry skin/lips expected, monitor mood.",
      "Avoid scrubbing, picking, comedogenic products. Non-comedogenic moisturizer + gentle cleanser.",
      "Limit oral antibiotic course to ≤ 3 months when possible (antibiotic stewardship).",
    ],
    redFlags: [
      "Severe scarring or nodulocystic disease not responding to standard therapy",
      "New mood changes / suicidal ideation (isotretinoin)",
      "Pregnancy on isotretinoin/spironolactone — STOP immediately",
      "Hyperkalemia symptoms on spironolactone (palpitations, weakness)",
      "Severe GI symptoms / pseudotumor cerebri sx on doxycycline",
      "Signs of DRESS/Stevens-Johnson (rash + fever + mucosal involvement)",
    ],
    necessityAttestation:
      "Treatment prescribed per AAD 2024 evidence-based acne guidelines. Therapy individualized to severity (IGA), distribution, scarring risk, and patient-specific contraindications. Where compounded formulations are used, medical necessity is based on individualized strength/vehicle not commercially available.",
    evidence: [
      "Reynolds RV, et al. Guidelines of care for the management of acne vulgaris (AAD 2024). J Am Acad Dermatol 2024;90:1006.e1-1006.e30. PMID: 38300170",
      "Zaenglein AL, et al. AAD Guidelines of care for the management of acne vulgaris. J Am Acad Dermatol 2016;74:945-973. PMID: 26897386",
      "Layton AM, et al. Hormonal therapy for acne — spironolactone evidence review. Br J Dermatol 2017;176:1118-1124. PMID: 28321852",
      "Bagatin E, et al. Adult female acne: a guide to clinical practice. An Bras Dermatol 2019;94:62-75. PMID: 30726466",
    ],
    prescriptions: [
      {
        drug: "Tretinoin cream",
        strength: "0.025%",
        route: "Topical",
        frequency: "Pea-sized amount to entire face qhs (start 3x/week, titrate up as tolerated)",
        duration: "90 days",
        dispense: "45 g tube",
        refills: 3,
        notes: "Step 1 — mild comedonal/inflammatory acne. Pair with BPO wash AM.",
      },
      {
        drug: "Benzoyl peroxide wash",
        strength: "4-5%",
        route: "Topical",
        frequency: "Apply to wet skin, lather, leave 1-2 min, rinse — daily AM",
        duration: "90 days",
        dispense: "170 g bottle",
        refills: 3,
        notes: "Step 1 base therapy. Prevents antibiotic resistance when combined w/ topical/oral abx.",
      },
      {
        drug: "Clindamycin 1% / Benzoyl peroxide 5% gel",
        strength: "1% / 5%",
        route: "Topical",
        frequency: "Apply thin layer to affected areas BID",
        duration: "90 days",
        dispense: "50 g pump",
        refills: 3,
        notes: "Step 2 — mild-moderate inflammatory acne.",
      },
      {
        drug: "Doxycycline hyclate",
        strength: "100 mg",
        route: "Oral",
        frequency: "1 capsule PO BID with food",
        duration: "12 weeks (max), then reassess for taper",
        dispense: "180 capsules",
        refills: 0,
        notes: "Step 2 — moderate-severe inflammatory acne. ALWAYS combine w/ topical BPO. Reassess at 12 wks; transition to topical maintenance.",
      },
      {
        drug: "Spironolactone",
        strength: "50 mg",
        route: "Oral",
        frequency: "1 tab PO daily x 4 wks, then increase to 100 mg daily if tolerated",
        duration: "90 days",
        dispense: "90 tablets",
        refills: 3,
        titration: [
          { week: 1, dose: "50 mg PO daily", notes: "starting dose" },
          { week: 5, dose: "100 mg PO daily", notes: "if tolerated and partial response" },
          { week: 13, dose: "150-200 mg PO daily (max)", notes: "only if persistent hormonal acne and BP/K+ stable" },
        ],
        notes: "Female only. Reliable contraception required. Check K+ if on ACE/ARB, age > 45, or renal impairment. Reassess at 12 wks.",
      },
      {
        drug: "Adapalene gel",
        strength: "0.3%",
        route: "Topical",
        frequency: "Pea-sized to entire face qhs",
        duration: "90 days",
        dispense: "45 g tube",
        refills: 3,
        notes: "Alternative retinoid — better tolerated, similar efficacy.",
      },
      {
        drug: "Isotretinoin (referral / iPLEDGE)",
        strength: "0.5 mg/kg/day starting; goal cumulative 120-150 mg/kg",
        route: "Oral",
        frequency: "Divided BID with fatty meal",
        duration: "5-6 month course",
        dispense: "Per iPLEDGE monthly dispensing",
        refills: 0,
        notes: "Step 3 — severe nodulocystic/scarring acne or treatment-refractory. iPLEDGE enrollment, 2 forms contraception (female), monthly hCG + CMP + lipids + CBC. Counsel on teratogenicity, mood, dryness, photosensitivity.",
      },
    ],
  },
};

export const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "glp1", label: "GLP-1 (Semaglutide / Tirzepatide)" },
  
  { value: "hrt", label: "Hormone Replacement Therapy" },
  { value: "peptide", label: "Peptide Therapy" },
  { value: "acne", label: "Acne Vulgaris" },
];
