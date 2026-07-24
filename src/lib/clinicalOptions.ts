// Centralized option lists for click-driven clinical documentation.
// Keep everything multi-select / preset where possible — free text only when clinically required.

export const CHIEF_CONCERNS = [
  "Fine lines & wrinkles",
  "Volume loss",
  "Skin laxity",
  "Lip enhancement",
  "Facial contouring",
  "Acne / scarring",
  "Hyperpigmentation / melasma",
  "Rosacea / redness",
  "Texture & pore size",
  "Hair restoration",
  "Body contouring",
  "Weight management",
  "General wellness",
  "Sun damage",
  "Under-eye circles / hollows",
];

export const TREATMENT_GOALS = [
  "Preventative",
  "Rejuvenation",
  "Lift & tighten",
  "Volumization",
  "Smooth dynamic lines",
  "Resurface / brighten",
  "Define jawline",
  "Plump lips",
  "Reduce sweating",
  "Reduce double chin",
];

export const MEDICAL_HISTORY = [
  "None / unremarkable",
  "Pregnancy",
  "Breastfeeding",
  "Autoimmune disorder",
  "Bleeding disorder",
  "Keloid / hypertrophic scarring",
  "Cold sores (HSV)",
  "Neuromuscular disorder",
  "Cardiac disease",
  "Hypertension",
  "Diabetes",
  "Cancer (history)",
  "Active infection",
  "Recent dental work (<2 wks)",
  "Recent vaccination (<2 wks)",
  "Seizure disorder",
  "Thyroid disorder",
  "Other (specify)",
];

export const MEDICATIONS = [
  "None",
  "Anticoagulants (Coumadin/Xarelto/Eliquis)",
  "Antiplatelets (aspirin/Plavix)",
  "NSAIDs (regular use)",
  "Immunosuppressants",
  "Oral retinoids (Accutane)",
  "Topical retinoids",
  "Antibiotics (current)",
  "Steroids (oral/injected)",
  "Hormonal therapy / HRT",
  "Birth control",
  "Antidepressants / SSRI",
  "GLP-1 agonists (Ozempic/Wegovy)",
  "Fish oil / vitamin E",
  "Other (specify)",
];

export const ALLERGIES = [
  "NKDA (no known drug allergies)",
  "Lidocaine",
  "Latex",
  "Bee venom",
  "Hyaluronic acid",
  "Sulfa",
  "Penicillin",
  "Eggs",
  "Topical anesthetics",
  "Adhesive / tape",
  "Other (specify)",
];

export const PRIOR_TREATMENTS = [
  "None",
  "Neurotoxin (Botox/Dysport/Xeomin/Daxxify)",
  "Dermal filler",
  "Biostimulator (Sculptra/Radiesse)",
  "Ultherapy",
  "Laser resurfacing",
  "IPL / BBL",
  "Microneedling / RF microneedling",
  "Chemical peel",
];

export const FITZPATRICK = ["I", "II", "III", "IV", "V", "VI"];

export const SKIN_ASSESSMENT = [
  "Normal",
  "Dry",
  "Oily",
  "Combination",
  "Photodamage",
  "Laxity (mild)",
  "Laxity (moderate)",
  "Laxity (severe)",
  "Active acne",
  "Acne scarring",
  "Rosacea",
  "Hyperpigmentation",
  "Melasma",
  "Telangiectasias",
  "Sebaceous hyperplasia",
];

export const PREGNANCY_STATUS = [
  "Not applicable",
  "Not pregnant / not breastfeeding",
  "Pregnant",
  "Breastfeeding",
  "Trying to conceive",
];

// ===== Procedure: shared =====
export const POST_ASSESSMENT = [
  "Tolerated procedure well",
  "Mild erythema (expected)",
  "Mild edema (expected)",
  "Mild bruising (expected)",
  "Pain controlled",
  "Hemostasis achieved",
  "No immediate adverse event",
];

// ===== Neurotoxin =====
export const NEUROTOXIN_PRODUCTS = ["Botox", "Dysport", "Xeomin", "Daxxify", "Jeuveau", "Letybo"];

