// Lightweight rules-based interaction alerts for the chart-open banner.
// Inputs are GFE-recorded allergies + meds + service category about to be performed.
// Returns a list of human-readable alerts {severity, message}.

export type AlertSeverity = "critical" | "warning" | "info";
export interface SafetyAlert {
  severity: AlertSeverity;
  message: string;
}

const ANTICOAG = /(warfarin|coumadin|eliquis|apixaban|xarelto|rivaroxaban|pradaxa|dabigatran|heparin|lovenox|enoxaparin|plavix|clopidogrel|aspirin)/i;
const NSAID = /(ibuprofen|advil|motrin|naproxen|aleve|nsaid|toradol|ketorolac|aspirin)/i;
const ISOTRETINOIN = /(accutane|isotretinoin|roaccutane)/i;
const PHOTOSENSITIZER = /(doxycycline|tetracycline|minocycline|hydrochlorothiazide|amiodarone|st\.? john)/i;
const COLDSORE = /(cold sore|herpes|hsv|valtrex|valacyclovir)/i;
const GLP1_HOLD = /(ozempic|wegovy|semaglutide|mounjaro|zepbound|tirzepatide|saxenda|liraglutide|glp.?1)/i;
const PREGNANCY = /(pregnan|nursing|breastfeed|lactating)/i;

export function computeInteractionAlerts(opts: {
  category: "neurotoxin" | "filler" | "energy" | "wellness" | "consult" | null;
  serviceName?: string | null;
  meds: string[];      // GFE current_medications + other
  allergies: string[]; // GFE allergies + other
  newMedsSinceGfe?: string;
  dob?: string | null;
}): SafetyAlert[] {
  const out: SafetyAlert[] = [];
  const medText = [...(opts.meds ?? []), opts.newMedsSinceGfe ?? ""].join(" \n ");
  const allergyText = (opts.allergies ?? []).join(" \n ");
  const cat = opts.category;
  const svc = (opts.serviceName ?? "").toLowerCase();
  const injectable = cat === "neurotoxin" || cat === "filler" || cat === "wellness";
  const laser = cat === "energy";

  // Anticoagulants before any injectable → bruising / hematoma risk
  if (injectable && ANTICOAG.test(medText)) {
    out.push({
      severity: "critical",
      message: "Anticoagulant on med list — verify hold instructions or accept elevated bruising/hematoma risk before injecting.",
    });
  }

  // NSAIDs before injectable → bruising risk (warning)
  if (injectable && NSAID.test(medText) && !ANTICOAG.test(medText)) {
    out.push({
      severity: "warning",
      message: "NSAID use noted — counsel on bruising risk; hold 48h pre-treatment when feasible.",
    });
  }

  // Isotretinoin before laser/microneedling → delayed healing / scarring
  if (laser && ISOTRETINOIN.test(medText)) {
    out.push({
      severity: "critical",
      message: "Isotretinoin use noted — laser / microneedling typically deferred until 6 months after last dose. Confirm before proceeding.",
    });
  }

  // Photosensitizers before laser
  if (laser && PHOTOSENSITIZER.test(medText)) {
    out.push({
      severity: "warning",
      message: "Photosensitizing medication noted — reduce fluence and counsel on strict sun avoidance.",
    });
  }

  // Cold sore history before perioral / lip filler → consider prophylaxis
  if (cat === "filler" && (/(lip|perioral|peri.?oral)/i.test(svc)) && COLDSORE.test([medText, allergyText].join(" "))) {
    out.push({
      severity: "warning",
      message: "Cold sore / HSV history near lip treatment — consider valacyclovir prophylaxis before injecting the lips.",
    });
  }

  // Pregnancy mentioned — all injectables / lasers contraindicated
  if (PREGNANCY.test([medText, allergyText].join(" "))) {
    out.push({
      severity: "critical",
      message: "Pregnancy / breastfeeding mention on chart — most aesthetic injectables and lasers are contraindicated. Confirm with patient before continuing.",
    });
  }

  // GLP-1: facial volume loss caveat for filler counseling
  if (cat === "filler" && GLP1_HOLD.test(medText)) {
    out.push({
      severity: "info",
      message: "Patient on GLP-1 — anticipate ongoing facial volume loss; counsel on conservative dosing and likely earlier touch-ups.",
    });
  }

  // Generic allergy alerts that map to common injectables
  if (cat === "filler" && /lidocaine/i.test(allergyText)) {
    out.push({
      severity: "critical",
      message: "Lidocaine allergy on file — switch to a non-lidocaine filler formulation or use alternative anesthesia.",
    });
  }
  if ((cat === "neurotoxin" || cat === "filler") && /albumin|egg|cow.?milk/i.test(allergyText)) {
    out.push({
      severity: "warning",
      message: "Albumin / protein allergy on file — review product excipients before injecting.",
    });
  }

  return out;
}
