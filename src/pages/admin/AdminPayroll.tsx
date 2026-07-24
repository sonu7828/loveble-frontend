import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ChevronLeft, ChevronRight, Printer, CheckCircle2, DollarSign, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm";
import { format, addDays, startOfDay } from "date-fns";

type Member = {
  id: string;
  full_name: string;
  title: string;
  email: string | null;
  is_active: boolean;
  hourly_rate_cents: number;
  commission_percent: number;
};

type ComputedRow = {
  member: Member;
  hours: number;
  hourly_pay_cents: number;
  commission_base_cents: number;
  commission_cents: number;
  tips_cents: number;
  total_cents: number;
};

type Payout = {
  id: string;
  staff_id: string;
  period_start: string;
  period_end: string;
  hours_worked: number;
  hourly_rate_cents: number;
  hourly_pay_cents: number;
  commission_percent: number;
  commission_base_cents: number;
  commission_cents: number;
  tips_cents: number;
  adjustments_cents: number;
  adjustment_note: string | null;
  total_cents: number;
  method: string;
  payment_note: string | null;
  paid_at: string;
  detail: any;
};

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Returns the Saturday that begins the most recently completed Sat–Fri payable week. */
function defaultPeriodStart(): Date {
  const today = startOfDay(new Date());
  // We pay on Saturday for the prior Sat–Fri.
  // If today is Saturday (6) or later in the week, the period that just ended Friday is the answer.
  // Find most recent Friday (yesterday if today=Sat).
  const dow = today.getDay(); // 0 Sun..6 Sat
  // Most recent Friday: subtract (dow + 2) % 7, but ensure positive
  const daysSinceFriday = (dow + 2) % 7; // Sat->1, Sun->2, ... Fri->0 -> we want PRIOR Friday if today=Fri, so use 7 in that case
  const friOffset = daysSinceFriday === 0 ? 7 : daysSinceFriday;
  const periodEnd = addDays(today, -friOffset); // a Friday
  const periodStart = addDays(periodEnd, -6); // Saturday
  return periodStart;
}

