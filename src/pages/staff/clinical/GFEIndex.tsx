import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type GFE = {
  id: string;
  client_email: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  np_name: string | null;
  signed_at: string | null;
  expires_at: string | null;
};

export default function GFEIndex() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<GFE[]>([]);
  const [q, setQ] = useState("");
  const [providers, setProviders] = useState<string[]>([]);
  const [provider, setProvider] = useState("all");
  const [scope, setScope] = useState("active"); // active, expiring30, expired, all

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("gfe_records")
        .select("id, client_email, client_first_name, client_last_name, np_name, signed_at, expires_at")
        .order("expires_at", { ascending: true, nullsFirst: false })
        .limit(1000);
      const list = (data as any[]) ?? [];
      setRows(list);
      setProviders(Array.from(new Set(list.map((r) => r.np_name).filter(Boolean))));
      setLoading(false);
    })();
  }, []);

  const now = Date.now();
  const in30 = now + 30 * 86400_000;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (provider !== "all" && r.np_name !== provider) return false;
      const exp = r.expires_at ? new Date(r.expires_at).getTime() : null;
      if (scope === "active" && exp !== null && exp < now) return false;
      if (scope === "expiring30" && (exp === null || exp < now || exp > in30)) return false;
      if (scope === "expired" && (exp === null || exp >= now)) return false;
      if (needle) {
        const hay = [r.client_email, r.client_first_name, r.client_last_name, r.np_name].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, provider, scope, now, in30]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="font-serif text-3xl mb-2 flex items-center gap-2">
        <ShieldCheck className="h-7 w-7 opacity-70" /> Good Faith Exams
      </h1>
      <p className="text-sm text-muted-foreground mb-6">All GFEs with expiration tracking.</p>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-2 mb-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search client or provider…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger><SelectValue placeholder="Provider" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            {providers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active (not expired)</SelectItem>
            <SelectItem value="expiring30">Expiring in 30 days</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 m-3" />)
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No GFEs match these filters.</div>
        ) : (
          filtered.map((r) => {
            const name = `${r.client_first_name ?? ""} ${r.client_last_name ?? ""}`.trim() || r.client_email || "—";
            const exp = r.expires_at ? new Date(r.expires_at).getTime() : null;
            const expiring = exp !== null && exp >= now && exp <= in30;
            const expired = exp !== null && exp < now;
            return (
              <Link key={r.id} to={`/staff/clinical/gfe/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.np_name ?? "—"} · signed {r.signed_at ? new Date(r.signed_at).toLocaleDateString() : "—"}
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full ${
                  expired ? "bg-red-500/15 text-red-700" : expiring ? "bg-amber-500/15 text-amber-700" : "bg-emerald-500/15 text-emerald-700"
                }`}>
                  {r.expires_at ? `${expired ? "expired" : "exp"} ${new Date(r.expires_at).toLocaleDateString()}` : "no expiry"}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
