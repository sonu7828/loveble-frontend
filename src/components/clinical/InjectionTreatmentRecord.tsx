// Unified treatment record — single template for all injectable / energy /
// wellness charting. Combines:
//   • anatomical face/body reference image
//   • tap-to-mark injection sites (with per-pin product/lot/expiration)
//   • areas-treated list with unit inputs & guardrails (optional)
//   • Face/Body toggle, totals, notes, last-visit ghost overlay
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import anatomyImg from "@/assets/anatomy-chart-v2.jpg";
import { useToxGuardrails, classifyUnits } from "@/lib/toxGuardrails";

const ANATOMY_URL = anatomyImg;

export type ZoneEntry = { zone: string; units: number };

export type MapPoint = {
  x: number;            // 0–100 in svg viewBox units
  y: number;
  units?: number;
  label?: string;
  view?: "face" | "body";  // legacy; ignored (single anatomy view)
  product?: string;
  lot?: string;
  expiration?: string;  // YYYY-MM-DD
};

type Props = {
  /** Areas-treated list. Pass [] to hide the list column (points-only mode). */
  zones?: string[];
  value?: ZoneEntry[];
  onChange?: (next: ZoneEntry[]) => void;
  notes?: string;
  onNotesChange?: (next: string) => void;
  unitLabel?: string;
  /** Product key used to look up dosing guardrails (e.g., "Botox", "Dysport"). */
  product?: string;

  /** Tap-to-mark pins. Pass onPointsChange to enable. */
  points?: MapPoint[];
  onPointsChange?: (next: MapPoint[]) => void;
  withPointUnits?: boolean;
  productOptions?: string[];
  previousPoints?: MapPoint[];
  previousLabel?: string;
};

type Highlight =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "path"; d: string };

const HIGHLIGHTS: Record<string, Highlight> = {
  "Glabella": { kind: "ellipse", cx: 50, cy: 38, rx: 3.5, ry: 2.5 },
  "Hairline (frontal)": { kind: "path", d: "M28 18 Q50 12 72 18" },
  "Frontalis": { kind: "path", d: "M30 22 Q50 16 70 22 L68 32 Q50 28 32 32 Z" },
  "Crow's feet (L)": { kind: "path", d: "M28 44 q-3 -1 -4 3 q5 3 6 -1" },
  "Crow's feet (R)": { kind: "path", d: "M72 44 q3 -1 4 3 q-5 3 -6 -1" },
  "Bunny lines (nasalis)": { kind: "ellipse", cx: 50, cy: 50, rx: 2.5, ry: 1.8 },
  "Nasal tip (droopy tip)": { kind: "ellipse", cx: 50, cy: 60, rx: 2.2, ry: 1.6 },
  "Nostril flare (dilator naris)": { kind: "path", d: "M46 60 q-1.5 1.5 0 3 M54 60 q1.5 1.5 0 3" },
  "Brow lift": { kind: "path", d: "M32 41 Q40 38 48 41 M52 41 Q60 38 68 41" },
  "Lip flip": { kind: "ellipse", cx: 50, cy: 68, rx: 5, ry: 1.2 },
  "Gummy smile": { kind: "ellipse", cx: 50, cy: 66, rx: 4.5, ry: 1.2 },
  "DAO": { kind: "path", d: "M40 72 q-1.5 3 -0.5 5 M60 72 q1.5 3 0.5 5" },
  "Mentalis (chin)": { kind: "ellipse", cx: 50, cy: 78, rx: 3.5, ry: 2 },
  "Pebble chin": { kind: "ellipse", cx: 50, cy: 79, rx: 4.5, ry: 1.8 },
  "Masseter (L)": { kind: "ellipse", cx: 30, cy: 64, rx: 3.5, ry: 4.5 },
  "Masseter (R)": { kind: "ellipse", cx: 70, cy: 64, rx: 3.5, ry: 4.5 },
  "Nefertiti lift (jawline)": { kind: "path", d: "M26 70 Q50 86 74 70" },
};