// Product inventory: pre-fills lot # + expiration when product is selected.
// Update this list as inventory rotates.
export type ProductStock = { lot: string; exp: string };
export const NEUROTOXIN_INVENTORY: Record<string, ProductStock> = {
  "Botox":   { lot: "D0902AC4F", exp: "2028-04-30" },
  "Daxxify": { lot: "R1012349",  exp: "2027-02-28" },
  "Jeuveau": { lot: "X25021A",   exp: "2028-03-31" },
  "Letybo":  { lot: "USA25002",  exp: "2028-03-23" },
  "Xeomin":  { lot: "534745",    exp: "2027-10-31" },
};
export const FILLER_INVENTORY: Record<string, ProductStock> = {
  "Sculptra (PLLA)":      { lot: "5J3631",    exp: "2028-06-30" },
  "RHA Redensity":        { lot: "25102ILO",  exp: "2027-03-08" },
  "RHA 4":                { lot: "25042ILO",  exp: "2027-01-25" },
  "RHA 3":                { lot: "25042BLO",  exp: "2027-01-20" },
  "RHA 2":                { lot: "25102BLO",  exp: "2027-03-03" },
  "Belotero Balance (+)": { lot: "B00072770", exp: "2027-02-06" },
  "Revanesse Lips+":      { lot: "24J215",    exp: "2026-10-18" },
  "Radiesse (+) Lidocaine": { lot: "A00238550", exp: "2027-10-28" },
  "VAMP":                 { lot: "25C143",    exp: "2027-03-03" },
  "Obagi Magiq":          { lot: "108005",    exp: "2028-11-02" },
};
// Wellness inventory keyed by WELLNESS_SERVICES exact label.
export type WellnessStock = ProductStock & { product?: string; route?: string };
export const WELLNESS_INVENTORY: Record<string, WellnessStock> = {};
export const NEUROTOXIN_DILUTIONS = ["1.0 mL / 100u", "2.0 mL / 100u", "2.5 mL / 100u", "4.0 mL / 100u", "Other"];
export const NEUROTOXIN_TECHNIQUE = ["Intramuscular", "Intradermal", "Microbotox"];
export const NEEDLE_GAUGES = ["30G", "31G", "32G", "33G"];
export const NEUROTOXIN_ZONES = [
  "Glabella", "Hairline (frontal)", "Frontalis", "Crow's feet (L)", "Crow's feet (R)", "Bunny lines (nasalis)",
  "Nasal tip (droopy tip)", "Nostril flare (dilator naris)",
  "Brow lift", "Lip flip", "Gummy smile", "DAO",
  "Mentalis (chin)", "Pebble chin", "Masseter (L)", "Masseter (R)",
  "Nefertiti lift (jawline)",
  "Platysma (neck bands)", "Trapezius", "Hyperhidrosis (axilla)",
  "Hyperhidrosis (palms)", "Hyperhidrosis (scalp)",
  "Other (specify in notes)",
];
export const NEUROTOXIN_ADVERSE = [
  "None", "Mild bruising", "Localized swelling", "Headache",
  "Asymmetry (monitor)", "Ptosis (monitor)", "Brow heaviness",
];

// ===== Filler =====
export const FILLER_PRODUCTS = [
  "Juvederm Ultra XC", "Juvederm Ultra Plus XC", "Juvederm Volbella XC",
  "Juvederm Vollure XC", "Juvederm Voluma XC", "Juvederm Volux XC",
  "Restylane-L", "Restylane Silk", "Restylane Lyft", "Restylane Refyne",
  "Restylane Defyne", "Restylane Kysse", "Restylane Contour", "Restylane Eyelight",
  "RHA Redensity", "RHA 2", "RHA 3", "RHA 4", "Belotero", "Belotero Balance (+)",
  "Versa", "Revanesse Lips+", "VAMP",
  "Sculptra (PLLA)", "Radiesse (CaHA)", "Radiesse (+) Lidocaine", "Obagi Magiq",
];
export const FILLER_AREAS = [
  "Lips (body)", "Lips (border)", "Philtrum", "Nasolabial folds",
  "Marionette lines", "Pre-jowl sulcus", "Cheeks (medial)", "Cheeks (lateral)",
  "Zygoma", "Tear trough", "Chin (anterior projection)", "Chin (vertical)",
  "Jawline (angle)", "Jawline (body)", "Temples", "Nose (non-surgical)",
  "Hands", "Earlobes",
];
export const FILLER_TECHNIQUE = ["Linear threading", "Bolus", "Fanning", "Cross-hatching", "Serial puncture", "Tower"];
export const FILLER_DELIVERY = ["Needle", "Cannula", "Both"];
export const FILLER_ANESTHETIC = ["Topical lidocaine", "Dental block", "Infraorbital block", "Mental block", "Ice", "Pronox", "None"];
export const FILLER_ADVERSE = [
  "None", "Mild bruising", "Localized swelling", "Tenderness",
  "Vascular occlusion (treated)", "Tyndall effect (monitor)",
  "Nodules (monitor)", "Asymmetry (monitor)",
];

