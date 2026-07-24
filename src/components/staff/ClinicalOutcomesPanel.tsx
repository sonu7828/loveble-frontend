// Cohort outcomes dashboard for clinical staff. Calls get_outcomes_summary.
// Shows: AE rate by injector, AE rate by product, recovery curves (avg swelling/
// bruising/pain by day_offset per product), and photo-share rate.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, TrendingUp, AlertTriangle, Image as ImgIcon, Users } from "lucide-react";
import { subDays } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
  BarChart, Bar,
} from "recharts";

type Summary = {
  range: { from: string; to: string };
  totals: { notes: number };
  ae_by_injector: Array<{ provider_user_id: string; provider_name: string; visits: number; ae_count: number; ae_rate_pct: number }>;
  ae_by_product: Array<{ product: string; visits: number; ae_count: number; ae_rate_pct: number }>;
  recovery_by_product: Array<{ product: string; day_offset: number; avg_swelling: number; avg_bruising: number; avg_pain: number; n: number }>;
  photo_share: { with_photos: number; total: number };
};

const DAY_BUCKETS = [1, 3, 7, 14];

export function ClinicalOutcomesPanel() {
  const { isClinicalStaff, loading: authLoading } = useAuth();
  const [days, setDays] = useState(180);
  const [data, setData] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (authLoading || !isClinicalStaff) { setBusy(false); return; }
    let cancel = false;
    (async () => {
      setBusy(true);
      const from = subDays(new Date(), days).toISOString();
      const { data: res, error } = await supabase.rpc("get_outcomes_summary", {
        _from: from,
        _to: new Date().toISOString(),
        _location_id: null,
        _staff_user_id: null,
      });
      if (cancel) return;
      if (error) {
        console.error(error);
        setData(null);
      } else {
        setData(res as unknown as Summary);
      }
      setBusy(false);
    })();
    return () => { cancel = true; };
  }, [authLoading, isClinicalStaff, days]);

  const recoveryProducts = useMemo(() => {
    if (!data) return [] as string[];
    return Array.from(new Set(data.recovery_by_product.map((r) => r.product)));
  }, [data]);

  const [productFilter, setProductFilter] = useState<string>("all");

  const recoverySeries = useMemo(() => {
    if (!data) return [];
    const rows = data.recovery_by_product.filter(
      (r) => productFilter === "all" || r.product === productFilter,
    );
    // Pivot: one row per day_offset, weighted avg across selected products
    const byDay = new Map<number, { swell: number; bruise: number; pain: number; n: number }>();
    for (const r of rows) {
      const cur = byDay.get(r.day_offset) ?? { swell: 0, bruise: 0, pain: 0, n: 0 };
      cur.swell += (r.avg_swelling ?? 0) * r.n;
      cur.bruise += (r.avg_bruising ?? 0) * r.n;
      cur.pain += (r.avg_pain ?? 0) * r.n;
      cur.n += r.n;
      byDay.set(r.day_offset, cur);
    }
    return DAY_BUCKETS.map((d) => {
      const c = byDay.get(d);
      return {
        day: `Day ${d}`,
        swelling: c && c.n ? Math.round((c.swell / c.n) * 100) / 100 : null,
        bruising: c && c.n ? Math.round((c.bruise / c.n) * 100) / 100 : null,
        pain: c && c.n ? Math.round((c.pain / c.n) * 100) / 100 : null,
        n: c?.n ?? 0,
      };
    });
  }, [data, productFilter]);

  if (authLoading) return <div className="p-10 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (!isClinicalStaff) return null;

  const photoSharePct = data?.photo_share?.total
    ? Math.round((data.photo_share.with_photos / data.photo_share.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-serif flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Clinical outcomes
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Aggregated from signed chart notes, post-op check-ins, and adverse-event reports.
          </p>
        </div>
        <div className="flex gap-1">
          {[30, 90, 180, 365].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-3 py-1.5 rounded-md border transition ${
                d === days ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
              }`}
            >{d}d</button>
          ))}
        </div>
      </header>

      {busy ? (
        <div className="p-10 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
      ) : !data || data.totals.notes === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No signed clinical notes in the selected window.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Signed notes" value={String(data.totals.notes)} icon={<Users className="h-3.5 w-3.5" />} />
            <Stat
              label="Overall AE rate"
              value={`${overallRate(data.ae_by_product)}%`}
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              tone={overallRate(data.ae_by_product) > 5 ? "warn" : "ok"}
            />
            <Stat
              label="Photo-share rate"
              value={`${photoSharePct}%`}
              icon={<ImgIcon className="h-3.5 w-3.5" />}
              hint={`${data.photo_share.with_photos}/${data.photo_share.total}`}
            />
            <Stat
              label="Products tracked"
              value={String(new Set(data.ae_by_product.map((p) => p.product)).size)}
            />
          </div>

          <Card title="Recovery curve" right={
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="rounded-md border border-border bg-background text-xs px-2 py-1"
            >
              <option value="all">All products</option>
              {recoveryProducts.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          }>
            {recoverySeries.every((r) => r.n === 0) ? (
              <Empty text="No post-op check-ins yet for this filter." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={recoverySeries}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" className="text-[10px]" />
                  <YAxis domain={[0, 5]} className="text-[10px]" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="swelling" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="bruising" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="pain" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
            <p className="text-[10px] text-muted-foreground mt-2">
              Patient-reported 1–5 scale at day 1/3/7/14 post-op. Weighted by responses across selected products.
            </p>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card title="AE rate by injector">
              {data.ae_by_injector.length === 0 ? <Empty text="No data." /> : (
                <ResponsiveContainer width="100%" height={Math.max(120, data.ae_by_injector.length * 36)}>
                  <BarChart layout="vertical" data={data.ae_by_injector}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-[10px]" unit="%" />
                    <YAxis dataKey="provider_name" type="category" width={110} className="text-[10px]" />
                    <Tooltip formatter={(v: any, name) => name === "ae_rate_pct" ? `${v}%` : v} />
                    <Bar dataKey="ae_rate_pct" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <table className="w-full text-xs mt-2">
                <thead className="text-muted-foreground">
                  <tr><th className="text-left font-normal py-1">Injector</th><th className="text-right font-normal">Visits</th><th className="text-right font-normal">AE</th><th className="text-right font-normal">Rate</th></tr>
                </thead>
                <tbody>
                  {data.ae_by_injector.map((r) => (
                    <tr key={r.provider_user_id} className="border-t border-border">
                      <td className="py-1 truncate">{r.provider_name}</td>
                      <td className="text-right tabular-nums">{r.visits}</td>
                      <td className="text-right tabular-nums">{r.ae_count}</td>
                      <td className={`text-right tabular-nums ${r.ae_rate_pct > 5 ? "text-warning" : ""}`}>{r.ae_rate_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card title="AE rate by product">
              {data.ae_by_product.length === 0 ? <Empty text="No data." /> : (
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr><th className="text-left font-normal py-1">Product</th><th className="text-right font-normal">Visits</th><th className="text-right font-normal">AE</th><th className="text-right font-normal">Rate</th></tr>
                  </thead>
                  <tbody>
                    {data.ae_by_product.map((r) => (
                      <tr key={r.product} className="border-t border-border">
                        <td className="py-1 truncate">{r.product}</td>
                        <td className="text-right tabular-nums">{r.visits}</td>
                        <td className="text-right tabular-nums">{r.ae_count}</td>
                        <td className={`text-right tabular-nums ${r.ae_rate_pct > 5 ? "text-warning" : ""}`}>{r.ae_rate_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          <p className="text-[10px] text-muted-foreground">
            AE rate counts moderate or severe events linked to the appointment. Mild events (e.g. expected bruising) are excluded.
          </p>
        </>
      )}
    </div>
  );
}

function overallRate(rows: Summary["ae_by_product"]) {
  const v = rows.reduce((s, r) => s + r.visits, 0);
  const a = rows.reduce((s, r) => s + r.ae_count, 0);
  return v === 0 ? 0 : Math.round((a / v) * 100 * 10) / 10;
}

function Stat({ label, value, icon, hint, tone }: { label: string; value: string; icon?: React.ReactNode; hint?: string; tone?: "ok" | "warn" }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === "warn" ? "border-warning/30 bg-warning-soft" : "border-border bg-card"}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-2xl font-serif mt-1">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground px-1">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground text-center py-6">{text}</div>;
}
