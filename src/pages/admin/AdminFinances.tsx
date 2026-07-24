import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, differenceInCalendarDays, eachDayOfInterval,
} from "date-fns";
import {
  Loader2, DollarSign, Receipt, AlertTriangle, Ticket, Download, FileText,
  TrendingUp, TrendingDown, Calendar as CalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface Sale {
  id: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  location_id: string;
  staff_id: string | null;
  subtotal_cents: number;
  discount_cents: number;
  tip_cents: number;
  processing_fee_cents: number;
  tax_cents: number;
  total_cents: number;
  refunded_amount_cents: number;
  voucher_applied_cents: number;
  payment_method: string | null;
  promo_code: string | null;
  appointment_id: string | null;
}
interface SaleItem {
  sale_id: string;
  kind: string;
  reference_id: string | null;
  label: string;
  quantity: number;
  line_total_cents: number;
}
interface Appt {
  id: string;
  status: string;
  start_at: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  deposit_charged_at: string | null;
  deposit_amount_cents: number | null;
  no_show_charged_at: string | null;
  staff_id: string;
  location_id: string;
}

type Preset = "today" | "7d" | "30d" | "mtd" | "ytd" | "custom";

const fmt = (c: number) =>
  `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pctDelta = (curr: number, prev: number) => {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / Math.abs(prev)) * 100;
};

function presetRange(p: Preset): { start: Date; end: Date } {
  const now = new Date();
  switch (p) {
    case "today": return { start: startOfDay(now), end: endOfDay(now) };
    case "7d": return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "30d": return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "mtd": return { start: startOfMonth(now), end: endOfDay(now) };
    case "ytd": return { start: startOfYear(now), end: endOfDay(now) };
    default: return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
  }
}

export default function AdminFinances() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [preset, setPreset] = useState<Preset>("30d");
  const [range, setRange] = useState<{ start: Date; end: Date }>(presetRange("30d"));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [curr, setCurr] = useState<Sale[]>([]);
  const [prev, setPrev] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [staff, setStaff] = useState<Record<string, string>>({});
  const [locations, setLocations] = useState<Record<string, string>>({});

  useEffect(() => {
    if (preset !== "custom") setRange(presetRange(preset));
  }, [preset]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      const span = Math.max(1, differenceInCalendarDays(range.end, range.start) + 1);
      const prevEnd = endOfDay(subDays(range.start, 1));
      const prevStart = startOfDay(subDays(prevEnd, span - 1));

      const cols = "id,status,paid_at,created_at,location_id,staff_id,subtotal_cents,discount_cents,tip_cents,processing_fee_cents,tax_cents,total_cents,refunded_amount_cents,voucher_applied_cents,payment_method,promo_code,appointment_id";

      const [salesCurr, salesPrev, ap, st, loc] = await Promise.all([
        supabase.from("sales").select(cols)
          .in("status", ["paid", "partially_refunded", "refunded"])
          .gte("paid_at", range.start.toISOString())
          .lte("paid_at", range.end.toISOString()),
        supabase.from("sales").select(cols)
          .in("status", ["paid", "partially_refunded", "refunded"])
          .gte("paid_at", prevStart.toISOString())
          .lte("paid_at", prevEnd.toISOString()),
        supabase.from("appointments")
          .select("id,status,start_at,client_first_name,client_last_name,client_email,deposit_charged_at,deposit_amount_cents,no_show_charged_at,staff_id,location_id")
          .gte("start_at", range.start.toISOString())
          .lte("start_at", range.end.toISOString()),
        supabase.from("staff_profiles").select("id,full_name"),
        supabase.from("locations").select("id,name"),
      ]);

      const currSales = (salesCurr.data ?? []) as Sale[];
      setCurr(currSales);
      setPrev((salesPrev.data ?? []) as Sale[]);
      setAppts((ap.data ?? []) as Appt[]);
      setStaff(Object.fromEntries((st.data ?? []).map((s: any) => [s.id, s.full_name])));
      setLocations(Object.fromEntries((loc.data ?? []).map((l: any) => [l.id, l.name])));

      const ids = currSales.map((s) => s.id);
      if (ids.length) {
        const { data: it } = await supabase
          .from("sale_items")
          .select("sale_id,kind,reference_id,label,quantity,line_total_cents")
          .in("sale_id", ids);
        setItems((it ?? []) as SaleItem[]);
      } else {
        setItems([]);
      }
      setLoading(false);
    })();
  }, [range, isAdmin]);

  const summary = useMemo(() => {
    const agg = (rows: Sale[]) => {
      let gross = 0, discount = 0, tip = 0, fee = 0, tax = 0, total = 0,
        refund = 0, voucher = 0, count = 0;
      for (const s of rows) {
        gross += s.subtotal_cents;
        discount += s.discount_cents;
        tip += s.tip_cents;
        fee += s.processing_fee_cents;
        tax += s.tax_cents;
        total += s.total_cents;
        refund += s.refunded_amount_cents;
        voucher += s.voucher_applied_cents;
        count++;
      }
      return { gross, discount, tip, fee, tax, total, refund, voucher, count, net: total - refund };
    };
    return { c: agg(curr), p: agg(prev) };
  }, [curr, prev]);

  // Daily series
  const dailySeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of curr) {
      if (!s.paid_at) continue;
      const k = format(new Date(s.paid_at), "yyyy-MM-dd");
      map.set(k, (map.get(k) ?? 0) + (s.total_cents - s.refunded_amount_cents));
    }
    const days = eachDayOfInterval({ start: range.start, end: range.end });
    return days.map((d) => ({
      date: format(d, days.length > 60 ? "MMM" : "MMM d"),
      net: (map.get(format(d, "yyyy-MM-dd")) ?? 0) / 100,
    }));
  }, [curr, range]);

  // Breakdowns
  const byBucket = (keyFn: (s: Sale) => string, nameMap?: Record<string, string>) => {
    const m = new Map<string, { net: number; count: number }>();
    for (const s of curr) {
      const k = keyFn(s) || "—";
      const cur = m.get(k) ?? { net: 0, count: 0 };
      cur.net += s.total_cents - s.refunded_amount_cents;
      cur.count++;
      m.set(k, cur);
    }
    return [...m.entries()]
      .map(([id, v]) => ({ name: nameMap?.[id] ?? id, ...v }))
      .sort((a, b) => b.net - a.net);
  };
  const byLocation = useMemo(() => byBucket((s) => s.location_id, locations), [curr, locations]);
  const byStaff = useMemo(() => byBucket((s) => s.staff_id ?? "", staff), [curr, staff]);

  const byServiceProduct = useMemo(() => {
    const m = new Map<string, { net: number; count: number; kind: string }>();
    for (const it of items) {
      const k = `${it.kind}:${it.label}`;
      const cur = m.get(k) ?? { net: 0, count: 0, kind: it.kind };
      cur.net += it.line_total_cents;
      cur.count += Number(it.quantity) || 1;
      m.set(k, cur);
    }
    return [...m.entries()]
      .map(([k, v]) => ({ name: k.split(":").slice(1).join(":"), ...v }))
      .sort((a, b) => b.net - a.net);
  }, [items]);

  // Refunds list
  const refunds = useMemo(
    () => curr.filter((s) => s.refunded_amount_cents > 0)
      .sort((a, b) => b.refunded_amount_cents - a.refunded_amount_cents),
    [curr]
  );

  // No-show fees (from appointments)
  const noShowFees = useMemo(() => {
    const charged = appts.filter((a) => a.no_show_charged_at);
    const total = charged.length * 20000; // $200 policy
    return { count: charged.length, total, rows: charged };
  }, [appts]);

  // Outstanding — completed appointments with no paid sale in range OR ever
  const outstanding = useMemo(() => {
    const paidApptIds = new Set(
      curr.filter((s) => s.status === "paid" || s.status === "partially_refunded")
        .map((s) => s.appointment_id).filter(Boolean) as string[]
    );
    return appts.filter((a) => a.status === "completed" && !paidApptIds.has(a.id));
  }, [appts, curr]);

  // Deposits charged (from appointments.deposit_charged_at within range)
  const deposits = useMemo(() => {
    const rows = appts.filter((a) => a.deposit_charged_at);
    const total = rows.reduce((s, a) => s + (a.deposit_amount_cents ?? 0), 0);
    return { count: rows.length, total, rows };
  }, [appts]);

  // Vouchers
  const [vouchers, setVouchers] = useState<{ sold: number; soldCount: number; redeemed: number; redeemedCount: number }>({
    sold: 0, soldCount: 0, redeemed: 0, redeemedCount: 0,
  });
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [{ data: v }, { data: r }] = await Promise.all([
        supabase.from("vouchers")
          .select("original_amount_cents,created_at")
          .gte("created_at", range.start.toISOString())
          .lte("created_at", range.end.toISOString()),
        supabase.from("voucher_redemptions")
          .select("amount_cents,redeemed_at,reversed_at")
          .gte("redeemed_at", range.start.toISOString())
          .lte("redeemed_at", range.end.toISOString()),
      ]);
      const sold = (v ?? []).reduce((s: number, x: any) => s + (x.original_amount_cents ?? 0), 0);
      const redeemed = (r ?? []).filter((x: any) => !x.reversed_at)
        .reduce((s: number, x: any) => s + (x.amount_cents ?? 0), 0);
      setVouchers({
        sold, soldCount: (v ?? []).length,
        redeemed, redeemedCount: (r ?? []).filter((x: any) => !x.reversed_at).length,
      });
    })();
  }, [range, isAdmin]);

  // Promos
  const promoUsage = useMemo(() => {
    const m = new Map<string, { count: number; discount: number }>();
    for (const s of curr) {
      if (!s.promo_code) continue;
      const cur = m.get(s.promo_code) ?? { count: 0, discount: 0 };
      cur.count++;
      cur.discount += s.discount_cents;
      m.set(s.promo_code, cur);
    }
    return [...m.entries()].map(([code, v]) => ({ code, ...v })).sort((a, b) => b.discount - a.discount);
  }, [curr]);

  if (authLoading) return <div className="flex justify-center py-32"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/staff/today" replace />;

  const exportCSV = () => {
    const lines: string[][] = [
      ["Radiantilyk Aesthetic — Finance Report"],
      [`Range: ${format(range.start, "PP")} – ${format(range.end, "PP")}`],
      [],
      ["Summary", "Current", "Previous", "% change"],
      ["Gross sales", fmt(summary.c.gross), fmt(summary.p.gross), pctDelta(summary.c.gross, summary.p.gross).toFixed(1) + "%"],
      ["Discounts", fmt(summary.c.discount), fmt(summary.p.discount), pctDelta(summary.c.discount, summary.p.discount).toFixed(1) + "%"],
      ["Tips", fmt(summary.c.tip), fmt(summary.p.tip), pctDelta(summary.c.tip, summary.p.tip).toFixed(1) + "%"],
      ["Processing fees", fmt(summary.c.fee), fmt(summary.p.fee), pctDelta(summary.c.fee, summary.p.fee).toFixed(1) + "%"],
      ["Taxes", fmt(summary.c.tax), fmt(summary.p.tax), pctDelta(summary.c.tax, summary.p.tax).toFixed(1) + "%"],
      ["Vouchers redeemed", fmt(summary.c.voucher), fmt(summary.p.voucher), pctDelta(summary.c.voucher, summary.p.voucher).toFixed(1) + "%"],
      ["Refunds", fmt(summary.c.refund), fmt(summary.p.refund), pctDelta(summary.c.refund, summary.p.refund).toFixed(1) + "%"],
      ["Total charged", fmt(summary.c.total), fmt(summary.p.total), pctDelta(summary.c.total, summary.p.total).toFixed(1) + "%"],
      ["Net revenue", fmt(summary.c.net), fmt(summary.p.net), pctDelta(summary.c.net, summary.p.net).toFixed(1) + "%"],
      ["Transactions", String(summary.c.count), String(summary.p.count), pctDelta(summary.c.count, summary.p.count).toFixed(1) + "%"],
      [],
      ["By location", "Net", "Transactions"],
      ...byLocation.map((r) => [r.name, fmt(r.net), String(r.count)]),
      [],
      ["By provider", "Net", "Transactions"],
      ...byStaff.map((r) => [r.name, fmt(r.net), String(r.count)]),
      [],
      ["By service / product", "Net", "Qty"],
      ...byServiceProduct.map((r) => [r.name, fmt(r.net), String(r.count)]),
      [],
      ["Refunds", "Sale", "Amount"],
      ...refunds.map((r) => [r.id, "", fmt(r.refunded_amount_cents)]),
      [],
      ["Outstanding (completed, unpaid)", "Client", "Service date"],
      ...outstanding.map((a) => [a.id, `${a.client_first_name} ${a.client_last_name}`, format(new Date(a.start_at), "PP")]),
      [],
      ["Deposits / no-show fees"],
      ["Deposits charged", String(deposits.count), fmt(deposits.total)],
      ["No-show fees", String(noShowFees.count), fmt(noShowFees.total)],
      [],
      ["Vouchers"],
      ["Sold", String(vouchers.soldCount), fmt(vouchers.sold)],
      ["Redeemed", String(vouchers.redeemedCount), fmt(vouchers.redeemed)],
      [],
      ["Promo codes used", "Uses", "Discount given"],
      ...promoUsage.map((p) => [p.code, String(p.count), fmt(p.discount)]),
    ];
    const csv = lines.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance_${format(range.start, "yyyyMMdd")}_${format(range.end, "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 50;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Radiantilyk Aesthetic — Finance Report", 40, y); y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${format(range.start, "PP")} – ${format(range.end, "PP")}`, 40, y); y += 22;

    const row = (label: string, currVal: string, prevVal: string) => {
      doc.setFont("helvetica", "normal");
      doc.text(label, 40, y);
      doc.text(currVal, 320, y, { align: "right" });
      doc.text(prevVal, 460, y, { align: "right" });
      const d = pctDelta(
        Number(currVal.replace(/[^0-9.-]/g, "")),
        Number(prevVal.replace(/[^0-9.-]/g, ""))
      );
      doc.text(`${d >= 0 ? "+" : ""}${d.toFixed(1)}%`, pageW - 40, y, { align: "right" });
      y += 16;
    };

    doc.setFont("helvetica", "bold");
    doc.text("Summary", 40, y);
    doc.text("Current", 320, y, { align: "right" });
    doc.text("Previous", 460, y, { align: "right" });
    doc.text("Change", pageW - 40, y, { align: "right" });
    y += 14;
    doc.setLineWidth(0.5);
    doc.line(40, y, pageW - 40, y); y += 12;

    row("Gross sales", fmt(summary.c.gross), fmt(summary.p.gross));
    row("Discounts", fmt(summary.c.discount), fmt(summary.p.discount));
    row("Tips", fmt(summary.c.tip), fmt(summary.p.tip));
    row("Processing fees", fmt(summary.c.fee), fmt(summary.p.fee));
    row("Taxes", fmt(summary.c.tax), fmt(summary.p.tax));
    row("Vouchers redeemed", fmt(summary.c.voucher), fmt(summary.p.voucher));
    row("Refunds", fmt(summary.c.refund), fmt(summary.p.refund));
    doc.setFont("helvetica", "bold");
    row("Net revenue", fmt(summary.c.net), fmt(summary.p.net));
    row("Transactions", String(summary.c.count), String(summary.p.count));

    const block = (title: string, rows: { name: string; net?: number; count?: number; amount?: number }[]) => {
      if (y > 700) { doc.addPage(); y = 50; }
      y += 14;
      doc.setFont("helvetica", "bold");
      doc.text(title, 40, y); y += 12;
      doc.line(40, y, pageW - 40, y); y += 12;
      doc.setFont("helvetica", "normal");
      for (const r of rows.slice(0, 30)) {
        if (y > 740) { doc.addPage(); y = 50; }
        doc.text(r.name.slice(0, 60), 40, y);
        doc.text(fmt(r.net ?? r.amount ?? 0), pageW - 40, y, { align: "right" });
        if (r.count !== undefined) doc.text(`(${r.count})`, pageW - 110, y, { align: "right" });
        y += 14;
      }
    };

    block("By location", byLocation);
    block("By provider", byStaff);
    block("Top services & products", byServiceProduct);
    if (deposits.count || noShowFees.count) {
      block("Deposits & no-show fees", [
        { name: `Deposits (${deposits.count})`, amount: deposits.total },
        { name: `No-show fees (${noShowFees.count})`, amount: noShowFees.total },
      ]);
    }
    if (vouchers.soldCount || vouchers.redeemedCount) {
      block("Vouchers", [
        { name: `Sold (${vouchers.soldCount})`, amount: vouchers.sold },
        { name: `Redeemed (${vouchers.redeemedCount})`, amount: vouchers.redeemed },
      ]);
    }
    if (promoUsage.length) {
      block("Promo codes", promoUsage.map((p) => ({ name: `${p.code} · ${p.count} uses`, amount: p.discount })));
    }

    doc.save(`finance_${format(range.start, "yyyyMMdd")}_${format(range.end, "yyyyMMdd")}.pdf`);
    toast.success("PDF exported");
  };

  const PRESETS: { id: Preset; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "7d", label: "7d" },
    { id: "30d", label: "30d" },
    { id: "mtd", label: "MTD" },
    { id: "ytd", label: "YTD" },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Finances</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(range.start, "PP")} – {format(range.end, "PP")} · vs prior {differenceInCalendarDays(range.end, range.start) + 1} days
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-border overflow-hidden text-xs">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 ${preset === p.id ? "bg-foreground text-background" : "bg-background hover:bg-secondary/40"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`rounded-full ${preset === "custom" ? "border-foreground" : ""}`}
              >
                <CalIcon className="h-3.5 w-3.5 mr-1.5" />Custom
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: range.start, to: range.end }}
                onSelect={(r: any) => {
                  if (r?.from && r?.to) {
                    setRange({ start: startOfDay(r.from), end: endOfDay(r.to) });
                    setPreset("custom");
                    setPickerOpen(false);
                  }
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="outline" className="rounded-full" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1.5" />CSV
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={exportPDF}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />PDF
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-32"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Net revenue" curr={summary.c.net} prev={summary.p.net} icon={DollarSign} accent money />
            <Kpi label="Gross sales" curr={summary.c.gross} prev={summary.p.gross} icon={Receipt} money />
            <Kpi label="Tips collected" curr={summary.c.tip} prev={summary.p.tip} icon={DollarSign} money />
            <Kpi label="Refunds" curr={summary.c.refund} prev={summary.p.refund} icon={AlertTriangle} money invert />
          </div>

          {/* Trend */}
          <section>
            <h2 className="font-serif text-xl mb-3">Daily net revenue</h2>
            <div className="rounded-2xl border border-border bg-card p-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => `$${Number(v).toLocaleString()}`}
                  />
                  <Bar dataKey="net" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <Tabs defaultValue="payments" className="w-full">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="breakdown">By service / staff</TabsTrigger>
              <TabsTrigger value="refunds">Refunds & outstanding</TabsTrigger>
              <TabsTrigger value="deposits">Deposits, vouchers, promos</TabsTrigger>
            </TabsList>

            <TabsContent value="payments" className="mt-4">
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h3 className="font-serif text-lg mb-3">Payments breakdown</h3>
                <Row label="Gross sales" c={summary.c.gross} p={summary.p.gross} />
                <Row label="Discounts" c={summary.c.discount} p={summary.p.discount} invert />
                <Row label="Tips" c={summary.c.tip} p={summary.p.tip} />
                <Row label="Processing fees" c={summary.c.fee} p={summary.p.fee} invert />
                <Row label="Taxes" c={summary.c.tax} p={summary.p.tax} />
                <Row label="Vouchers redeemed" c={summary.c.voucher} p={summary.p.voucher} />
                <Row label="Refunds" c={summary.c.refund} p={summary.p.refund} invert />
                <div className="mt-3 pt-3 border-t border-border">
                  <Row label="Total charged" c={summary.c.total} p={summary.p.total} bold />
                  <Row label="Net revenue (after refunds)" c={summary.c.net} p={summary.p.net} bold />
                  <Row label="Transactions" c={summary.c.count} p={summary.p.count} bold count />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="breakdown" className="mt-4 space-y-6">
              <Section title="By location" rows={byLocation} />
              <Section title="By provider" rows={byStaff} />
              <Section title="Top services & products" rows={byServiceProduct.slice(0, 20)} />
            </TabsContent>

            <TabsContent value="refunds" className="mt-4 space-y-6">
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-serif text-lg">Refunds in range</h3>
                  <span className="text-sm font-mono">{fmt(summary.c.refund)} · {refunds.length}</span>
                </div>
                {refunds.length === 0 ? (
                  <p className="p-8 text-sm text-muted-foreground text-center">No refunds in this period.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground uppercase tracking-wider">
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-4">Sale</th>
                        <th className="text-left py-2 px-4">Location</th>
                        <th className="text-right py-2 px-4">Refunded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {refunds.map((s) => (
                        <tr key={s.id} className="border-b border-border last:border-0">
                          <td className="py-2.5 px-4 font-mono text-xs">{s.id.slice(0, 8)}</td>
                          <td className="py-2.5 px-4">{locations[s.location_id] ?? "—"}</td>
                          <td className="py-2.5 px-4 text-right font-mono">{fmt(s.refunded_amount_cents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-serif text-lg">Outstanding (completed, unpaid)</h3>
                  <span className="text-sm font-mono">{outstanding.length}</span>
                </div>
                {outstanding.length === 0 ? (
                  <p className="p-8 text-sm text-muted-foreground text-center">No outstanding balances.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground uppercase tracking-wider">
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-4">Client</th>
                        <th className="text-left py-2 px-4">Location</th>
                        <th className="text-left py-2 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outstanding.map((a) => (
                        <tr key={a.id} className="border-b border-border last:border-0">
                          <td className="py-2.5 px-4">{a.client_first_name} {a.client_last_name}</td>
                          <td className="py-2.5 px-4">{locations[a.location_id] ?? "—"}</td>
                          <td className="py-2.5 px-4 font-mono text-xs">{format(new Date(a.start_at), "PP")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </TabsContent>

            <TabsContent value="deposits" className="mt-4 space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <SimpleCard
                  title="Deposits charged"
                  rows={[
                    { label: "Total deposits", value: fmt(deposits.total) },
                    { label: "Count", value: String(deposits.count) },
                  ]}
                />
                <SimpleCard
                  title="No-show fees ($200 policy)"
                  rows={[
                    { label: "Collected", value: fmt(noShowFees.total) },
                    { label: "Count", value: String(noShowFees.count) },
                  ]}
                />
                <SimpleCard
                  title="Vouchers sold"
                  rows={[
                    { label: "Face value", value: fmt(vouchers.sold) },
                    { label: "Count", value: String(vouchers.soldCount) },
                  ]}
                />
                <SimpleCard
                  title="Vouchers redeemed"
                  rows={[
                    { label: "Redeemed", value: fmt(vouchers.redeemed) },
                    { label: "Count", value: String(vouchers.redeemedCount) },
                  ]}
                />
              </div>

              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="p-4 border-b border-border flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-primary" />
                  <h3 className="font-serif text-lg">Promo code usage</h3>
                </div>
                {promoUsage.length === 0 ? (
                  <p className="p-8 text-sm text-muted-foreground text-center">No promo codes used in this period.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground uppercase tracking-wider">
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-4">Code</th>
                        <th className="text-right py-2 px-4">Uses</th>
                        <th className="text-right py-2 px-4">Discount given</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promoUsage.map((p) => (
                        <tr key={p.code} className="border-b border-border last:border-0">
                          <td className="py-2.5 px-4 font-mono">{p.code}</td>
                          <td className="py-2.5 px-4 text-right font-mono">{p.count}</td>
                          <td className="py-2.5 px-4 text-right font-mono">{fmt(p.discount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function Kpi({ label, curr, prev, icon: Icon, accent, money, invert }: {
  label: string; curr: number; prev: number; icon: any;
  accent?: boolean; money?: boolean; invert?: boolean;
}) {
  const d = pctDelta(curr, prev);
  const good = invert ? d <= 0 : d >= 0;
  return (
    <div className={`rounded-2xl border ${accent ? "border-primary/40 bg-primary/5" : "border-border bg-card"} p-4`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-semibold">{money ? fmt(curr) : curr.toLocaleString()}</div>
      <div className={`mt-1 text-xs flex items-center gap-1 ${good ? "text-success-soft-foreground" : "text-destructive-soft-foreground"}`}>
        {d >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {d >= 0 ? "+" : ""}{d.toFixed(1)}% vs prior
      </div>
    </div>
  );
}

function Row({ label, c, p, bold, invert, count }: {
  label: string; c: number; p: number; bold?: boolean; invert?: boolean; count?: boolean;
}) {
  const d = pctDelta(c, p);
  const good = invert ? d <= 0 : d >= 0;
  return (
    <div className={`flex items-center justify-between py-2 ${bold ? "font-medium" : ""}`}>
      <span>{label}</span>
      <div className="flex items-center gap-4 font-mono text-sm">
        <span>{count ? c.toLocaleString() : fmt(c)}</span>
        <span className="text-muted-foreground text-xs w-20 text-right">
          prev {count ? p.toLocaleString() : fmt(p)}
        </span>
        <span className={`text-xs w-16 text-right ${good ? "text-success-soft-foreground" : "text-destructive-soft-foreground"}`}>
          {d >= 0 ? "+" : ""}{d.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: { name: string; net: number; count: number }[] }) {
  const max = rows[0]?.net ?? 0;
  const total = rows.reduce((s, r) => s + r.net, 0);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-lg">{title}</h3>
        <span className="text-xs font-mono text-muted-foreground">{fmt(total)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground p-4 text-center">No data.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => {
            const pct = max > 0 ? (r.net / max) * 100 : 0;
            return (
              <li key={i} className="text-sm">
                <div className="flex justify-between gap-3">
                  <span className="truncate">{r.name}</span>
                  <span className="font-mono text-xs shrink-0 text-muted-foreground">
                    {fmt(r.net)} · {r.count}
                  </span>
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
  );
}

function SimpleCard({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-serif text-lg mb-2">{title}</h3>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-mono">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