// ===== Energy devices & microneedling =====
export const ENERGY_DEVICES = [
  "Ultherapy", "Ultherapy PRIME",
  "RF microneedling (other)", "Pen microneedling", "IPL / BBL",
  "Laser genesis", "Nd:YAG", "CO2 fractional", "Erbium fractional",
  "Hair removal laser", "Vascular laser", "Pico laser",
  // HIFEM / body contouring (Emsculpt / Emsella class)
  "Emsculpt NEO (HIFEM+RF)", "Emsculpt (HIFEM)", "Emsella (HIFEM pelvic floor)",
  "HIFEM (other)", "CoolSculpting (cryolipolysis)", "TruSculpt (RF body)",
];
export const ENERGY_AREAS = [
  // Face / neck
  "Forehead", "Brows", "Cheeks", "Mid-face", "Lower face",
  "Jawline", "Submental", "Neck (anterior)", "Neck (lateral)",
  // Laser hair reduction – face
  "Upper lip", "Chin", "Sideburns", "Full face", "Ears",
  // Body
  "Décolletage", "Chest", "Back (full)", "Back (upper)", "Back (lower)",
  "Shoulders", "Upper arms", "Forearms", "Arms (full)",
  "Underarms", "Abdomen", "Flanks", "Buttocks",
  "Bikini line", "Brazilian", "Thighs", "Knees", "Lower legs", "Legs (full)",
  "Hands", "Feet", "Other (see notes)",
];
export const ENERGY_ENDPOINT = [
  "Pinpoint bleeding", "Erythema", "Mild edema", "No skin change",
  "Pinpoint frosting", "Target tissue temperature achieved",
];
export const ENERGY_ADVERSE = [
  "None", "Erythema (expected)", "Edema (expected)", "Petechiae",
  "Bruising", "PIH risk discussed", "Blistering (monitor)",
];

// ===== Wellness / skincare / peels =====
export const WELLNESS_SERVICES = [
  "Lipotropic injection", "MIC injection",
  "Lipo dissolve (phosphatidylcholine)", "Kybella (deoxycholic acid)",
  "GLP-1 (semaglutide)", "GLP-1 (tirzepatide)",
  "Exosomes (topical)", "Glycolic peel", "Salicylic peel",
  "TCA peel", "Jessner's peel", "Lactic peel", "Retinoid peel", "The Perfect Derma Peel",
  "HydraFacial", "Glo2 Facial", "PRX Facial", "Dermaplane", "LED therapy",
];

// Wellness service types that are injectables — lot # and expiration are
// required for FDA traceability whenever one of these is documented.
export const WELLNESS_INJECTABLE_SERVICES = new Set<string>([
  "Lipotropic injection", "MIC injection",
  "Lipo dissolve (phosphatidylcholine)", "Kybella (deoxycholic acid)",
  "GLP-1 (semaglutide)", "GLP-1 (tirzepatide)",
  
]);

// Provider charting guidance — keyed by WELLNESS_SERVICES exact label.
// Shown as a litigation-tight, click-driven checklist + reference banner
// in the wellness chart note editor when that service_type is selected.
export type WellnessGuidance = {
  title: string;
  banner?: string;          // red/destructive disclaimer banner
  dosing: string[];         // titration schedule, max dose
  route: string;            // recommended route
  storage?: string;         // reconstitution / cold chain
  preCheck: string[];       // must document BEFORE injecting
  counseling: string[];     // must counsel / document discussion
  monitoring: string[];     // ongoing chart fields
  contraindications: string[];
  // 503A/503B compounded medical-necessity attestation. When present, the
  // provider MUST check at least `minRequired` items at each visit; the
  // selections are appended verbatim into the signed chart note to evidence
  // patient-specific "clinical need" under FDCA §503A.
  medicalNecessity?: {
    statuteRef: string;
    minRequired: number;
    items: string[];
  };
};