export function InjectionTreatmentRecord({
  zones = [],
  value = [],
  onChange,
  notes,
  onNotesChange,
  unitLabel = "u",
  product,
  points,
  onPointsChange,
  withPointUnits = true,
  productOptions,
  previousPoints,
  previousLabel = "Last visit",
}: Props) {
  const [active, setActive] = useState<string | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showPrevious, setShowPrevious] = useState(true);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const unitsInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  // Auto-focus units input as soon as a pin becomes active — opens the
  // numeric keypad on mobile immediately after marking a site.
  useEffect(() => {
    if (editingIdx == null || !withPointUnits) return;
    const t = window.setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      unitsInputRef.current?.focus();
      unitsInputRef.current?.select();
    }, 80);
    return () => window.clearTimeout(t);
  }, [editingIdx, withPointUnits]);

  const guardrails = useToxGuardrails(product);
  const gMap = useMemo(() => {
    const m = new Map<string, typeof guardrails[number]>();
    guardrails.forEach(g => m.set(g.zone, g));
    return m;
  }, [guardrails]);

  const zoneMap = useMemo(() => {
    const m = new Map<string, number>();
    value.forEach(v => m.set(v.zone, v.units));
    return m;
  }, [value]);

  const setUnits = (zone: string, units: number) => {
    if (!onChange) return;
    const exists = value.some(v => v.zone === zone);
    if (units > 0) {
      onChange(exists ? value.map(v => v.zone === zone ? { ...v, units } : v) : [...value, { zone, units }]);
    } else {
      onChange(value.filter(v => v.zone !== zone));
    }
  };

  const totalZoneUnits = value.reduce((s, v) => s + (Number(v.units) || 0), 0);

  const pointsEnabled = !!onPointsChange;
  const currentPoints = points ?? [];
  const ghosts = previousPoints ?? [];

  const totalPointUnits = withPointUnits && points
    ? points.reduce((s, p) => s + (Number(p.units) || 0), 0)
    : 0;

  const activePin = editingIdx != null && points ? points[editingIdx] : null;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPointsChange || !points) return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const loc = pt.matrixTransform(ctm.inverse());
    const next: MapPoint = { x: Math.round(loc.x * 10) / 10, y: Math.round(loc.y * 10) / 10, view: "face" };
    onPointsChange([...points, next]);
    setEditingIdx(points.length);
  };

  const updatePoint = (i: number, patch: Partial<MapPoint>) => {
    if (!onPointsChange || !points) return;
    onPointsChange(points.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };
  const removePoint = (i: number) => {
    if (!onPointsChange || !points) return;
    onPointsChange(points.filter((_, idx) => idx !== i));
    setEditingIdx(null);
  };

  const showZoneList = zones.length > 0;
  const bgUrl = ANATOMY_URL;
  const highlight = active ? HIGHLIGHTS[active] : null;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {(pointsEnabled || ghosts.length > 0) && (
        <div className="flex items-center justify-end gap-2 flex-wrap px-3 pt-3">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {ghosts.length > 0 && (
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-3 w-3 accent-primary"
                  checked={showPrevious}
                  onChange={(e) => setShowPrevious(e.target.checked)}
                />
                <span>{previousLabel} ({ghosts.length})</span>
              </label>
            )}
            {pointsEnabled && (
              <span>
                {currentPoints.length} mark{currentPoints.length === 1 ? "" : "s"}
                {withPointUnits && totalPointUnits > 0 && <> · {totalPointUnits} {unitLabel}</>}
              </span>
            )}
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 ${showZoneList ? "md:grid-cols-[minmax(240px,340px)_1fr]" : ""}`}>
        {/* Anatomy diagram + tap-to-mark overlay */}
        <div className="bg-muted/20 border-b md:border-b-0 md:border-r border-border p-4 flex items-center justify-center">
          <div className="relative w-full max-w-[340px] aspect-[4/5]">
            <img
              src={bgUrl}
              alt="Anatomical reference — face, neck, shoulders"
              className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
              draggable={false}
              loading="lazy"
              width={1024}
              height={1280}
            />
            <svg
              ref={svgRef}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full"
              style={{ touchAction: "manipulation", cursor: pointsEnabled ? "crosshair" : "default" }}
              onClick={pointsEnabled ? handleSvgClick : undefined}
            >
              {highlight && (
                <g className="fill-primary/25 stroke-primary" strokeWidth={0.5} pointerEvents="none">
                  {highlight.kind === "ellipse" ? (
                    <ellipse cx={highlight.cx} cy={highlight.cy} rx={highlight.rx} ry={highlight.ry} />
                  ) : (
                    <path d={highlight.d} fill="none" strokeWidth={1.2} strokeLinecap="round" />
                  )}
                </g>
              )}
              {showPrevious && ghosts.map((p, i) => (
                <g key={`ghost-${i}`} pointerEvents="none" opacity={0.45}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={1.6}
                    fill="none"
                    strokeDasharray="0.6 0.6"
                    strokeWidth={0.4}
                    className="stroke-muted-foreground"
                  />
                </g>
              ))}
              {pointsEnabled && points && points.map((p, i) => {
                const isActive = editingIdx === i;
                const label = p.units != null && p.units > 0 ? String(p.units) : "+";
                // Sticky-note badge sits above and slightly right of the pin, with a leader line
                const badgeW = Math.max(4.2, 2.2 + label.length * 1.6);
                const badgeH = 4.2;
                const bx = p.x + 1.5;              // offset right of dot
                const by = p.y - 6.5;              // above dot
                return (
                  <g
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setEditingIdx(i); }}
                    style={{ cursor: "pointer" }}
                  >
                    {/* leader line from badge to dot */}
                    <line
                      x1={bx + badgeW / 2}
                      y1={by + badgeH}
                      x2={p.x}
                      y2={p.y}
                      stroke="#eab308"
                      strokeWidth={0.35}
                    />
                    {/* injection dot */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isActive ? 1.2 : 0.9}
                      fill="#eab308"
                      stroke="#7c5a00"
                      strokeWidth={0.25}
                    />
                    {/* yellow sticky-note badge */}
                    <rect
                      x={bx}
                      y={by}
                      width={badgeW}
                      height={badgeH}
                      rx={0.5}
                      fill="#facc15"
                      stroke={isActive ? "#7c5a00" : "#ca8a04"}
                      strokeWidth={isActive ? 0.35 : 0.2}
                    />
                    <text
                      x={bx + badgeW / 2}
                      y={by + badgeH - 1.1}
                      textAnchor="middle"
                      fontSize="2.6"
                      fontWeight={700}
                      fill="#1f1300"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Areas-treated list */}
        {showZoneList && (
          <div className="p-0">
            <div className="grid grid-cols-[1fr_84px] text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30 px-3 py-2">
              <span>Areas treated</span>
              <span className="text-right pr-1">Units</span>
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
              {zones.map(z => {
                const u = zoneMap.get(z);
                const filled = u != null && u > 0;
                const g = gMap.get(z);
                const cls = filled ? classifyUnits(u!, g) : "ok";
                const chipColor =
                  cls === "over" ? "text-destructive bg-destructive/10" :
                  cls === "under" ? "text-amber-600 bg-amber-500/10" :
                  "text-muted-foreground";
                return (
                  <div
                    key={z}
                    onMouseEnter={() => setActive(z)}
                    onMouseLeave={() => setActive(a => (a === z ? null : a))}
                    className={`grid grid-cols-[1fr_84px] items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                      filled ? "bg-primary/5" : ""
                    } ${active === z ? "bg-accent/40" : "hover:bg-muted/30"}`}
                  >
                    <div className="min-w-0">
                      <div className={`truncate ${filled ? "font-medium" : ""}`}>{z}</div>
                      {g && (
                        <div className={`text-[10px] tabular-nums ${chipColor}`}>
                          {g.min_units}–{g.max_units}{unitLabel} typical {g.typical_units}{unitLabel}
                          {cls === "over" && " · above max"}
                          {cls === "under" && " · below min"}
                        </div>
                      )}
                    </div>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      inputMode="decimal"
                      value={u ?? ""}
                      placeholder="—"
                      onFocus={() => setActive(z)}
                      onChange={e => setUnits(z, e.target.value === "" ? 0 : Number(e.target.value))}
                      className={`h-7 text-right text-sm tabular-nums ${
                        cls === "over" ? "border-destructive focus-visible:ring-destructive" :
                        cls === "under" ? "border-amber-500" : ""
                      }`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Total units</span>
              <span className="text-base font-semibold tabular-nums text-primary">
                {totalZoneUnits} <span className="text-xs font-normal text-muted-foreground">{unitLabel}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Pin editor */}
      {pointsEnabled && activePin && (
        <div
          ref={editorRef}
          className="sticky bottom-0 z-10 border-t-2 border-primary bg-primary/10 backdrop-blur p-3 space-y-2 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary">
              Site #{editingIdx! + 1} — enter units
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={() => removePoint(editingIdx!)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {withPointUnits && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  ref={unitsInputRef}
                  className="h-14 flex-1 text-2xl font-bold text-center tabular-nums"
                  type="number" inputMode="decimal" step={0.5} min={0}
                  placeholder={`# ${unitLabel}`}
                  value={activePin.units ?? ""}
                  onChange={(e) => updatePoint(editingIdx!, { units: e.target.value === "" ? undefined : Number(e.target.value) })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); setEditingIdx(null); } }}
                />
                <Button type="button" size="sm" onClick={() => setEditingIdx(null)}>Done</Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[2, 4, 5, 10, 15, 20, 25].map(n => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs tabular-nums"
                    onClick={() => updatePoint(editingIdx!, { units: n })}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <Input
            className="h-8 text-xs"
            placeholder="Label (optional, e.g. glabella)"
            value={activePin.label ?? ""}
            onChange={(e) => updatePoint(editingIdx!, { label: e.target.value })}
          />

          <div className="grid grid-cols-3 gap-1.5">
            {productOptions && productOptions.length > 0 ? (
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={activePin.product ?? ""}
                onChange={(e) => updatePoint(editingIdx!, { product: e.target.value || undefined })}
              >
                <option value="">Product…</option>
                {productOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <Input
                className="h-8 text-xs"
                placeholder="Product"
                value={activePin.product ?? ""}
                onChange={(e) => updatePoint(editingIdx!, { product: e.target.value || undefined })}
              />
            )}
            <Input
              className="h-8 text-xs"
              placeholder="Lot #"
              value={activePin.lot ?? ""}
              onChange={(e) => updatePoint(editingIdx!, { lot: e.target.value || undefined })}
            />
            <Input
              className="h-8 text-xs"
              type="date"
              value={activePin.expiration ?? ""}
              onChange={(e) => updatePoint(editingIdx!, { expiration: e.target.value || undefined })}
            />
          </div>
        </div>
      )}

      {pointsEnabled && (
        <p className="text-[10px] text-muted-foreground px-3 pb-2">
          Tap the diagram to add a site. Tap a dot to edit or remove.
          {ghosts.length > 0 && <> Dashed circles show last visit.</>}
        </p>
      )}

      {onNotesChange && (
        <div className="border-t border-border p-3 space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Notes</span>
          <Textarea
            rows={2}
            value={notes ?? ""}
            onChange={e => onNotesChange(e.target.value)}
            placeholder="Lot batch notes, dilution variance, patient observations…"
            className="text-sm"
          />
        </div>
      )}
    </div>
  );
}
