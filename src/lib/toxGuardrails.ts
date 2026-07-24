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

export function useToxGuardrails(product: string | null | undefined) {
  const [rows, setRows] = useState<ToxGuardrail[]>([]);
  useEffect(() => {
    if (!product) { setRows([]); return; }
    if (cache.has(product)) { setRows(cache.get(product)!); return; }
    (async () => {
      const res = await ApiClient.get<ToxGuardrail[]>(`/clinical/tox-guardrails?product=${encodeURIComponent(product)}`);
      if (res.data) {
        cache.set(product, res.data);
        setRows(res.data);
      }
    })();
  }, [product]);
  return rows;
}

export function classifyUnits(units: number, g?: ToxGuardrail) {
  if (!g || !units) return "ok" as const;
  if (units > g.max_units) return "over" as const;
  if (units < g.min_units) return "under" as const;
  return "ok" as const;
}