// Shared "clinical need" checklist for compounded GLP-1 / GIP / glucagon
// agonists (semaglutide, tirzepatide). Tracks the FDA 503A
// patient-specific medical-necessity rationale required after the FDA's
// proposed rule excluding these molecules from the 503B Bulks List
// (public comment period open through June 29, 2026).
const COMPOUNDED_GLP1_NECESSITY = {
  statuteRef:
    "FDCA §503A — patient-specific clinical need for compounded formulation; commercial product is not medically appropriate for THIS patient as documented below.",
  minRequired: 1,
  items: [
    "Documented intolerance / adverse reaction to commercial product (specify in notes)",
    "Allergy or sensitivity to an excipient in the FDA-approved product",
    "Required dose is not commercially available (micro-dose titration / off-label strength)",
    "Combination therapy (e.g. + B12, + cyanocobalamin, + lipotropic) clinically indicated and unavailable commercially",
    "Commercial product is on FDA shortage list on this date — verified",
    "Prior trial of commercial product failed to achieve clinical endpoint at maximum tolerated dose",
    "Patient cannot use commercial pen/auto-injector due to dexterity, visual, or device-handling limitation",
    "Pediatric/geriatric dose adjustment outside labeled strengths required",
  ],
};

export const WELLNESS_GUIDANCE: Record<string, WellnessGuidance> = {
  "GLP-1 (semaglutide)": {
    title: "Compounded Semaglutide — Provider Charting Reference",
    banner:
      "COMPOUNDED SEMAGLUTIDE. Semaglutide was removed from the FDA drug shortage list (2025) and the FDA has PROPOSED excluding it from the 503B Bulks List. Compounded semaglutide may only be dispensed when a documented patient-specific clinical need exists under FDCA §503A. Complete the Medical Necessity checklist below at EVERY visit. Patient-signed compounded-GLP-1 consent (current version) must be on file before administration.",
    dosing: [
      "Initiation: 0.25 mg SubQ once weekly × 4 weeks",
      "Titration: 0.5 → 1.0 → 1.7 → 2.4 mg weekly; increase every 4 weeks as tolerated",
      "Maintenance: 1.7–2.4 mg weekly; do NOT exceed 2.4 mg/week",
      "Hold or down-titrate for Grade ≥2 GI symptoms or dehydration",
      "If dose missed >7 days: resume at last tolerated dose; if >14 days, re-initiate at 0.25 mg",
    ],
    route: "SubQ — rotate abdomen / thigh / upper arm; document site this visit",
    storage:
      "Refrigerate 2–8 °C; protect from light; discard if cloudy/discolored. Record vial lot # + expiration + compounding pharmacy in chart.",
    preCheck: [
      "Active compounded-GLP-1 consent on file (this cycle) — verified",
      "Source 503A pharmacy + lot # + BUD documented",
      "Medical Necessity checklist (below) completed THIS visit",
      "Weight, BMI, BP, HR recorded today",
      "Pregnancy status documented (urine hCG if applicable)",
      "Personal/family hx of medullary thyroid carcinoma or MEN 2 — DENIED",
      "No active pancreatitis, severe GI disease, or active eating disorder",
      "Renal/hepatic function reviewed (if labs on file)",
      "Concurrent meds reviewed (insulin/sulfonylurea hypoglycemia risk, oral contraceptive absorption)",
    ],
    counseling: [
      "Discussed boxed-warning: medullary thyroid C-cell tumors (animal data)",
      "Discussed pancreatitis, gallbladder disease, AKI from dehydration",
      "Discussed anesthesia/aspiration risk — hold ≥1 week pre-op per anesthesia",
      "Discussed pregnancy avoidance; reliable contraception during + 2 months after",
      "Discussed lean-mass loss; protein intake + resistance training advised",
      "Discussed compounded vs commercial (Wegovy/Ozempic) status and FDA proposed rule",
      "Reviewed injection technique, sharps disposal, site rotation",
      "Provided 24/7 contact instructions for severe abdominal pain, persistent vomiting, signs of pancreatitis",
    ],
    monitoring: [
      "Weight + BP each visit; trend documented",
      "GI tolerance grade (0–4) documented",
      "Hydration / oral intake reviewed",
      "Mood / suicidality screen at each visit",
      "Lean mass / nutrition check q3 months",
      "Re-document medical necessity each visit; re-consent annually or when source pharmacy changes",
    ],
    contraindications: [
      "Personal or family hx of MTC or MEN 2 syndrome",
      "Pregnancy, breastfeeding, or actively trying to conceive",
      "History of pancreatitis",
      "Severe gastroparesis or active severe GI disease",
      "Active or recent (within 12 mo) eating disorder",
      "Type 1 diabetes / diabetic ketoacidosis",
      "Severe renal (eGFR <30) or hepatic impairment without specialist clearance",
      "Known hypersensitivity to semaglutide or excipients",
    ],
    medicalNecessity: COMPOUNDED_GLP1_NECESSITY,
  },
  "GLP-1 (tirzepatide)": {
    title: "Compounded Tirzepatide — Provider Charting Reference",
    banner:
      "COMPOUNDED TIRZEPATIDE. Tirzepatide was removed from the FDA drug shortage list (2025) and the FDA has PROPOSED excluding it from the 503B Bulks List. Compounded tirzepatide may only be dispensed when a documented patient-specific clinical need exists under FDCA §503A. Complete the Medical Necessity checklist below at EVERY visit. Patient-signed compounded-GLP-1 consent (current version) must be on file before administration.",
    dosing: [
      "Initiation: 2.5 mg SubQ once weekly × 4 weeks",
      "Titration: 5 → 7.5 → 10 → 12.5 → 15 mg weekly; increase every 4 weeks as tolerated",
      "Maintenance: 5–15 mg weekly; do NOT exceed 15 mg/week",
      "Hold or down-titrate for Grade ≥2 GI symptoms or dehydration",
      "If dose missed >7 days: resume at last tolerated dose; if >14 days, re-initiate at 2.5 mg",
    ],
    route: "SubQ — rotate abdomen / thigh / upper arm; document site this visit",
    storage:
      "Refrigerate 2–8 °C; protect from light; discard if cloudy/discolored. Record vial lot # + expiration + compounding pharmacy in chart.",
    preCheck: [
      "Active compounded-GLP-1 consent on file (this cycle) — verified",
      "Source 503A pharmacy + lot # + BUD documented",
      "Medical Necessity checklist (below) completed THIS visit",
      "Weight, BMI, BP, HR recorded today",
      "Pregnancy status documented (urine hCG if applicable)",
      "Personal/family hx of medullary thyroid carcinoma or MEN 2 — DENIED",
      "No active pancreatitis, severe GI disease, or active eating disorder",
      "Renal/hepatic function reviewed (if labs on file)",
      "Concurrent meds reviewed (insulin/sulfonylurea hypoglycemia risk, oral contraceptive absorption)",
    ],
    counseling: [
      "Discussed boxed-warning: medullary thyroid C-cell tumors (animal data)",
      "Discussed pancreatitis, gallbladder disease, AKI from dehydration",
      "Discussed anesthesia/aspiration risk — hold ≥1 week pre-op per anesthesia",
      "Discussed pregnancy avoidance; reliable contraception during + 2 months after",
      "Discussed lean-mass loss; protein intake + resistance training advised",
      "Discussed compounded vs commercial (Mounjaro/Zepbound) status and FDA proposed rule",
      "Reviewed injection technique, sharps disposal, site rotation",
      "Provided 24/7 contact instructions for severe abdominal pain, persistent vomiting, signs of pancreatitis",
    ],
    monitoring: [
      "Weight + BP each visit; trend documented",
      "GI tolerance grade (0–4) documented",
      "Hydration / oral intake reviewed",
      "Mood / suicidality screen at each visit",
      "Lean mass / nutrition check q3 months",
      "Re-document medical necessity each visit; re-consent annually or when source pharmacy changes",
    ],
    contraindications: [
      "Personal or family hx of MTC or MEN 2 syndrome",
      "Pregnancy, breastfeeding, or actively trying to conceive",
      "History of pancreatitis",
      "Severe gastroparesis or active severe GI disease",
      "Active or recent (within 12 mo) eating disorder",
      "Type 1 diabetes / diabetic ketoacidosis",
      "Severe renal (eGFR <30) or hepatic impairment without specialist clearance",
      "Known hypersensitivity to tirzepatide or excipients",
    ],
    medicalNecessity: COMPOUNDED_GLP1_NECESSITY,
  },
};

