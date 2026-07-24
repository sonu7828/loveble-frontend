// Outcome tracking report: post-visit ratings rolled up by provider and by service.
// Admin-only. Joins client_feedback with appointments → staff and services.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { Loader2, Star, TrendingUp, Image as ImgIcon } from "lucide-react";
import { format, subDays } from "date-fns";

type Row = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  client_email: string;
  service_name: string | null;
  staff_name: string | null;
};

// `embedded` removes the admin gate + Navigate redirect when this component
// is rendered inside the Reports tab (where the parent already enforces admin).
export default function StaffOutcomes({ embedded = false }: { embedded?: boolean }) {
  const { isAdmin, loading } = useAuth();
  const [days, setDays] = useState(90);
  const [busy, setBusy] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) { setBusy(false); return; }
    let cancel = false;
    (async () => {
      setBusy(true);
      const since = subDays(new Date(), days).toISOString();
      const { data } = await supabase
        .from("client_feedback")
        .select(`id, rating, comment, created_at, client_email,
                 services(name),
                 staff_profiles(full_name)`)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (cancel) return;
      const mapped: Row[] = (data ?? []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        client_email: r.client_email,
        service_name: r.services?.name ?? null,
        staff_name: r.staff_profiles?.full_name ?? null,
      }));
      setRows(mapped);
      setBusy(false);
    })();
    return () => { cancel = true; };
  }, [loading, isAdmin, days]);

  const byProvider = useMemo(() => bucket(rows, r => r.staff_name ?? "—"), [rows]);
  const byService = useMemo(() => bucket(rows, r => r.service_name ?? "—"), [rows]);
  const overall = useMemo(() => avg(rows.map(r => r.rating)), [rows]);
  const low = useMemo(() => rows.filter(r => r.rating <= 3), [rows]);

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (!isAdmin && !embedded) return <Navigate to="/staff/today" replace />;

  return (
    <div className={embedded ? "" : "p-4 md:p-6 max-w-6xl mx-auto"}>
      <header className="mb-5 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Outcome tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Post-visit ratings rolled up by provider and service. Last {days} days.
          </p>
        </div>
        <div className="flex gap-1">
          {[30, 90, 180, 365].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-3 py-1.5 rounded-md border transition ${d === days ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}
            >{d}d</button>
          ))}
        </div>
      </header>

      {busy ? (
        <div className="p-10 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No feedback in the selected window.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Responses" value={String(rows.length)} />
            <Stat label="Avg rating" value={overall.toFixed(2)} icon={<Star className="h-4 w-4 text-warning" />} />
            <Stat label="5-star %" value={`${Math.round(100 * rows.filter(r => r.rating === 5).length / rows.length)}%`} />
            <Stat label="≤3-star" value={String(low.length)} tone={low.length > 0 ? "warn" : "ok"} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card title="By provider">
              {byProvider.map(b => (
                <RowBar key={b.key} label={b.key} count={b.count} avg={b.avg} />
              ))}
            </Card>
            <Card title="By service">
              {byService.map(b => (
                <RowBar key={b.key} label={b.key} count={b.count} avg={b.avg} />
              ))}
            </Card>
          </div>

          {low.length > 0 && (
            <Card title={`Low-rated visits (${low.length})`}>
              <div className="divide-y divide-border -m-3">
                {low.slice(0, 25).map(r => (
                  <Link
                    to={`/staff/clinical/clients/${encodeURIComponent(r.client_email)}`}
                    key={r.id}
                    className="block p-3 hover:bg-secondary/40 transition"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{r.rating}★ · {r.staff_name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy")}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{r.service_name ?? "—"} · {r.client_email}</div>
                    {r.comment && <div className="text-xs mt-1 line-clamp-2">{r.comment}</div>}
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ImgIcon className="h-3 w-3" /> Per-visit photos remain attached to each chart note — open the client chart to compare.
          </p>
        </div>
      )}
    </div>
  );
}

function bucket(rows: Row[], keyFn: (r: Row) => string) {
  const m = new Map<string, number[]>();
  for (const r of rows) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r.rating);
  }
  return Array.from(m.entries())
    .map(([key, arr]) => ({ key, count: arr.length, avg: avg(arr) }))
    .sort((a, b) => b.count - a.count);
}
function avg(arr: number[]) { return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length; }

function Stat({ label, value, icon, tone }: { label: string; value: string; icon?: React.ReactNode; tone?: "ok" | "warn" }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === "warn" ? "border-warning/30 bg-warning-soft dark:bg-warning-soft" : "border-border bg-card"}`}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-2xl font-serif mt-1">{value}</div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 px-1">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function RowBar({ label, count, avg }: { label: string; count: number; avg: number }) {
  const pct = Math.min(100, (avg / 5) * 100);
  return (
    <div className="px-1 py-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate font-medium">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{avg.toFixed(2)}★ · {count}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
