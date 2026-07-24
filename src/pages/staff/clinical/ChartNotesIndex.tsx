import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Note = {
  id: string;
  client_email: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  category: string | null;
  status: string | null;
  signed_at: string | null;
  created_at: string;
  provider_name: string | null;
};

const CATEGORIES = ["all", "neurotoxin", "filler", "energy", "wellness", "facial", "other"];

export default function ChartNotesIndex() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Note[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [range, setRange] = useState("30");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date();
      const days = parseInt(range, 10);
      since.setDate(since.getDate() - (isNaN(days) ? 30 : days));
      let q = supabase
        .from("clinical_notes")
        .select("id, client_email, client_first_name, client_last_name, category, status, signed_at, created_at, provider_name")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!isNaN(days)) q = q.gte("created_at", since.toISOString());
      if (category !== "all") q = q.eq("category", category as any);
      const { data } = await q;
      setRows((data as any) ?? []);
      setLoading(false);
    })();
  }, [category, range]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.client_email, r.client_first_name, r.client_last_name, r.provider_name, r.category]
        .filter(Boolean).join(" ").toLowerCase().includes(needle),
    );
  }, [rows, q]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="font-serif text-3xl mb-2 flex items-center gap-2">
        <FileText className="h-7 w-7 opacity-70" /> Chart Notes
      </h1>
      <p className="text-sm text-muted-foreground mb-6">All chart notes across all clients.</p>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-2 mb-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search client or provider…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c === "all" ? "All categories" : c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger><SelectValue placeholder="Date range" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
            <SelectItem value="NaN">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 m-3" />)
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No chart notes match these filters.</div>
        ) : (
          filtered.map((n) => {
            const name = `${n.client_first_name ?? ""} ${n.client_last_name ?? ""}`.trim() || n.client_email || "—";
            const when = new Date(n.signed_at ?? n.created_at).toLocaleString();
            return (
              <Link key={n.id} to={`/staff/clinical/notes/${n.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {n.category ?? "—"} · {n.provider_name ?? "—"} · {when}
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full ${n.status === "signed" ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"}`}>
                  {n.status ?? "draft"}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