export const WELLNESS_ROUTES = ["IM", "SubQ", "IV", "Topical", "Intra-articular"];
export const WELLNESS_ADVERSE = [
  "None", "Injection site bruising", "Injection site tenderness",
  "Nausea", "Lightheadedness", "Erythema (expected)", "Frosting (expected)",
];

// ===== GFE =====
export const GFE_CONCERNS = CHIEF_CONCERNS;

// ===== GFE Assessment & Plan (structured) =====
// Language mirrors the Medical Board of California's Good Faith Exam
// expectations (BPC §2242, §2052, §2400 corporate-practice) and the
// California Board of Registered Nursing standardized-procedure
// requirements for NPs furnishing prescription dangerous drugs/devices
// (BPC §2725, §2836.1; 16 CCR §1474). Items are written so a provider
// can tap one chip and have a defensible, board-ready note.

// Grouped headings used by the GFE form to render checklists in
// clinically meaningful sections.
export const GFE_ASSESSMENT_GROUPS: { title: string; items: string[] }[] = [
  {
    title: "Candidate suitability",
    items: [
      "Patient is ≥18 years old; identity verified via government photo ID",
      "Healthy adult, appropriate aesthetic candidate",
      "Realistic expectations confirmed; goals are achievable with planned treatment",
      "No absolute contraindications identified on history or exam",
      "No active infection, open lesion, or inflammation at planned treatment site",
      "Not pregnant or breastfeeding (verbally confirmed today)",
      "No recent dental work within 2 weeks (filler) / no live vaccine within 2 weeks (tox)",
      "Decisional capacity intact; consent given without coercion",
    ],
  },
  {
    title: "History & risk review",
    items: [
      "Complete medical, surgical, medication and allergy history reviewed today",
      "No history of anaphylaxis to lidocaine, hyaluronic acid, or neurotoxin",
      "No autoimmune neuromuscular disorder (myasthenia, ELS, ALS) — tox safe",
      "No bleeding disorder or active anticoagulant precludes treatment",
      "No active herpes outbreak; prophylaxis prescribed if indicated",
      "Keloid / hypertrophic scarring history reviewed",
      "Prior aesthetic treatments and complications reviewed",
      "Mental-health screen unremarkable; no BDD red flags",
    ],
  },
  {
    title: "Physical / skin exam findings",
    items: [
      "Vitals within normal limits; afebrile",
      "Fitzpatrick skin type and Glogau photoaging documented",
      "Mild dynamic rhytids (glabella / forehead / lateral canthi)",
      "Moderate-to-severe dynamic rhytids appropriate for neuromodulator",
      "Mid-face volume loss noted; appropriate for HA filler",
      "Nasolabial / marionette lines noted; filler candidate",
      "Lip volume / definition loss noted; filler candidate",
      "Tear-trough hollowing noted; cautious filler candidate",
      "Mild-to-moderate skin laxity; energy-device candidate",
      "Photoaging / dyschromia / melasma noted",
      "Active acne / PIH noted",
      "Facial asymmetry noted and discussed with patient",
      "No vascular danger-zone abnormality on inspection",
    ],
  },
  {
    title: "Counseling & informed consent (Cobbs v. Grant)",
    items: [
      "Risks, benefits, alternatives and option of no treatment discussed",
      "Common side effects discussed (bruising, swelling, erythema, tenderness)",
      "Serious risks discussed (infection, granuloma, nodule, asymmetry)",
      "Vascular-occlusion risk (filler) discussed; hyaluronidase reversal protocol explained",
      "Eyelid ptosis / brow asymmetry risk (tox) discussed",
      "Off-label use disclosed where applicable",
      "Post-care instructions reviewed verbally and in writing",
      "All patient questions answered to their stated satisfaction",
      "Written informed consent obtained and on file",
      "Photo documentation obtained (pre-treatment)",
    ],
  },
  {
    title: "NP standardized-procedure compliance (BRN)",
    items: [
      "Practicing under current written standardized procedures with supervising physician",
      "Treatment within NP scope and standardized-procedure authorization",
      "Supervising physician available by phone or in person per protocol",
      "Furnishing number on file; DEA not required (no controlled substances)",
      "Emergency equipment (hyaluronidase, epinephrine, O₂, AED) on-site and in date",
      "Adverse-event reporting pathway reviewed with patient",
    ],
  },
];

