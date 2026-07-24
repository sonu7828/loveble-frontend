// Build a short, human-readable visit summary string from chart state.
// Used at sign time to give the next provider (and the patient portal) a
// one-paragraph recap like:
// "Tox 28u glabella+frontalis (Botox lot 12345), no AEs, follow-up 12w."

type NeuroState = {
  product?: string;
  lot_number?: string;
  map?: Array<{ zone?: string; units?: number | string }>;
  points?: Array<{ zone?: string; units?: number | string }>;
  adverse?: string[];
};

type FillerState = {
  product?: string;
  syringes_used?: number | string;
  areas?: string[];
  lots?: Array<{ lot_number?: string }>;
  adverse?: string[];
};

type EnergyState = {
  device?: string;
  areas?: string[];
  passes?: number | string;
  energy?: string;
  adverse?: string[];
};

type WellnessState = {
  service_type?: string;
  product?: string;
  dose?: string;
  route?: string;
  adverse?: string[];
};

export interface VisitSummaryInput {
  category: "neurotoxin" | "filler" | "energy" | "wellness" | "consult";
  neuro?: NeuroState;
  filler?: FillerState;
  energy?: EnergyState;
  wellness?: WellnessState;
  followupWeeks?: number | null;
  adverseSeverity?: string | null;
}

const cleanAdverse = (a?: string[]) =>
  (a ?? []).filter((x) => x && x.toLowerCase() !== "none");

function zoneSummary(entries?: Array<{ zone?: string; units?: number | string }>) {
  if (!entries || entries.length === 0) return { zones: [] as string[], total: 0 };
  const byZone = new Map<string, number>();
  let total = 0;
  for (const e of entries) {
    const u = Number(e.units) || 0;
    if (!e.zone || u <= 0) continue;
    byZone.set(e.zone, (byZone.get(e.zone) ?? 0) + u);
    total += u;
  }
  return { zones: Array.from(byZone.keys()), total };
}

export function buildVisitSummary(input: VisitSummaryInput): string {
  const parts: string[] = [];

  if (input.category === "neurotoxin" && input.neuro) {
    const all = [...(input.neuro.map ?? []), ...(input.neuro.points ?? [])];
    const { zones, total } = zoneSummary(all);
    const product = input.neuro.product || "Tox";
    const zoneStr = zones.length ? ` ${zones.join("+")}` : "";
    const lot = input.neuro.lot_number ? ` (lot ${input.neuro.lot_number})` : "";
    parts.push(`${product} ${total}u${zoneStr}${lot}`.trim());
  }

  if (input.category === "filler" && input.filler) {
    const product = input.filler.product || "Filler";
    const ml = Number(input.filler.syringes_used) || 0;
    const areas = (input.filler.areas ?? []).join("+");
    const areaStr = areas ? ` ${areas}` : "";
    const lotNums = (input.filler.lots ?? [])
      .map((l) => l?.lot_number)
      .filter((x): x is string => !!x);
    const lotStr = lotNums.length ? ` (lot ${lotNums.join(", ")})` : "";
    parts.push(`${product} ${ml}mL${areaStr}${lotStr}`.trim());
  }

  if (input.category === "energy" && input.energy) {
    const device = input.energy.device || "Energy device";
    const areas = (input.energy.areas ?? []).join("+");
    const settings: string[] = [];
    if (input.energy.passes) settings.push(`${input.energy.passes} passes`);
    if (input.energy.energy) settings.push(`${input.energy.energy} energy`);
    const settingStr = settings.length ? ` (${settings.join(", ")})` : "";
    parts.push(`${device}${areas ? " " + areas : ""}${settingStr}`.trim());
  }

  if (input.category === "wellness" && input.wellness) {
    const svc = input.wellness.service_type || "Wellness treatment";
    const detail: string[] = [];
    if (input.wellness.product) detail.push(input.wellness.product);
    if (input.wellness.dose) detail.push(input.wellness.dose);
    if (input.wellness.route) detail.push(input.wellness.route);
    parts.push([svc, detail.join(" ")].filter(Boolean).join(" — "));
  }

  // Adverse events
  const adverseList = cleanAdverse(
    input.category === "neurotoxin" ? input.neuro?.adverse :
    input.category === "filler" ? input.filler?.adverse :
    input.category === "energy" ? input.energy?.adverse :
    input.wellness?.adverse,
  );
  if (adverseList.length === 0) {
    parts.push("no AEs");
  } else {
    const sev = input.adverseSeverity ? ` (${input.adverseSeverity})` : "";
    parts.push(`AE: ${adverseList.join(", ")}${sev}`);
  }

  // Follow-up
  if (input.followupWeeks && Number(input.followupWeeks) > 0) {
    parts.push(`follow-up ${Number(input.followupWeeks)}w`);
  }

  return parts.filter(Boolean).join(", ") + ".";
}
