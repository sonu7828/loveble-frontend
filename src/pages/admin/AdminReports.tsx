import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";
import { Loader2, BarChart3, DollarSign, Users, AlertCircle, TrendingUp, Mail, Star, Download, CalendarDays } from "lucide-react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import StaffBookingsByMonthCard from "@/components/staff/StaffBookingsByMonthCard";
import StaffOutcomes from "../staff/StaffOutcomes";
import { ClinicalOutcomesPanel } from "@/components/staff/ClinicalOutcomesPanel";

interface Appt {
  id: string; status: string; start_at: string;
  service_id: string; staff_id: string; location_id: string;
  is_new_client: boolean | null; client_email: string;
}

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const COLORS = ["hsl(var(--primary))", "#c97c5d", "#7d9b76", "#4a6741", "#c44569", "#3b6fa0", "#e8b84a", "#a78bfa"];

export default function AdminReports() {
  const { isAdmin, loading: authLoading } = useAuth();
  // Keep router hooks before any conditional returns so React hook order is stable.
  const [searchParams, setSearchParams] = useSearchParams();
  const [days, setDays] = useState(30);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [services, setServices] = useState<{ id: string; name: string; price_cents: number | null }[]>([]);
  const [staff, setStaff] = useState<{ id: string; full_name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [apptSvcMap, setApptSvcMap] = useState<Record<string, string[]>>({});
  const [apptSaleTotals, setApptSaleTotals] = useState<Record<string, number>>({});
  const [unlinkedSalesCents, setUnlinkedSalesCents] = useState(0);
  const [svcPaidRevenue, setSvcPaidRevenue] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<{ id: string; rating: number; comment: string | null; allow_testimonial: boolean; featured: boolean; created_at: string; client_email: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      const start = startOfDay(subDays(new Date(), days - 1)).toISOString();
      const end = endOfDay(new Date()).toISOString();
      const [a, sv, st, l, fb, salesRes] = await Promise.all([
        supabase.from("appointments").select("id, status, start_at, service_id, staff_id, location_id, is_new_client, client_email").gte("start_at", start).lte("start_at", end),
        supabase.from("services").select("id, name, price_cents"),
        supabase.from("staff_profiles").select("id, full_name"),
        supabase.from("locations").select("id, name"),
        supabase.from("client_feedback").select("id, rating, comment, allow_testimonial, featured, created_at, client_email").gte("created_at", start).order("created_at", { ascending: false }),
        // Real paid revenue from POS sales in window
        supabase.from("sales").select("id, appointment_id, total_cents, paid_at").eq("status", "paid").gte("paid_at", start).lte("paid_at", end),
      ]);
      const list = (a.data ?? []) as Appt[];
      setAppts(list);
      setServices(sv.data ?? []);
      setStaff(st.data ?? []);
      setLocations(l.data ?? []);
      setFeedback((fb.data ?? []) as any);

      // Build appointment_id -> sale total map, plus track walk-in/unlinked totals separately
      const saleMap: Record<string, number> = {};
      let unlinked = 0;
      const saleIds: string[] = [];
      for (const s of (salesRes.data ?? []) as any[]) {
        if (s.appointment_id) saleMap[s.appointment_id] = (saleMap[s.appointment_id] ?? 0) + (s.total_cents ?? 0);
        else unlinked += s.total_cents ?? 0;
        if (s.id) saleIds.push(s.id);
      }
      setApptSaleTotals(saleMap);
      setUnlinkedSalesCents(unlinked);

      // Per-service actual paid revenue from sale_items (reflects discounts & corrections)
      const svcRev: Record<string, number> = {};
      if (saleIds.length) {
        const { data: items } = await supabase
          .from("sale_items")
          .select("sale_id, kind, reference_id, line_total_cents")
          .in("sale_id", saleIds);
        for (const it of (items ?? []) as any[]) {
          if (!it.reference_id) continue;
          if (!["service", "unit_service", "package", "service_addon"].includes(it.kind)) continue;
          svcRev[it.reference_id] = (svcRev[it.reference_id] ?? 0) + (it.line_total_cents ?? 0);
        }
      }
      setSvcPaidRevenue(svcRev);

      const ids = list.map((x) => x.id);
      if (ids.length) {
        const { data } = await supabase.from("appointment_services").select("appointment_id, service_id").in("appointment_id", ids);
        const m: Record<string, string[]> = {};
        for (const r of (data ?? []) as any[]) (m[r.appointment_id] ||= []).push(r.service_id);
        setApptSvcMap(m);
      } else setApptSvcMap({});
      setLoading(false);
    })();
  }, [days, isAdmin]);

  const stats = useMemo(() => {
    const svcPrice = new Map(services.map((s) => [s.id, s.price_cents ?? 0]));
    let revenueCents = 0;
    let completed = 0, noShow = 0, cancelled = 0, approved = 0, pending = 0, denied = 0;
    const newClientEmails = new Set<string>();
    const svcCount = new Map<string, number>();
    const staffCount = new Map<string, number>();
    const locCount = new Map<string, number>();
    const dailyMap = new Map<string, number>();

    for (const a of appts) {
      if (a.status === "completed") completed++;
      else if (a.status === "no_show") noShow++;
      else if (a.status === "cancelled") cancelled++;
      else if (a.status === "approved") approved++;
      else if (a.status === "pending") pending++;
      else if (a.status === "denied") denied++;

      if (a.is_new_client && (a.status === "completed" || a.status === "approved")) {
        newClientEmails.add(a.client_email.toLowerCase());
      }

      if (a.status === "completed") {
        // Prefer actual paid sale total when linked; fall back to service list-price estimate
        const realTotal = apptSaleTotals[a.id];
        if (realTotal !== undefined) {
          revenueCents += realTotal;
        } else {
          const svcIds = apptSvcMap[a.id]?.length ? apptSvcMap[a.id] : [a.service_id];
          for (const sid of svcIds) revenueCents += svcPrice.get(sid) ?? 0;
        }
      }

      if (a.status !== "denied" && a.status !== "cancelled") {
        const svcIds = apptSvcMap[a.id]?.length ? apptSvcMap[a.id] : [a.service_id];
        for (const sid of svcIds) svcCount.set(sid, (svcCount.get(sid) ?? 0) + 1);
        staffCount.set(a.staff_id, (staffCount.get(a.staff_id) ?? 0) + 1);
        locCount.set(a.location_id, (locCount.get(a.location_id) ?? 0) + 1);
        const day = format(new Date(a.start_at), "yyyy-MM-dd");
        dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
      }
    }

    const totalAttended = completed + noShow;
    const noShowRate = totalAttended > 0 ? (noShow / totalAttended) * 100 : 0;

    const svcName = new Map(services.map((s) => [s.id, s.name]));
    const staffName = new Map(staff.map((s) => [s.id, s.full_name]));
    const locName = new Map(locations.map((s) => [s.id, s.name]));

    const topServices = [...svcCount.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([id, count]) => ({ name: svcName.get(id) ?? "—", count }));

    // Full list of every service performed (completed) with revenue
    // Revenue = actual paid amount from sale_items (reflects discounts, promo prices, corrections).
    // Falls back to $0 when the service was performed but never checked out.
    const svcCompletedCount = new Map<string, number>();
    for (const a of appts) {
      if (a.status !== "completed") continue;
      const svcIds = apptSvcMap[a.id]?.length ? apptSvcMap[a.id] : [a.service_id];
      for (const sid of svcIds) {
        svcCompletedCount.set(sid, (svcCompletedCount.get(sid) ?? 0) + 1);
      }
    }
    const allServices = [...svcCompletedCount.entries()]
      .map(([id, count]) => ({
        name: svcName.get(id) ?? "—",
        count,
        revenueCents: svcPaidRevenue[id] ?? 0,
      }))
      .sort((a, b) => b.count - a.count);

    const byStaff = [...staffCount.entries()]
      .map(([id, value]) => ({ name: staffName.get(id) ?? "—", value }))
      .sort((a, b) => b.value - a.value);

    const byLocation = [...locCount.entries()]
      .map(([id, value]) => ({ name: locName.get(id) ?? "—", value }));

    const dailySeries = eachDayOfInterval({ start: subDays(new Date(), days - 1), end: new Date() }).map((d) => {
      const key = format(d, "yyyy-MM-dd");
      return { date: format(d, days <= 14 ? "MMM d" : "MMM d"), bookings: dailyMap.get(key) ?? 0 };
    });

    return {
      revenueCents: revenueCents + unlinkedSalesCents,
      completed, noShow, cancelled, approved, pending, denied,
      newClients: newClientEmails.size, noShowRate,
      topServices, allServices, byStaff, byLocation, dailySeries,
      total: appts.length,
    };
  }, [appts, apptSvcMap, apptSaleTotals, unlinkedSalesCents, svcPaidRevenue, services, staff, locations, days]);

  if (authLoading) return <div className="flex justify-center py-32"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/staff/today" replace />;

  const fmtMoney = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 48;
    let y = margin;
    const pageHeight = doc.internal.pageSize.getHeight();
    const ensureSpace = (h: number) => {
      if (y + h > pageHeight - margin) { doc.addPage(); y = margin; }
    };
    doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text("Radiantilyk Aesthetic — Reports", margin, y); y += 24;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    doc.text(`Last ${days} days · generated ${format(new Date(), "MMM d, yyyy h:mm a")}`, margin, y); y += 20;

    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text("Summary", margin, y); y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    const lines = [
      `Est. revenue: ${fmtMoney(stats.revenueCents)}`,
      `Total bookings: ${stats.total}`,
      `Completed: ${stats.completed} · Approved: ${stats.approved} · Pending: ${stats.pending}`,
      `No-shows: ${stats.noShow} (${stats.noShowRate.toFixed(1)}%) · Cancelled: ${stats.cancelled} · Denied: ${stats.denied}`,
      `New clients: ${stats.newClients}`,
    ];
    for (const l of lines) { ensureSpace(14); doc.text(l, margin, y); y += 14; }
    y += 8;

    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text("All services performed (completed)", margin, y); y += 16;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("Service", margin, y);
    doc.text("Count", margin + 320, y, { align: "right" });
    doc.text("Revenue", margin + 460, y, { align: "right" });
    y += 4; doc.line(margin, y, margin + 460, y); y += 12;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    if (stats.allServices.length === 0) {
      doc.text("No services performed in this period.", margin, y); y += 14;
    } else {
      for (const s of stats.allServices) {
        ensureSpace(14);
        const name = s.name.length > 60 ? s.name.slice(0, 57) + "…" : s.name;
        doc.text(name, margin, y);
        doc.text(String(s.count), margin + 320, y, { align: "right" });
        doc.text(fmtMoney(s.revenueCents), margin + 460, y, { align: "right" });
        y += 14;
      }
    }
    y += 10;

    doc.setFont("helvetica", "bold"); doc.setFontSize(13); ensureSpace(20);
    doc.text("By location", margin, y); y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    for (const l of stats.byLocation) { ensureSpace(14); doc.text(`${l.name}: ${l.value}`, margin, y); y += 14; }
    y += 8;

    doc.setFont("helvetica", "bold"); doc.setFontSize(13); ensureSpace(20);
    doc.text("By provider", margin, y); y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    for (const s of stats.byStaff) { ensureSpace(14); doc.text(`${s.name}: ${s.value}`, margin, y); y += 14; }

    doc.save(`rka-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  // Tabbed: Performance (this page) + Outcomes (post-visit feedback rollup).
  // Outcomes used to be its own /staff/outcomes route — kept that URL as a redirect to ?tab=outcomes.
  const tab = searchParams.get("tab") === "outcomes" ? "outcomes" : "performance";

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Performance over the last {days} days · daily digest at 7am PT · monthly report emailed on the 30th</p>
        </div>
        <div className="flex items-center gap-2 self-start flex-wrap">
          <div className="inline-flex rounded-full border border-border overflow-hidden text-xs">
            {RANGES.map((r) => (
              <button key={r.days} onClick={() => setDays(r.days)}
                className={`px-3 py-1.5 ${days === r.days ? "bg-foreground text-background" : "bg-background hover:bg-secondary/40"}`}>
                {r.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" className="rounded-full" onClick={downloadPdf}>
            <Download className="h-3.5 w-3.5 mr-1.5" />Download PDF
          </Button>
          <Button
            size="sm" variant="outline" className="rounded-full"
            onClick={async () => {
              const t = toast.loading("Sending digest…");
              const { data, error } = await supabase.functions.invoke("send-daily-digest", { body: {} });
              toast.dismiss(t);
              if (error || data?.error) toast.error(data?.error || error?.message || "Could not send");
              else toast.success(`Digest sent to ${data?.sent ?? 0} admin${data?.sent === 1 ? "" : "s"}`);
            }}
          >
            <Mail className="h-3.5 w-3.5 mr-1.5" />Send digest now
          </Button>
          <Button
            size="sm" variant="outline" className="rounded-full"
            onClick={async () => {
              const t = toast.loading("Sending monthly report…");
              const { data, error } = await supabase.functions.invoke("send-monthly-report", { body: {} });
              toast.dismiss(t);
              if (error || data?.error) toast.error(data?.error || error?.message || "Could not send");
              else toast.success(`Monthly report sent to ${data?.sent ?? 0} admin${data?.sent === 1 ? "" : "s"}`);
            }}
          >
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />Email monthly report now
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => {
        const next = new URLSearchParams(searchParams);
        if (v === "performance") next.delete("tab"); else next.set("tab", v);
        setSearchParams(next, { replace: true });
      }}>
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
        </TabsList>
        <TabsContent value="performance" className="space-y-8 mt-6">
          {loading ? (
            <div className="flex justify-center py-32"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Est. revenue" value={fmtMoney(stats.revenueCents)} hint={`${stats.completed} completed`} icon={DollarSign} accent />
            <Kpi label="Total bookings" value={stats.total.toString()} hint={`${stats.approved} upcoming`} icon={BarChart3} />
            <Kpi label="New clients" value={stats.newClients.toString()} hint="first-time guests" icon={Users} />
            <Kpi label="No-show rate" value={`${stats.noShowRate.toFixed(1)}%`} hint={`${stats.noShow} no-shows`} icon={AlertCircle} highlight={stats.noShowRate > 10} />
          </div>

          {/* Status breakdown */}
          <section>
            <h2 className="font-serif text-xl mb-3">Booking status</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <StatusTile label="Completed" value={stats.completed} tone="emerald" />
              <StatusTile label="Approved" value={stats.approved} tone="emerald" />
              <StatusTile label="Pending" value={stats.pending} tone="amber" />
              <StatusTile label="No-show" value={stats.noShow} tone="rose" />
              <StatusTile label="Cancelled" value={stats.cancelled} tone="slate" />
              <StatusTile label="Denied" value={stats.denied} tone="rose" />
            </div>
          </section>

          {/* Daily trend */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-xl">Daily bookings</h2>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" />Approved + completed + no-show</span>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="bookings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top services */}
            <section>
              <h2 className="font-serif text-xl mb-3">Top services</h2>
              <div className="rounded-2xl border border-border bg-card p-4">
                {stats.topServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-8 text-center">No data yet.</p>
                ) : (
                  <ol className="space-y-2">
                    {stats.topServices.map((s, i) => {
                      const max = stats.topServices[0].count;
                      const pct = (s.count / max) * 100;
                      return (
                        <li key={i} className="text-sm">
                          <div className="flex justify-between gap-3">
                            <span className="truncate">{s.name}</span>
                            <span className="text-muted-foreground font-mono text-xs shrink-0">{s.count}</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </section>

            {/* By location */}
            <section>
              <h2 className="font-serif text-xl mb-3">By location</h2>
              <div className="rounded-2xl border border-border bg-card p-4 h-64">
                {stats.byLocation.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-8 text-center">No data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.byLocation} dataKey="value" nameKey="name" outerRadius={80} label={(e) => `${e.name}: ${e.value}`} labelLine={false}>
                        {stats.byLocation.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>

          {/* By staff */}
          <section>
            <h2 className="font-serif text-xl mb-3">By provider</h2>
            <div className="rounded-2xl border border-border bg-card p-4">
              {stats.byStaff.length === 0 ? (
                <p className="text-sm text-muted-foreground p-8 text-center">No data yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                        <th className="py-2 pr-4">Provider</th>
                        <th className="py-2 pr-4 text-right">Bookings</th>
                        <th className="py-2">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byStaff.map((s, i) => {
                        const total = stats.byStaff.reduce((a, x) => a + x.value, 0);
                        const pct = total > 0 ? (s.value / total) * 100 : 0;
                        return (
                          <tr key={i} className="border-b border-border last:border-0">
                            <td className="py-2.5 pr-4">{s.name}</td>
                            <td className="py-2.5 pr-4 text-right font-mono text-xs">{s.value}</td>
                            <td className="py-2.5 w-1/2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                                </div>
                                <span className="text-xs text-muted-foreground font-mono w-10 text-right">{pct.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Bookings by staff — monthly audit */}
          <StaffBookingsByMonthCard />

          {/* All services performed */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-xl">All services performed</h2>
              <span className="text-xs text-muted-foreground">{stats.allServices.length} service{stats.allServices.length === 1 ? "" : "s"} · completed only</span>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              {stats.allServices.length === 0 ? (
                <p className="text-sm text-muted-foreground p-8 text-center">No services performed yet in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                        <th className="py-2 pr-4">Service</th>
                        <th className="py-2 pr-4 text-right">Count</th>
                        <th className="py-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.allServices.map((s, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="py-2.5 pr-4">{s.name}</td>
                          <td className="py-2.5 pr-4 text-right font-mono text-xs">{s.count}</td>
                          <td className="py-2.5 text-right font-mono text-xs">{fmtMoney(s.revenueCents)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border">
                        <td className="py-2.5 pr-4 font-semibold">Total</td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs font-semibold">
                          {stats.allServices.reduce((a, s) => a + s.count, 0)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs font-semibold">
                          {fmtMoney(stats.allServices.reduce((a, s) => a + s.revenueCents, 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>


          {/* Client feedback */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-xl">Client feedback</h2>
              {feedback.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Avg {(feedback.reduce((a, f) => a + f.rating, 0) / feedback.length).toFixed(1)}★ · {feedback.length} response{feedback.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="rounded-2xl border border-border bg-card divide-y divide-border">
              {feedback.length === 0 ? (
                <p className="text-sm text-muted-foreground p-8 text-center">No feedback submitted yet.</p>
              ) : (
                feedback.slice(0, 10).map((f) => (
                  <div key={f.id} className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`h-3.5 w-3.5 ${f.rating >= n ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                        ))}
                        {f.allow_testimonial && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">Testimonial OK</span>
                        )}
                        {f.featured && (
                          <span className="ml-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-success/10 text-success-soft-foreground">On reviews wall</span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">{format(new Date(f.created_at), "MMM d")}</span>
                    </div>
                    {f.comment && <p className="text-sm text-foreground/90">{f.comment}</p>}
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[11px] text-muted-foreground">{f.client_email}</p>
                      {f.allow_testimonial && f.comment && (
                        <Button
                          size="sm"
                          variant={f.featured ? "outline" : "default"}
                          className="h-7 text-[11px]"
                          onClick={async () => {
                            const next = !f.featured;
                            const { error } = await supabase.from("client_feedback").update({ featured: next }).eq("id", f.id);
                            if (error) { toast.error(error.message); return; }
                            setFeedback((prev) => prev.map((x) => x.id === f.id ? { ...x, featured: next } : x));
                            toast.success(next ? "Added to public reviews wall" : "Removed from reviews wall");
                          }}
                        >
                          {f.featured ? "Unfeature" : "Feature on /reviews"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <p className="text-[11px] text-muted-foreground">
            Revenue reflects actual paid amounts from checkout (net of discounts, promos, and price corrections). Services performed but not yet checked out show $0. Cancelled and denied bookings are excluded from charts.
          </p>
            </>
          )}
        </TabsContent>
        <TabsContent value="outcomes" className="mt-6 space-y-10">
          <StaffOutcomes embedded />
          <div className="border-t border-border pt-8">
            <ClinicalOutcomesPanel />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, hint, icon: Icon, accent, highlight }: { label: string; value: string; hint: string; icon: any; accent?: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-primary/40 bg-primary/5" : highlight ? "border-destructive/30 bg-destructive-soft/50" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className={`h-4 w-4 ${accent ? "text-primary" : highlight ? "text-destructive-soft-foreground" : "text-muted-foreground"}`} />
      </div>
      <div className="mt-2">
        <div className="font-serif text-2xl">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
      </div>
    </div>
  );
}

function StatusTile({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" | "slate" }) {
  const cls = tone === "emerald" ? "bg-success-soft text-success-soft-foreground border-success/30"
    : tone === "amber" ? "bg-warning-soft text-warning-soft-foreground border-warning/30"
    : tone === "rose" ? "bg-destructive-soft text-destructive-soft-foreground border-destructive/30"
    : "bg-secondary/40 text-foreground border-border";
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="font-serif text-xl mt-0.5">{value}</div>
    </div>
  );
}