// Flat list kept for backward compatibility (PDF/audit code that reads the array).
export const GFE_ASSESSMENT_FINDINGS = GFE_ASSESSMENT_GROUPS.flatMap(g => g.items);

export const GFE_PLAN_GROUPS: { title: string; items: string[] }[] = [
  {
    title: "Today's disposition",
    items: [
      "Proceed with planned treatment today as authorized",
      "Stage treatment over multiple sessions per plan below",
      "Defer treatment today — re-evaluate per follow-up",
      "Decline treatment — outside scope or not clinically appropriate",
      "Refer to dermatology / plastic surgery / PCP for further evaluation",
    ],
  },
  {
    title: "Authorization & validity",
    items: [
      "GFE authorizes the booked services listed above for 12 months from today",
      "Authorization limited to services explicitly listed; new services require a new GFE",
      "Re-authorization required sooner if material change in health, meds, or pregnancy",
      "Same-day repeat treatments by qualified staff permitted under this GFE",
    ],
  },
  {
    title: "Pre-treatment instructions",
    items: [
      "Hold NSAIDs, fish oil, vitamin E, and alcohol 24–48h pre-treatment",
      "Start HSV prophylaxis (valacyclovir) prior to perioral filler if history",
      "Arnica / bromelain optional to reduce bruising",
      "Hydrate well; eat prior to appointment to reduce vasovagal risk",
    ],
  },
  {
    title: "Post-treatment care",
    items: [
      "Cold compress intermittently for 24h; sleep elevated × 2 nights",
      "Avoid strenuous exercise, heat, and alcohol for 24h",
      "Avoid facial manipulation, facials, and dental work for 2 weeks (filler)",
      "Remain upright × 4h and avoid lying flat after neurotoxin",
      "Sun protection SPF 30+ daily",
    ],
  },
  {
    title: "Follow-up & monitoring",
    items: [
      "2-week follow-up for assessment and tox touch-up if needed",
      "4–6 week filler follow-up for result review and photo documentation",
      "Patient to contact clinic immediately for pain, blanching, livedo, or vision change",
      "24/7 emergency line provided; ER instructions reviewed",
      "Adverse-event reporting to manufacturer and CDPH if applicable",
    ],
  },
];

