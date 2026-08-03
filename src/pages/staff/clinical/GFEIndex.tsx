import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, ShieldCheck, Plus, FileText, Trash2 } from "lucide-react";
import { apiQuery } from "@/services/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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
  const [sp] = useSearchParams();
  const initialSearch = sp.get("search") || sp.get("email") || "";
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<GFE[]>([]);
  const [q, setQ] = useState(initialSearch);
  const [providers, setProviders] = useState<string[]>([]);
  const [provider, setProvider] = useState("all");
  const [scope, setScope] = useState("all");

  const loadData = async () => {
    setLoading(true);
    let dbList: any[] = [];
    try {
      const { data } = await apiQuery
        .from("gfe_records")
        .select("id, client_email, client_first_name, client_last_name, np_name, signed_at, expires_at, created_at")
        .limit(1000);
      dbList = (data as any[]) ?? [];
    } catch { }

    let localList: any[] = [];
    try {
      localList = JSON.parse(localStorage.getItem("rka_demo_gfe_records") || "[]");
    } catch { }

    // Merge DB & LocalStorage records by id, prioritizing newest local updates
    const map = new Map<string, any>();
    dbList.forEach(r => { if (r.id) map.set(r.id, r); });
    localList.forEach(r => { if (r.id) map.set(r.id, r); });

    const merged = Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.signed_at || a.created_at || a.expires_at || 0).getTime();
      const timeB = new Date(b.signed_at || b.created_at || b.expires_at || 0).getTime();
      return timeB - timeA; // NEWEST GFE FIRST
    });

    setRows(merged);
    setProviders(Array.from(new Set(merged.map((r) => r.np_name).filter(Boolean))));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener("rka_gfe_updated", handleUpdate);
    return () => window.removeEventListener("rka_gfe_updated", handleUpdate);
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this GFE record?")) return;
    
    // Clear from local demo storage if present
    try {
      const localItems: any[] = JSON.parse(localStorage.getItem("rka_demo_gfe_records") || "[]");
      const nextLocal = localItems.filter((item) => item.id !== id);
      localStorage.setItem("rka_demo_gfe_records", JSON.stringify(nextLocal));
    } catch {
      /* ignore */
    }

    try {
      await apiQuery.from("gfe_records").delete().eq("id", id);
    } catch { }

    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("GFE record deleted");
  };

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl mb-1 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 opacity-70 text-primary" /> Good Faith Exams
          </h1>
          <p className="text-sm text-muted-foreground">All GFEs with 12-month expiration tracking.</p>
        </div>
        <Link to="/staff/clinical/gfe/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Conduct New GFE
          </Button>
        </Link>
      </div>

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
            <SelectItem value="all">All GFEs</SelectItem>
            <SelectItem value="active">Active (not expired)</SelectItem>
            <SelectItem value="expiring30">Expiring in 30 days</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 m-3" />)
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No GFEs found.</p>
            <div className="pt-2 flex justify-center gap-2">
              {q && <Button variant="outline" size="sm" onClick={() => setQ("")}>Clear search</Button>}
              <Link to="/staff/clinical/gfe/new">
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Conduct GFE now
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          filtered.map((r) => {
            const name = `${r.client_first_name ?? ""} ${r.client_last_name ?? ""}`.trim() || r.client_email || "—";
            const exp = r.expires_at ? new Date(r.expires_at).getTime() : null;
            const expiring = exp !== null && exp >= now && exp <= in30;
            const expired = exp !== null && exp < now;
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-accent/50 transition">
                <Link to={`/staff/clinical/gfe/${r.id}`} className="flex-1 min-w-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate text-foreground">{name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.np_name ?? "—"} · signed {r.signed_at ? new Date(r.signed_at).toLocaleDateString() : "—"}
                    </div>
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0 ${
                    expired ? "bg-red-500/15 text-red-700 dark:text-red-300" : expiring ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  }`}>
                    {r.expires_at ? `${expired ? "expired" : "exp"} ${new Date(r.expires_at).toLocaleDateString()}` : "no expiry"}
                  </span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={(e) => handleDelete(r.id, e)}
                  title="Delete GFE"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
