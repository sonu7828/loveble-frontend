import { confirmDialog } from "@/components/ui/confirm";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";
import { toast } from "sonner";
import { ClockInOutButton } from "@/components/staff/ClockInOutButton";

type Entry = {
  id: string;
  staff_id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
  adjusted_by: string | null;
  adjusted_at: string | null;
};
type Staff = { id: string; full_name: string; hourly_rate_cents: number | null; commission_percent: number | null };
type SaleRow = { staff_id: string | null; tip_cents: number; paid_at: string | null };
type SaleItemRow = { line_total_cents: number; sale_id: string };

const RANGES = {
  week: () => ({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }), label: "This week" }),
  last7: () => ({ start: subDays(new Date(), 7), end: new Date(), label: "Last 7 days" }),
  month: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()), label: "This month" }),
  last30: () => ({ start: subDays(new Date(), 30), end: new Date(), label: "Last 30 days" }),
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(s: string) {
  if (!s) return null;
  return new Date(s).toISOString();
}
function hoursBetween(a: string, b: string | null) {
  if (!b) return null;
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}

export default function StaffTimeClock() {
  const { isAdmin, user, staffId: myStaffId, loading: authLoading, session } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<keyof typeof RANGES>("week");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Entry | null>(null);
  const [creating, setCreating] = useState(false);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [serviceItems, setServiceItems] = useState<Array<SaleItemRow & { sale_staff_id: string | null }>>([]);

  const r = RANGES[range]();

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!session) { setLoading(false); setError("You're signed out. Please sign in again."); return; }
    setLoading(true);
    setError(null);
    const rng = RANGES[range]();
    const startIso = rng.start.toISOString();
    const endIso = rng.end.toISOString();
    // Hard timeout so we never sit on a stuck spinner
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Request timed out. Check your connection and try again.")), 15000));
    try {
      const result = await Promise.race([
        Promise.all([
          supabase.from("staff_profiles").select("id, full_name").eq("is_active", true).order("full_name"),
          supabase.from("staff_time_entries").select("*")
            .gte("clock_in", startIso).lte("clock_in", endIso)
            .order("clock_in", { ascending: false }),
          supabase.from("sales").select("id, staff_id, tip_cents, paid_at, status")
            .eq("status", "paid").gte("paid_at", startIso).lte("paid_at", endIso),
        ]),
        timeout,
      ]);
      const [stRes, enRes, saRes] = result as any[];
      if (stRes.error) throw stRes.error;
      if (enRes.error) throw enRes.error;
      if (saRes.error) throw saRes.error;
      const salesRows = (saRes.data ?? []) as any[];
      const saleIds = salesRows.map(s => s.id);
      let items: any[] = [];
      if (saleIds.length) {
        const { data: it, error: itErr } = await supabase.from("sale_items")
          .select("sale_id, line_total_cents, kind")
          .in("sale_id", saleIds).eq("kind", "service");
        if (itErr) throw itErr;
        items = it ?? [];
      }
      const saleStaffMap = Object.fromEntries(salesRows.map(s => [s.id, s.staff_id]));
      // Pay config is RLS-restricted: admins get all rows, employees get only their own
      const { data: payRows } = await (supabase as any).from("staff_pay_config")
        .select("staff_id, hourly_rate_cents, commission_percent");
      const payMap: Record<string, { hourly_rate_cents: number | null; commission_percent: number | null }> = {};
      (payRows ?? []).forEach((p: any) => { payMap[p.staff_id] = p; });
      setSales(salesRows as SaleRow[]);
      setServiceItems(items.map(i => ({ ...i, sale_staff_id: saleStaffMap[i.sale_id] ?? null })));
      setStaff(((stRes.data ?? []) as any[]).map((s: any) => ({
        id: s.id,
        full_name: s.full_name,
        hourly_rate_cents: payMap[s.id]?.hourly_rate_cents ?? null,
        commission_percent: payMap[s.id]?.commission_percent ?? null,
      })) as Staff[]);
      setEntries((enRes.data ?? []) as Entry[]);
    } catch (e: any) {
      console.error("[StaffTimeClock] load failed", e);
      setError(e?.message ?? "Couldn't load time clock data.");
    } finally {
      setLoading(false);
    }
  }, [range, authLoading, session]);

  useEffect(() => { load(); }, [load]);

  const staffMap = useMemo(() => Object.fromEntries(staff.map(s => [s.id, s.full_name])), [staff]);
  const visible = useMemo(() => {
    let list = entries;
    if (!isAdmin && myStaffId) list = list.filter(e => e.staff_id === myStaffId);
    if (staffFilter !== "all") list = list.filter(e => e.staff_id === staffFilter);
    return list;
  }, [entries, isAdmin, myStaffId, staffFilter]);

  const totals = useMemo(() => {
    const by: Record<string, number> = {};
    visible.forEach(e => {
      const h = hoursBetween(e.clock_in, e.clock_out);
      if (h) by[e.staff_id] = (by[e.staff_id] ?? 0) + h;
    });
    return by;
  }, [visible]);

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  const remove = async (id: string) => {
    if (!(await confirmDialog({ title: "Delete this time entry?", destructive: true, confirmLabel: "Delete" }))) return;
    const { error } = await supabase.from("staff_time_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl mb-1">Time clock</h1>
          <p className="text-sm text-muted-foreground">Track hours worked. {isAdmin ? "Adjust any entry as needed." : "Your hours and adjustments."}</p>
        </div>
        <div className="w-56"><ClockInOutButton /></div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={range} onValueChange={(v) => setRange(v as keyof typeof RANGES)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map(k => (
              <SelectItem key={k} value={k}>{RANGES[k]().label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Filter staff" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All staff</SelectItem>
              {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setCreating(true)} className="ml-auto">
            <Plus className="h-3.5 w-3.5 mr-1.5" />Add entry
          </Button>
        )}
      </div>

      {loading ? (
        <div className="p-12 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm">
          <div className="font-medium text-destructive mb-1">Couldn't load time clock data</div>
          <div className="text-muted-foreground mb-3">{error}</div>
          <Button size="sm" variant="outline" onClick={() => load()}>Try again</Button>
        </div>
      ) : (
        <>
          {(isAdmin || myStaffId) && (
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {isAdmin ? "Payroll" : "My pay"} · {r.label}
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Staff</th>
                      <th className="text-right p-3">Hours</th>
                      <th className="text-right p-3">Rate</th>
                      <th className="text-right p-3">Hourly pay</th>
                      <th className="text-right p-3">Services + tips</th>
                      <th className="text-right p-3">Commission</th>
                      <th className="text-right p-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.filter(s => isAdmin ? (staffFilter === "all" || s.id === staffFilter) : s.id === myStaffId).map(s => {
                      const hrs = totals[s.id] ?? 0;
                      const rate = (s.hourly_rate_cents ?? 0) / 100;
                      const hourly = hrs * rate;
                      const serviceTotal = serviceItems.filter(i => i.sale_staff_id === s.id).reduce((a, i) => a + (i.line_total_cents ?? 0), 0);
                      const tipTotal = sales.filter(x => x.staff_id === s.id).reduce((a, x) => a + (x.tip_cents ?? 0), 0);
                      const commBase = (serviceTotal + tipTotal) / 100;
                      const commPct = Number(s.commission_percent ?? 0);
                      const commission = commBase * (commPct / 100);
                      const total = hourly + commission;
                      if (hrs === 0 && commBase === 0) return null;
                      return (
                        <tr key={s.id} className="border-t border-border">
                          <td className="p-3">{s.full_name}</td>
                          <td className="p-3 text-right tabular-nums">{hrs.toFixed(2)}</td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">{rate ? `$${rate.toFixed(2)}/hr` : "—"}</td>
                          <td className="p-3 text-right tabular-nums">${hourly.toFixed(2)}</td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">${commBase.toFixed(2)}</td>
                          <td className="p-3 text-right tabular-nums">{commPct ? `${commPct}% · $${commission.toFixed(2)}` : "—"}</td>
                          <td className="p-3 text-right tabular-nums font-medium">${total.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {isAdmin && <div className="text-[10px] text-muted-foreground mt-1.5">Set each member's hourly rate and commission % under <span className="font-medium">Team</span>.</div>}
            </div>
          )}

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Staff</th>
                  <th className="text-left p-3">Clock in</th>
                  <th className="text-left p-3">Clock out</th>
                  <th className="text-right p-3">Hours</th>
                  <th className="text-left p-3 hidden md:table-cell">Notes</th>
                  <th className="p-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground italic">No entries in this range.</td></tr>
                )}
                {visible.map(e => {
                  const h = hoursBetween(e.clock_in, e.clock_out);
                  return (
                    <tr key={e.id} className="border-t border-border">
                      <td className="p-3">{staffMap[e.staff_id] ?? "—"}</td>
                      <td className="p-3 tabular-nums">{format(new Date(e.clock_in), "MMM d, h:mm a")}</td>
                      <td className="p-3 tabular-nums">{e.clock_out ? format(new Date(e.clock_out), "MMM d, h:mm a") : <span className="text-success-soft-foreground">Active</span>}</td>
                      <td className="p-3 text-right tabular-nums">{h !== null ? h.toFixed(2) : "—"}</td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground">
                        {e.notes}
                        {e.adjusted_at && <div className="text-[10px] uppercase tracking-wider mt-0.5">Adjusted {format(new Date(e.adjusted_at), "MMM d")}</div>}
                      </td>
                      <td className="p-3">
                        {isAdmin && (
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <EntryDialog
        open={!!editing || creating}
        entry={editing}
        staff={staff}
        defaultStaffId={myStaffId ?? undefined}
        actorId={user?.id ?? null}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={() => { setEditing(null); setCreating(false); load(); }}
      />
    </div>
  );
}

function EntryDialog({
  open, entry, staff, defaultStaffId, actorId, onClose, onSaved,
}: {
  open: boolean;
  entry: Entry | null;
  staff: Staff[];
  defaultStaffId?: string;
  actorId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [staffId, setStaffId] = useState("");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStaffId(entry?.staff_id ?? defaultStaffId ?? "");
    setClockIn(entry ? toLocalInput(entry.clock_in) : toLocalInput(new Date().toISOString()));
    setClockOut(entry?.clock_out ? toLocalInput(entry.clock_out) : "");
    setNotes(entry?.notes ?? "");
  }, [open, entry, defaultStaffId]);

  const save = async () => {
    if (!staffId || !clockIn) return toast.error("Staff and clock-in time required");
    setSaving(true);
    const payload: any = {
      staff_id: staffId,
      clock_in: fromLocalInput(clockIn),
      clock_out: clockOut ? fromLocalInput(clockOut) : null,
      notes: notes || null,
      adjusted_by: actorId,
      adjusted_at: new Date().toISOString(),
    };
    const { error } = entry
      ? await supabase.from("staff_time_entries").update(payload).eq("id", entry.id)
      : await supabase.from("staff_time_entries").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{entry ? "Adjust time entry" : "Add time entry"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Staff</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>
                {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Clock in</Label>
              <Input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Clock out</Label>
              <Input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for adjustment, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