function toISODate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default function AdminPayroll() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [periodStart, setPeriodStart] = useState<Date>(defaultPeriodStart());
  const [rows, setRows] = useState<ComputedRow[]>([]);
  const [payouts, setPayouts] = useState<Record<string, Payout>>({}); // by staff_id

  const [paying, setPaying] = useState<ComputedRow | null>(null);
  const [adjustments, setAdjustments] = useState("0");
  const [adjNote, setAdjNote] = useState("");
  const [method, setMethod] = useState("zelle");
  const [paymentNote, setPaymentNote] = useState("");
  const [saving, setSaving] = useState(false);

  const periodEnd = useMemo(() => addDays(periodStart, 6), [periodStart]);
  const payDate = useMemo(() => addDays(periodEnd, 1), [periodEnd]); // Saturday following

  const periodStartISO = toISODate(periodStart);
  const periodEndISO = toISODate(periodEnd);

  const load = async () => {
    setLoading(true);
    try {
      // Members + pay config
      const { data: m } = await supabase
        .from("staff_profiles")
        .select("id, full_name, title, email, is_active")
        .eq("is_active", true)
        .order("full_name");
      const { data: pay } = await (supabase as any).from("staff_pay_config")
        .select("staff_id, hourly_rate_cents, commission_percent");
      const payMap: Record<string, { rate: number; pct: number }> = {};
      (pay ?? []).forEach((p: any) => {
        payMap[p.staff_id] = {
          rate: p.hourly_rate_cents ?? 0,
          pct: Number(p.commission_percent ?? 0),
        };
      });
      const list: Member[] = (m ?? []).map((r: any) => ({
        id: r.id,
        full_name: r.full_name,
        title: r.title,
        email: r.email,
        is_active: r.is_active,
        hourly_rate_cents: payMap[r.id]?.rate ?? 0,
        commission_percent: payMap[r.id]?.pct ?? 0,
      }));
      setMembers(list);

      // Period boundaries as timestamptz
      const startTs = new Date(periodStart);
      startTs.setHours(0, 0, 0, 0);
      const endTs = new Date(periodEnd);
      endTs.setHours(23, 59, 59, 999);

      // Time entries in window (clock_in within period, clock_out not null)
      const { data: entries } = await supabase
        .from("staff_time_entries")
        .select("staff_id, clock_in, clock_out")
        .gte("clock_in", startTs.toISOString())
        .lte("clock_in", endTs.toISOString())
        .not("clock_out", "is", null);

      const hoursMap: Record<string, number> = {};
      (entries ?? []).forEach((e: any) => {
        if (!e.clock_out) return;
        const ms = new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime();
        hoursMap[e.staff_id] = (hoursMap[e.staff_id] ?? 0) + ms / 3_600_000;
      });

      // Paid sales in window per staff (for tips)
      const { data: sales } = await supabase
        .from("sales")
        .select("id, staff_id, tip_cents, paid_at, status")
        .eq("status", "paid")
        .gte("paid_at", startTs.toISOString())
        .lte("paid_at", endTs.toISOString());

      const tipsMap: Record<string, number> = {};
      const saleStaff: Record<string, string> = {};
      const saleIds: string[] = [];
      (sales ?? []).forEach((s: any) => {
        if (!s.staff_id) return;
        tipsMap[s.staff_id] = (tipsMap[s.staff_id] ?? 0) + (s.tip_cents ?? 0);
        saleStaff[s.id] = s.staff_id;
        saleIds.push(s.id);
      });

      // Service line items on those sales for commission base
      const commissionBaseMap: Record<string, number> = {};
      if (saleIds.length) {
        const { data: items } = await supabase
          .from("sale_items")
          .select("sale_id, kind, line_total_cents")
          .in("sale_id", saleIds)
          .in("kind", ["service", "unit_service", "package"]);
        (items ?? []).forEach((it: any) => {
          const sid = saleStaff[it.sale_id];
          if (!sid) return;
          commissionBaseMap[sid] = (commissionBaseMap[sid] ?? 0) + (it.line_total_cents ?? 0);
        });
      }

      const computed: ComputedRow[] = list.map((mem) => {
        const hours = Math.round((hoursMap[mem.id] ?? 0) * 100) / 100;
        const hourly_pay_cents = Math.round(hours * mem.hourly_rate_cents);
        const commission_base_cents = commissionBaseMap[mem.id] ?? 0;
        const commission_cents = Math.round(commission_base_cents * (mem.commission_percent / 100));
        const tips_cents = tipsMap[mem.id] ?? 0;
        const total_cents = hourly_pay_cents + commission_cents + tips_cents;
        return { member: mem, hours, hourly_pay_cents, commission_base_cents, commission_cents, tips_cents, total_cents };
      });
      setRows(computed);

      // Existing payouts for this period
      const { data: po } = await supabase
        .from("staff_payouts" as any)
        .select("*")
        .eq("period_start", periodStartISO)
        .eq("period_end", periodEndISO);
      const pMap: Record<string, Payout> = {};
      (po ?? []).forEach((p: any) => { pMap[p.staff_id] = p as Payout; });
      setPayouts(pMap);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load payroll");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line */ }, [isAdmin, periodStartISO]);

  const openPay = (row: ComputedRow) => {
    setPaying(row);
    setAdjustments("0");
    setAdjNote("");
    setMethod("zelle");
    setPaymentNote("");
  };

  const finalTotal = useMemo(() => {
    if (!paying) return 0;
    const adj = Math.round((parseFloat(adjustments || "0") || 0) * 100);
    return paying.total_cents + adj;
  }, [paying, adjustments]);

  const confirmPay = async () => {
    if (!paying) return;
    setSaving(true);
    const adj = Math.round((parseFloat(adjustments || "0") || 0) * 100);
    const total = paying.total_cents + adj;
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await (supabase as any).from("staff_payouts").upsert({
      staff_id: paying.member.id,
      period_start: periodStartISO,
      period_end: periodEndISO,
      hours_worked: paying.hours,
      hourly_rate_cents: paying.member.hourly_rate_cents,
      hourly_pay_cents: paying.hourly_pay_cents,
      commission_percent: paying.member.commission_percent,
      commission_base_cents: paying.commission_base_cents,
      commission_cents: paying.commission_cents,
      tips_cents: paying.tips_cents,
      adjustments_cents: adj,
      adjustment_note: adjNote || null,
      total_cents: total,
      method,
      payment_note: paymentNote || null,
      paid_by: user?.id ?? null,
      paid_at: new Date().toISOString(),
      detail: {
        computed_at: new Date().toISOString(),
        period_label: `${format(periodStart, "MMM d")} – ${format(periodEnd, "MMM d, yyyy")}`,
      },
    }, { onConflict: "staff_id,period_start,period_end" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Recorded payment to ${paying.member.full_name}`);
    setPaying(null);
    load();
  };

  const unmarkPaid = async (staff_id: string) => {
    if (!(await confirmDialog({ title: "Remove payout record?", description: "The staff member will appear as unpaid for this pay period. This action can be reversed.", destructive: true, confirmLabel: "Remove Payout" }))) return;
    const { error } = await (supabase as any).from("staff_payouts")
      .delete()
      .eq("staff_id", staff_id)
      .eq("period_start", periodStartISO)
      .eq("period_end", periodEndISO);
    if (error) { toast.error(error.message); return; }
    toast.success("Payout removed");
    load();
  };

  const printStub = (row: ComputedRow, payout?: Payout) => {
    const adj = payout?.adjustments_cents ?? 0;
    const adjNoteVal = payout?.adjustment_note ?? "";
    const total = payout?.total_cents ?? row.total_cents;
    const paidAt = payout?.paid_at ? format(new Date(payout.paid_at), "MMM d, yyyy h:mm a") : "Not yet paid";
    const methodVal = payout?.method ?? "—";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Pay stub — ${row.member.full_name}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color:#111; max-width:640px; margin:2.5rem auto; padding:0 1.5rem; }
  h1 { font-family: Georgia, serif; font-size:1.6rem; margin:0 0 .25rem; }
  .muted { color:#666; font-size:.85rem; }
  hr { border:none; border-top:1px solid #ddd; margin:1.5rem 0; }
  table { width:100%; border-collapse:collapse; }
  td { padding:.45rem 0; font-size:.95rem; }
  td.r { text-align:right; }
  .total td { font-weight:600; border-top:1px solid #111; padding-top:.75rem; font-size:1.05rem; }
  .grand td { font-weight:700; font-size:1.2rem; padding-top:1rem; }
  .stamp { display:inline-block; padding:.25rem .6rem; border:1.5px solid #1d6b2b; color:#1d6b2b; border-radius:4px; font-weight:600; font-size:.8rem; letter-spacing:.04em; }
  @media print { body { margin:1rem; } button{display:none} }
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:start;gap:1rem;">
  <div>
    <h1>Radiantilyk Aesthetic</h1>
    <div class="muted">Pay stub</div>
  </div>
  ${payout ? `<div class="stamp">PAID</div>` : `<div class="stamp" style="border-color:#a00;color:#a00;">PENDING</div>`}
</div>
<hr/>
<table>
  <tr><td class="muted">Employee</td><td class="r">${row.member.full_name} — ${row.member.title}</td></tr>
  <tr><td class="muted">Pay period</td><td class="r">${format(periodStart, "EEE MMM d")} – ${format(periodEnd, "EEE MMM d, yyyy")}</td></tr>
  <tr><td class="muted">Pay date</td><td class="r">${paidAt}</td></tr>
  <tr><td class="muted">Method</td><td class="r" style="text-transform:capitalize;">${methodVal}</td></tr>
</table>
<hr/>
<table>
  <tr><td>Hours worked</td><td class="r">${row.hours.toFixed(2)} h × ${fmt(row.member.hourly_rate_cents)}/hr</td></tr>
  <tr><td>Hourly pay</td><td class="r">${fmt(row.hourly_pay_cents)}</td></tr>
  <tr><td>Service sales (base)</td><td class="r">${fmt(row.commission_base_cents)}</td></tr>
  <tr><td>Commission (${row.member.commission_percent}%)</td><td class="r">${fmt(row.commission_cents)}</td></tr>
  <tr><td>Tips</td><td class="r">${fmt(row.tips_cents)}</td></tr>
  ${adj ? `<tr><td>Adjustment${adjNoteVal ? ` — ${adjNoteVal}` : ""}</td><td class="r">${adj >= 0 ? "+" : ""}${fmt(adj)}</td></tr>` : ""}
  <tr class="grand"><td>Total paid</td><td class="r">${fmt(total)}</td></tr>
</table>
${payout?.payment_note ? `<hr/><div class="muted">Note</div><div>${payout.payment_note}</div>` : ""}
<hr/>
<div class="muted">Generated ${format(new Date(), "MMM d, yyyy h:mm a")}</div>
<div style="margin-top:1.5rem;"><button onclick="window.print()">Print</button></div>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Pop-up blocked"); return; }
    w.document.write(html);
    w.document.close();
  };

  if (!isAdmin) return <div className="p-8 text-sm text-muted-foreground">Admins only.</div>;

  const totalsAll = rows.reduce((acc, r) => {
    const p = payouts[r.member.id];
    acc.due += p ? p.total_cents : r.total_cents;
    acc.paid += p ? p.total_cents : 0;
    return acc;
  }, { due: 0, paid: 0 });

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-3xl">Payroll</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Weekly pay periods run Saturday → Friday. Payday is the following Saturday.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-4 flex items-center justify-between gap-3">
        <Button variant="ghost" size="icon" onClick={() => setPeriodStart(addDays(periodStart, -7))} className="rounded-full">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <div className="font-medium">
            {format(periodStart, "EEE MMM d")} – {format(periodEnd, "EEE MMM d, yyyy")}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Payday: {format(payDate, "EEEE, MMM d")} · Due {fmt(totalsAll.due)} · Paid {fmt(totalsAll.paid)}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setPeriodStart(addDays(periodStart, 7))} className="rounded-full">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground p-8 text-center">No active team members.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const p = payouts[row.member.id];
            const isPaid = !!p;
            const displayTotal = isPaid ? p.total_cents : row.total_cents;
            return (
              <div key={row.member.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.member.full_name}</span>
                      <span className="text-xs text-muted-foreground">· {row.member.title}</span>
                      {isPaid && (
                        <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-success-soft text-success-soft-foreground">
                          <CheckCircle2 className="h-3 w-3 mr-1" />Paid {format(new Date(p.paid_at), "MMM d")}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                      <div>
                        <div className="text-muted-foreground">Hours</div>
                        <div className="font-medium">{row.hours.toFixed(2)} h</div>
                        <div className="text-[10px] text-muted-foreground">{fmt(row.hourly_pay_cents)} @ {fmt(row.member.hourly_rate_cents)}/h</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Commission</div>
                        <div className="font-medium">{fmt(row.commission_cents)}</div>
                        <div className="text-[10px] text-muted-foreground">{row.member.commission_percent}% of {fmt(row.commission_base_cents)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Tips</div>
                        <div className="font-medium">{fmt(row.tips_cents)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">{isPaid ? "Paid" : "Due"}</div>
                        <div className="font-semibold text-base">{fmt(displayTotal)}</div>
                        {isPaid && p.adjustments_cents !== 0 && (
                          <div className="text-[10px] text-muted-foreground">incl. {p.adjustments_cents >= 0 ? "+" : ""}{fmt(p.adjustments_cents)} adj.</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-stretch sm:w-44">
                    {isPaid ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => printStub(row, p)} className="rounded-full">
                          <Printer className="h-3.5 w-3.5 mr-1.5" />Pay stub
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => unmarkPaid(row.member.id)} className="rounded-full text-muted-foreground">
                          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Undo
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => openPay(row)} className="rounded-full" disabled={row.member.hourly_rate_cents === 0 && row.member.commission_percent === 0 && row.tips_cents === 0}>
                          <DollarSign className="h-3.5 w-3.5 mr-1.5" />Mark paid
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => printStub(row)} className="rounded-full">
                          <Printer className="h-3.5 w-3.5 mr-1.5" />Preview
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pay {paying?.member.full_name}</DialogTitle>
            <DialogDescription>
              {format(periodStart, "MMM d")} – {format(periodEnd, "MMM d, yyyy")} · payday {format(payDate, "MMM d")}
            </DialogDescription>
          </DialogHeader>
          {paying && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Hourly ({paying.hours.toFixed(2)}h)</span><span>{fmt(paying.hourly_pay_cents)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Commission ({paying.member.commission_percent}%)</span><span>{fmt(paying.commission_cents)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tips</span><span>{fmt(paying.tips_cents)}</span></div>
                <div className="flex justify-between font-medium pt-1 border-t border-border/60"><span>Subtotal</span><span>{fmt(paying.total_cents)}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Adjustment / bonus (USD)</Label>
                  <Input type="number" step="0.01" value={adjustments} onChange={(e) => setAdjustments(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <Label className="text-xs">Method</Label>
                  <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="zelle">Zelle</option>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="venmo">Venmo</option>
                    <option value="ach">ACH / Direct deposit</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Adjustment note (optional)</Label>
                <Input value={adjNote} onChange={(e) => setAdjNote(e.target.value)} placeholder="e.g. holiday bonus" />
              </div>
              <div>
                <Label className="text-xs">Payment note (optional)</Label>
                <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="e.g. Zelle confirmation 1234" />
              </div>
              <div className="flex justify-between font-semibold text-base pt-2 border-t">
                <span>Total to pay</span><span>{fmt(finalTotal)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaying(null)} disabled={saving}>Cancel</Button>
            <Button onClick={confirmPay} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirm & record ${fmt(finalTotal)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

