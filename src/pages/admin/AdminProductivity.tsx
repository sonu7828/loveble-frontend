import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, subDays } from "date-fns";
import { Loader2, TrendingUp, Users, Syringe, DollarSign, AlertCircle, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";

type Range = "today" | "week" | "30d" | "custom";

type Row = {
  provider_user_id: string;
  provider_name: string;
  charts: number;
  units: number;
  noShows: number;
  incomplete: number;
  revenueCents: number;
  avgChartMins: number | null;
};

export default function AdminProductivity() {
  const [range, setRange] = useState<Range>("week");
  const [from, setFrom] = useState<string>(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [to, setTo] = useState<string>(format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick range presets
  useEffect(() => {
    const now = new Date();
    if (range === "today") {
      setFrom(format(startOfDay(now), "yyyy-MM-dd"));
      setTo(format(endOfDay(now), "yyyy-MM-dd"));
    } else if (range === "week") {
      setFrom(format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      setTo(format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    } else if (range === "30d") {
      setFrom(format(subDays(now, 30), "yyyy-MM-dd"));
      setTo(format(now, "yyyy-MM-dd"));
    }
  }, [range]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const startIso = new Date(`${from}T00:00:00`).toISOString();
      const endIso = new Date(`${to}T23:59:59.999`).toISOString();

      // 1. Notes (signed) in range with optional neurotoxin units + appointment start
      const { data: notes } = await supabase
        .from("clinical_notes")
        .select("id, provider_user_id, provider_name, status, signed_at, appointment_id, category")
        .gte("signed_at", startIso)
        .lte("signed_at", endIso)
        .not("signed_at", "is", null);

      const noteIds = (notes ?? []).map(n => n.id);
      const apptIds = Array.from(new Set((notes ?? []).map(n => n.appointment_id).filter(Boolean) as string[]));

      const [{ data: neuro }, { data: appts }, { data: sales }, { data: noShows }] = await Promise.all([
        noteIds.length
          ? supabase.from("clinical_note_neurotoxin").select("clinical_note_id, total_units").in("clinical_note_id", noteIds)
          : Promise.resolve({ data: [] as any[] }),
        apptIds.length
          ? supabase.from("appointments").select("id, start_at, staff_id").in("id", apptIds)
          : Promise.resolve({ data: [] as any[] }),
        // Revenue: paid sales in range, joined by staff_id (provider) — need to map staff_id → provider_user_id
        supabase.from("sales")
          .select("staff_id, total_cents, paid_at, status")
          .eq("status", "paid")
          .gte("paid_at", startIso)
          .lte("paid_at", endIso),
        supabase.from("appointments")
          .select("staff_id, status, start_at")
          .eq("status", "no_show")
          .gte("start_at", startIso)
          .lte("start_at", endIso),
      ]);

      // Map staff_id → user_id via staff_profiles
      const { data: staff } = await supabase
        .from("staff_profiles")
        .select("id, user_id, full_name");
      const staffByUser = new Map((staff ?? []).map(s => [s.user_id, s]));
      const staffById = new Map((staff ?? []).map(s => [s.id, s]));

      const unitsByNote = new Map((neuro ?? []).map((r: any) => [r.clinical_note_id, Number(r.total_units) || 0]));
      const apptById = new Map((appts ?? []).map((a: any) => [a.id, a]));

      const byProvider = new Map<string, Row>();
      const row = (uid: string, name: string) => {
        let r = byProvider.get(uid);
        if (!r) {
          r = { provider_user_id: uid, provider_name: name, charts: 0, units: 0, noShows: 0, incomplete: 0, revenueCents: 0, avgChartMins: null };
          byProvider.set(uid, r);
        }
        return r;
      };

      const chartMinAcc = new Map<string, { total: number; count: number }>();

      for (const n of notes ?? []) {
        if (!n.provider_user_id) continue;
        const r = row(n.provider_user_id, n.provider_name || "Unknown");
        r.charts++;
        r.units += unitsByNote.get(n.id) ?? 0;
        if (n.status === "signed") r.incomplete++; // awaiting cosign
        const appt = n.appointment_id ? apptById.get(n.appointment_id) : null;
        if (appt && n.signed_at) {
          const mins = Math.max(0, (new Date(n.signed_at).getTime() - new Date(appt.start_at).getTime()) / 60000);
          const acc = chartMinAcc.get(n.provider_user_id) ?? { total: 0, count: 0 };
          acc.total += mins; acc.count++;
          chartMinAcc.set(n.provider_user_id, acc);
        }
      }
      for (const [uid, acc] of chartMinAcc) {
        const r = byProvider.get(uid); if (r) r.avgChartMins = acc.count ? Math.round(acc.total / acc.count) : null;
      }

      for (const s of sales ?? []) {
        if (!s.staff_id) continue;
        const sp = staffById.get(s.staff_id); if (!sp?.user_id) continue;
        const r = row(sp.user_id, sp.full_name || "Unknown");
        r.revenueCents += Number(s.total_cents) || 0;
      }

      for (const a of noShows ?? []) {
        const sp = staffById.get(a.staff_id); if (!sp?.user_id) continue;
        const r = row(sp.user_id, sp.full_name || "Unknown");
        r.noShows++;
      }

      // Add staff who had revenue/no-shows but no charts (already added above by row()).
      // Sort by charts desc, then revenue
      const list = Array.from(byProvider.values()).sort((a, b) =>
        b.charts - a.charts || b.revenueCents - a.revenueCents
      );
      setRows(list);
      setLoading(false);
    })();
  }, [from, to]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    charts: acc.charts + r.charts,
    units: acc.units + r.units,
    revenue: acc.revenue + r.revenueCents,
    noShows: acc.noShows + r.noShows,
    incomplete: acc.incomplete + r.incomplete,
  }), { charts: 0, units: 0, revenue: 0, noShows: 0, incomplete: 0 }), [rows]);

  const fmtMoney = (c: number) => `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-3xl mb-1">Productivity</h1>
        <p className="text-sm text-muted-foreground">Per-provider charts, units, revenue, and chart timeliness.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(["today", "week", "30d", "custom"] as Range[]).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-wider border ${range === r ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>
            {r === "today" ? "Today" : r === "week" ? "This week" : r === "30d" ? "Last 30 days" : "Custom"}
          </button>
        ))}
        {range === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 w-auto" />
            <span className="text-xs text-muted-foreground">→</span>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 w-auto" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <Stat label="Charts signed" value={String(totals.charts)} icon={<ClipboardList className="h-4 w-4" />} />
        <Stat label="Units injected" value={String(totals.units)} icon={<Syringe className="h-4 w-4" />} />
        <Stat label="Revenue" value={fmtMoney(totals.revenue)} icon={<DollarSign className="h-4 w-4" />} />
        <Stat label="No-shows" value={String(totals.noShows)} tone={totals.noShows ? "amber" : undefined} icon={<AlertCircle className="h-4 w-4" />} />
        <Stat label="Awaiting cosign" value={String(totals.incomplete)} tone={totals.incomplete ? "amber" : undefined} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">No activity in this range.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Provider</th>
                <th className="text-right px-4 py-2.5">Charts</th>
                <th className="text-right px-4 py-2.5">Units</th>
                <th className="text-right px-4 py-2.5">Revenue</th>
                <th className="text-right px-4 py-2.5">Avg chart time</th>
                <th className="text-right px-4 py-2.5">No-shows</th>
                <th className="text-right px-4 py-2.5">Awaiting cosign</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(r => (
                <tr key={r.provider_user_id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium flex items-center gap-2"><Users className="h-3.5 w-3.5 text-muted-foreground" />{r.provider_name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.charts}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.units || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(r.revenueCents)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {r.avgChartMins != null ? `${r.avgChartMins} min` : "—"}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${r.noShows > 0 ? "text-warning-soft-foreground" : ""}`}>{r.noShows}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${r.incomplete > 0 ? "text-warning-soft-foreground" : ""}`}>{r.incomplete}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone?: "amber" }) {
  const toneCls = tone === "amber"
    ? "text-warning-soft-foreground bg-warning-soft border-warning/30"
    : "text-foreground bg-card border-border";
  return (
    <div className={`rounded-2xl border p-4 ${toneCls}`}>
      <div className="text-[11px] uppercase tracking-wider opacity-70 flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-2xl font-serif mt-1">{value}</div>
    </div>
  );
}

