// PROM scoring helpers — raw normalized + Skindex-16 linear transform.
// FACE-Q Rasch transform requires licensed lookup tables from Memorial Sloan Kettering;
// the raw_normalized method is a clinically defensible approximation that produces
// monotonically equivalent ordering. When a Rasch table is later provided, set
// scoring_method='rasch_lookup' and add it to scoring_meta.

export type PromQuestion = {
  id: string;
  text: string;
  scale: string; // e.g. "0-4", "0-3", "0-6", "1-5"
  labels?: string[];
  reverse?: boolean;
};

export type PromInstrument = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  questions: PromQuestion[];
  scoring_method: string;
  scoring_meta: { scale_max?: number; higher_is_better?: boolean; transform?: string; note?: string };
  default_offset_days: number | null;
};

export function scaleMax(scale: string): number {
  const m = scale.match(/^(\d+)-(\d+)$/);
  if (!m) return 4;
  return parseInt(m[2], 10) - parseInt(m[1], 10);
}

export function score(
  instrument: PromInstrument,
  answers: Record<string, number>,
): { raw: number; normalized: number; maxRaw: number } {
  let raw = 0;
  let maxRaw = 0;
  for (const q of instrument.questions) {
    const max = scaleMax(q.scale);
    maxRaw += max;
    const v = answers[q.id];
    if (typeof v !== "number") continue;
    raw += q.reverse ? max - v : v;
  }
  const higherBetter = instrument.scoring_meta?.higher_is_better !== false;
  const pct = maxRaw === 0 ? 0 : (raw / maxRaw) * 100;
  // Normalize so that "higher = better" regardless of underlying scale
  const normalized = higherBetter ? pct : 100 - pct;
  return { raw, normalized: Math.round(normalized * 10) / 10, maxRaw };
}
