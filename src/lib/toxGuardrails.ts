import { useEffect, useState } from "react";
import { ApiClient } from "@/services/api";

export type ToxGuardrail = {
  product: string;
  zone: string;
  min_units: number;
  typical_units: number;
  max_units: number;
};

const cache = new Map<string, ToxGuardrail[]>();

function getFallbackGuardrails(product: string): ToxGuardrail[] {
  const isDysport = product.toLowerCase().includes("dysport");
  const mult = isDysport ? 2.5 : 1;
  return [
    { product, zone: "Glabella (Frown Lines)", min_units: Math.round(12 * mult), typical_units: Math.round(20 * mult), max_units: Math.round(30 * mult) },
    { product, zone: "Forehead (Frontalis)", min_units: Math.round(6 * mult), typical_units: Math.round(12 * mult), max_units: Math.round(20 * mult) },
    { product, zone: "Crow's Feet (Orbicularis Oculi)", min_units: Math.round(8 * mult), typical_units: Math.round(16 * mult), max_units: Math.round(24 * mult) },
    { product, zone: "Bunny Lines (Nasalis)", min_units: Math.round(2 * mult), typical_units: Math.round(4 * mult), max_units: Math.round(6 * mult) },
    { product, zone: "Masseters / TMJ", min_units: Math.round(20 * mult), typical_units: Math.round(40 * mult), max_units: Math.round(60 * mult) },
    { product, zone: "Lip Flip / Perioral", min_units: Math.round(2 * mult), typical_units: Math.round(4 * mult), max_units: Math.round(6 * mult) },
    { product, zone: "Gummy Smile", min_units: Math.round(2 * mult), typical_units: Math.round(4 * mult), max_units: Math.round(6 * mult) },
    { product, zone: "Platysmal Bands (Nefertiti)", min_units: Math.round(20 * mult), typical_units: Math.round(30 * mult), max_units: Math.round(50 * mult) },
  ];
}

export function useToxGuardrails(product: string | null | undefined): ToxGuardrail[] {
  const [rows, setRows] = useState<ToxGuardrail[]>([]);
  useEffect(() => {
    if (!product) { setRows([]); return; }
    if (cache.has(product)) { setRows(cache.get(product) || []); return; }
    (async () => {
      try {
        const res = await ApiClient.get<any>(`/clinical/tox-guardrails?product=${encodeURIComponent(product)}`);
        const raw = res?.data;
        const list: ToxGuardrail[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw?.guardrails)
          ? raw.guardrails
          : [];
        const finalRows = list.length > 0 ? list : getFallbackGuardrails(product);
        cache.set(product, finalRows);
        setRows(finalRows);
      } catch (_e) {
        const fallback = getFallbackGuardrails(product);
        cache.set(product, fallback);
        setRows(fallback);
      }
    })();
  }, [product]);
  return Array.isArray(rows) ? rows : [];
}

export function classifyUnits(units: number, g?: ToxGuardrail) {
  if (!g || !units) return "ok" as const;
  if (units > g.max_units) return "over" as const;
  if (units < g.min_units) return "under" as const;
  return "ok" as const;
}
