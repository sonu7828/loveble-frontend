import { useEffect, useState } from "react";
import { toast } from "sonner";
import { searchClients, type ClientHit } from "@/lib/clientSearch";

export type ClientSearchHit = ClientHit;

/**
 * Debounced client search hook backed by the shared `searchClients()` helper.
 * Preserves the existing return shape used by the walk-in checkout screen.
 */
export function useClientSearch(enabled: boolean) {
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientSearchHit[]>([]);
  const [clientSearching, setClientSearching] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const q = clientSearch.trim();
    if (q.length < 2) { setClientResults([]); return; }
    setClientSearching(true);
    const t = setTimeout(async () => {
      const hits = await searchClients(q, 20);
      setClientResults(hits);
      setClientSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [clientSearch, enabled]);

  const clearResults = () => { setClientResults([]); setClientSearch(""); };

  const buildPickClient = (
    setFirst: (v: string) => void,
    setLast: (v: string) => void,
    setEmail: (v: string) => void,
    setPhone: (v: string) => void,
  ) => (c: ClientSearchHit) => {
    setFirst(c.first_name || "");
    setLast(c.last_name || "");
    setEmail(c.email || "");
    setPhone(c.phone || "");
    clearResults();
    toast.success(`Selected ${c.first_name ?? ""} ${c.last_name ?? ""}`.trim());
  };

  return { clientSearch, setClientSearch, clientResults, clientSearching, buildPickClient };
}