export const GFE_PLAN_TEMPLATES = GFE_PLAN_GROUPS.flatMap(g => g.items);

// One-tap presets that fill a full board-defensible assessment + plan.
export type GfeQuickPreset = {
  id: string;
  label: string;
  description: string;
  findings: string[];
  plan: string[];
};

export const GFE_QUICK_PRESETS: GfeQuickPreset[] = [
  {
    id: "tox-standard",
    label: "Neurotoxin candidate — proceed",
    description: "Standard healthy adult cleared for neuromodulator today.",
    findings: [
      "Patient is ≥18 years old; identity verified via government photo ID",
      "Healthy adult, appropriate aesthetic candidate",
      "Realistic expectations confirmed; goals are achievable with planned treatment",
      "No absolute contraindications identified on history or exam",
      "Not pregnant or breastfeeding (verbally confirmed today)",
      "Complete medical, surgical, medication and allergy history reviewed today",
      "No autoimmune neuromuscular disorder (myasthenia, ELS, ALS) — tox safe",
      "Vitals within normal limits; afebrile",
      "Mild dynamic rhytids (glabella / forehead / lateral canthi)",
      "Risks, benefits, alternatives and option of no treatment discussed",
      "Eyelid ptosis / brow asymmetry risk (tox) discussed",
      "Written informed consent obtained and on file",
      "Photo documentation obtained (pre-treatment)",
      "Practicing under current written standardized procedures with supervising physician",
      "Treatment within NP scope and standardized-procedure authorization",
    ],
    plan: [
      "Proceed with planned treatment today as authorized",
      "GFE authorizes the booked services listed above for 12 months from today",
      "Remain upright × 4h and avoid lying flat after neurotoxin",
      "Avoid strenuous exercise, heat, and alcohol for 24h",
      "2-week follow-up for assessment and tox touch-up if needed",
      "Patient to contact clinic immediately for pain, blanching, livedo, or vision change",
    ],
  },
  {
    id: "filler-standard",
    label: "Dermal filler candidate — proceed (VO protocol)",
    description: "HA filler cleared with vascular-occlusion protocol confirmed.",
    findings: [
      "Patient is ≥18 years old; identity verified via government photo ID",
      "Healthy adult, appropriate aesthetic candidate",
      "Realistic expectations confirmed; goals are achievable with planned treatment",
      "No absolute contraindications identified on history or exam",
      "No active infection, open lesion, or inflammation at planned treatment site",
      "No recent dental work within 2 weeks (filler) / no live vaccine within 2 weeks (tox)",
      "Not pregnant or breastfeeding (verbally confirmed today)",
      "Complete medical, surgical, medication and allergy history reviewed today",
      "No history of anaphylaxis to lidocaine, hyaluronic acid, or neurotoxin",
      "Vitals within normal limits; afebrile",
      "Mid-face volume loss noted; appropriate for HA filler",
      "No vascular danger-zone abnormality on inspection",
      "Risks, benefits, alternatives and option of no treatment discussed",
      "Vascular-occlusion risk (filler) discussed; hyaluronidase reversal protocol explained",
      "Written informed consent obtained and on file",
      "Photo documentation obtained (pre-treatment)",
      "Emergency equipment (hyaluronidase, epinephrine, O₂, AED) on-site and in date",
      "Practicing under current written standardized procedures with supervising physician",
    ],
    plan: [
      "Proceed with planned treatment today as authorized",
      "GFE authorizes the booked services listed above for 12 months from today",
      "Hold NSAIDs, fish oil, vitamin E, and alcohol 24–48h pre-treatment",
      "Cold compress intermittently for 24h; sleep elevated × 2 nights",
      "Avoid facial manipulation, facials, and dental work for 2 weeks (filler)",
      "4–6 week filler follow-up for result review and photo documentation",
      "Patient to contact clinic immediately for pain, blanching, livedo, or vision change",
      "24/7 emergency line provided; ER instructions reviewed",
    ],
  },
  {
    id: "energy-laser",
    label: "Laser / energy device candidate — proceed",
    description: "Skin-resurfacing or laser hair reduction cleared.",
    findings: [
      "Patient is ≥18 years old; identity verified via government photo ID",
      "Healthy adult, appropriate aesthetic candidate",
      "Realistic expectations confirmed; goals are achievable with planned treatment",
      "Fitzpatrick skin type and Glogau photoaging documented",
      "No active infection, open lesion, or inflammation at planned treatment site",
      "Vitals within normal limits; afebrile",
      "Mild-to-moderate skin laxity; energy-device candidate",
      "Risks, benefits, alternatives and option of no treatment discussed",
      "Written informed consent obtained and on file",
      "Photo documentation obtained (pre-treatment)",
      "Practicing under current written standardized procedures with supervising physician",
    ],
    plan: [
      "Proceed with planned treatment today as authorized",
      "Stage treatment over multiple sessions per plan below",
      "Sun protection SPF 30+ daily",
      "Avoid strenuous exercise, heat, and alcohol for 24h",
      "2-week follow-up for assessment and tox touch-up if needed",
    ],
  },
  {
    id: "defer",
    label: "Defer — needs clearance or re-evaluation",
    description: "Treatment deferred today pending further information.",
    findings: [
      "Patient is ≥18 years old; identity verified via government photo ID",
      "Complete medical, surgical, medication and allergy history reviewed today",
      "Risks, benefits, alternatives and option of no treatment discussed",
      "Mental-health screen unremarkable; no BDD red flags",
    ],
    plan: [
      "Defer treatment today — re-evaluate per follow-up",
      "Refer to dermatology / plastic surgery / PCP for further evaluation",
      "Re-authorization required sooner if material change in health, meds, or pregnancy",
    ],
  },
];


