import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserCheck } from "lucide-react";
import { format } from "date-fns";

// Audit of WHO booked clients each month.
// Source: appointment_audit_log.action='manual_book' (logged by staff-create-booking)
// joined to staff_profiles via actor_user_id -> user_id.

interface Row {
  staff_id: string | null;
  name: string;
  count: number;
  unique_clients: number;
  revenue_cents: number;
  showed: number;
  cancelled: number;
  no_show: number;
  upcoming: number;
}

function monthOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: format(d, "MMMM yyyy"),
    });
  }
  return out;
}

export default function StaffBookingsByMonthCard() {
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState(months[0].value);
  const [rows, setRows] = useState<Row[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [yStr, mStr] = month.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1;
      const start = new Date(y, m, 1).toISOString();
      const end = new Date(y, m + 1, 1).toISOString();

      // Staff-initiated bookings → audit log entries
      const { data: logs } = await supabase
        .from("appointment_audit_log")
        .select("actor_user_id, appointment_id")
        .eq("action", "manual_book")
        .gte("created_at", start)
        .lt("created_at", end);

      const logList = (logs ?? []) as any[];

      // Online (client self-book): appointments created in window with NO manual_book audit row
      const { data: appts } = await supabase
        .from("appointments")
        .select("id")
        .gte("created_at", start)
        .lt("created_at", end);
      const apptIds = new Set((appts ?? []).map((a: any) => a.id));
      const bookedApptIds = new Set(logList.map((l) => l.appointment_id));
      let online = 0;
      for (const id of apptIds) if (!bookedApptIds.has(id)) online++;
      setOnlineCount(online);

      // Pull client_email + status per appointment for unique-client counting & outcome buckets
      const allApptIds = [...new Set(logList.map((l) => l.appointment_id).filter(Boolean))];
      const emailByAppt: Record<string, string> = {};
      const statusByAppt: Record<string, string> = {};
      if (allApptIds.length) {
        const { data: aRows } = await supabase
          .from("appointments")
          .select("id, client_email, status")
          .in("id", allApptIds);
        for (const r of (aRows ?? []) as any[]) {
          emailByAppt[r.id] = (r.client_email ?? "").toLowerCase();
          statusByAppt[r.id] = r.status ?? "";
        }
      }

      // Map actor → staff name
      const actorIds = [...new Set(logList.map((l) => l.actor_user_id).filter(Boolean))];
      const nameByUser: Record<string, { id: string; name: string }> = {};
      if (actorIds.length) {
        const { data: sp } = await supabase
          .from("staff_profiles")
          .select("id, user_id, full_name")
          .in("user_id", actorIds);
        for (const s of (sp ?? []) as any[]) {
          nameByUser[s.user_id] = { id: s.id, name: s.full_name ?? "Unknown" };
        }
      }

      // Revenue: sum sales tied to these booked appointments (paid/refunded)
      const revenueByAppt: Record<string, number> = {};
      if (allApptIds.length) {
        const { data: salesRows } = await supabase
          .from("sales")
          .select("appointment_id, total_cents, refunded_amount_cents, status")
          .in("appointment_id", allApptIds)
          .in("status", ["paid", "partially_refunded", "refunded"]);
        for (const s of (salesRows ?? []) as any[]) {
          const net = (s.total_cents ?? 0) - (s.refunded_amount_cents ?? 0);
          revenueByAppt[s.appointment_id] = (revenueByAppt[s.appointment_id] ?? 0) + Math.max(0, net);
        }
      }

      // Aggregate
      type Bucket = { name: string; count: number; emails: Set<string>; staff_id: string | null; revenue_cents: number; showed: number; cancelled: number; no_show: number; upcoming: number };
      const agg = new Map<string, Bucket>();
      for (const l of logList) {
        const key = l.actor_user_id ?? "unknown";
        const meta = nameByUser[l.actor_user_id ?? ""] ?? { id: null as any, name: "Unknown / removed user" };
        const cur: Bucket = agg.get(key) ?? { name: meta.name, count: 0, emails: new Set<string>(), staff_id: meta.id ?? null, revenue_cents: 0, showed: 0, cancelled: 0, no_show: 0, upcoming: 0 };
        cur.count++;
        const em = emailByAppt[l.appointment_id];
        if (em) cur.emails.add(em);
        cur.revenue_cents += revenueByAppt[l.appointment_id] ?? 0;
        const st = statusByAppt[l.appointment_id];
        if (st === "completed" || st === "arrived") cur.showed++;
        else if (st === "no_show") cur.no_show++;
        else if (st === "cancelled" || st === "denied") cur.cancelled++;
        else if (st === "pending" || st === "approved") cur.upcoming++;
        agg.set(key, cur);
      }
      const result: Row[] = [...agg.values()]
        .map((v) => ({ staff_id: v.staff_id, name: v.name, count: v.count, unique_clients: v.emails.size, revenue_cents: v.revenue_cents, showed: v.showed, cancelled: v.cancelled, no_show: v.no_show, upcoming: v.upcoming }))
        .sort((a, b) => b.revenue_cents - a.revenue_cents || b.count - a.count);
      setRows(result);
      setLoading(false);
    })();
  }, [month]);

  const total = rows.reduce((a, r) => a + r.count, 0);
  const totalRevenue = rows.reduce((a, r) => a + r.revenue_cents, 0);
  const totalShowed = rows.reduce((a, r) => a + r.showed, 0);
  const totalCancelled = rows.reduce((a, r) => a + r.cancelled, 0);
  const totalNoShow = rows.reduce((a, r) => a + r.no_show, 0);
  const totalUpcoming = rows.reduce((a, r) => a + r.upcoming, 0);
  const fmt = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
        <div>
          <h2 className="font-serif text-xl flex items-center gap-2">
            <UserCheck className="h-5 w-5" /> Bookings by staff member
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Who created bookings for clients (staff-initiated only), with the outcome of each appointment. Online self-bookings shown separately.
          </p>
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="text-sm rounded-full border border-border bg-background px-3 py-1.5"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                    <th className="py-2 pr-4">Staff member</th>
                    <th className="py-2 pr-3 text-right">Booked</th>
                    <th className="py-2 pr-3 text-right text-success-soft-foreground">Showed</th>
                    <th className="py-2 pr-3 text-right text-warning-soft-foreground">Cancelled</th>
                    <th className="py-2 pr-3 text-right text-destructive">No-show</th>
                    <th className="py-2 pr-3 text-right">Upcoming</th>
                    <th className="py-2 pr-3 text-right">Unique clients</th>
                    <th className="py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={8} className="py-6 text-center text-muted-foreground text-xs">No staff-created bookings this month.</td></tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.name} className="border-b border-border last:border-0">
                        <td className="py-2.5 pr-4">{r.name}</td>
                        <td className="py-2.5 pr-3 text-right font-mono text-xs">{r.count}</td>
                        <td className="py-2.5 pr-3 text-right font-mono text-xs text-success-soft-foreground">{r.showed || "—"}</td>
                        <td className="py-2.5 pr-3 text-right font-mono text-xs text-warning-soft-foreground">{r.cancelled || "—"}</td>
                        <td className="py-2.5 pr-3 text-right font-mono text-xs text-destructive">{r.no_show || "—"}</td>
                        <td className="py-2.5 pr-3 text-right font-mono text-xs text-muted-foreground">{r.upcoming || "—"}</td>
                        <td className="py-2.5 pr-3 text-right font-mono text-xs">{r.unique_clients}</td>
                        <td className="py-2.5 text-right font-mono text-xs">{fmt(r.revenue_cents)}</td>
                      </tr>
                    ))
                  )}
                  <tr className="border-t-2 border-border">
                    <td className="py-2.5 pr-4 font-semibold">Total staff-booked</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-xs font-semibold">{total}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-xs font-semibold text-success-soft-foreground">{totalShowed}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-xs font-semibold text-warning-soft-foreground">{totalCancelled}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-xs font-semibold text-destructive">{totalNoShow}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-xs font-semibold text-muted-foreground">{totalUpcoming}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-xs text-muted-foreground">—</td>
                    <td className="py-2.5 text-right font-mono text-xs font-semibold">{fmt(totalRevenue)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 text-muted-foreground text-xs">Online self-bookings</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-xs text-muted-foreground">{onlineCount}</td>
                    <td colSpan={6} className="py-2.5 text-right font-mono text-xs text-muted-foreground">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              Source: appointment audit log entries with action <code>manual_book</code>. <strong>Showed</strong> = completed or arrived. <strong>Cancelled</strong> = cancelled or denied. <strong>No-show</strong> = marked no_show. <strong>Upcoming</strong> = still pending or approved. Revenue sums paid sales (net of refunds) linked to those appointments.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
