import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Loader2, AlertTriangle, CreditCard, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { confirmDialog } from "@/components/ui/confirm";
import { functionErrorMessage } from "@/lib/functionError";

type Row = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  client_first_name: string | null;
  client_last_name: string | null;
  client_email: string;
  client_phone: string | null;
  stripe_payment_method_id: string | null;
  no_show_charge_id: string | null;
  no_show_charged_at: string | null;
  checked_in_at: string | null;
  staff_id: string | null;
  service_id: string | null;
};

const NO_SHOW_AMOUNT_CENTS = 20000;

export default function AdminNoShowCharges() {
  const { isAdmin, isScheduler, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    // Past appointments, status=no_show OR (approved/pending but end_at < now-1h), no charge yet.
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("appointments")
      .select("id, start_at, end_at, status, client_first_name, client_last_name, client_email, client_phone, stripe_payment_method_id, no_show_charge_id, no_show_charged_at, checked_in_at, staff_id, service_id")
      .is("no_show_charge_id", null)
      .is("checked_in_at", null)
      .lt("end_at", cutoff)
      .in("status", ["no_show", "approved", "pending"])
      .order("end_at", { ascending: false })
      .limit(100);
    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as Row[]);
    }
    setBusy(false);
  };

  useEffect(() => {
    if (loading) return;
    if (!isAdmin && !isScheduler) { setBusy(false); return; }
    load();
  }, [loading, isAdmin, isScheduler]);

  if (loading) return <div className="p-8"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (!isAdmin && !isScheduler) return <Navigate to="/staff/today" replace />;

  const charge = async (r: Row) => {
    setWorking(r.id);
    try {
      const { data, error } = await supabase.functions.invoke("payments-charge-no-show", {
        body: { appointmentId: r.id, amountCents: NO_SHOW_AMOUNT_CENTS },
      });
      if ((data as any)?.error) throw new Error((data as any).error);
      if (error) throw new Error(await functionErrorMessage(error, "Charge failed"));
      toast({ title: "Charged $200", description: "Card on file was charged successfully." });
      await load();
    } catch (e: any) {
      toast({ title: "Charge failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  const markNoCharge = async (r: Row, newStatus: "no_show" | "cancelled") => {
    const ok = await confirmDialog({
      title: newStatus === "no_show" ? "Mark no-show without charging?" : "Mark as cancelled?",
      description: "This removes the appointment from the charge queue.",
      confirmLabel: "Confirm",
    });
    if (!ok) return;
    setWorking(r.id);
    const { error } = await supabase
      .from("appointments")
      .update({ status: newStatus, no_show_charged_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Updated" }); await load(); }
    setWorking(null);
  };

  const totalPending = rows.length;
  const chargeable = rows.filter(r => r.stripe_payment_method_id).length;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <header className="mb-5">
        <h1 className="text-2xl font-serif flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-warning-soft-foreground" />
          No-show & late-cancel charges
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review past appointments before charging the $200 fee to the card on file.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Pending review</div>
          <div className="text-2xl font-semibold mt-1">{totalPending}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Card on file</div>
          <div className="text-2xl font-semibold mt-1">{chargeable}</div>
        </div>
      </div>

      {busy ? (
        <div className="p-8 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-success-soft-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nothing to review. All past appointments are reconciled.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const name = `${r.client_first_name ?? ""} ${r.client_last_name ?? ""}`.trim() || r.client_email;
            const hasCard = !!r.stripe_payment_method_id;
            const isNoShow = r.status === "no_show";
            return (
              <div key={r.id} className={`rounded-lg border bg-card p-4 ${isNoShow ? "border-destructive/40" : "border-border"}`}>
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{name}</span>
                      {isNoShow && <span className="text-[10px] uppercase tracking-wider bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">No-show</span>}
                      {!hasCard && <span className="text-[10px] uppercase tracking-wider bg-warning-soft text-warning-soft-foreground px-1.5 py-0.5 rounded">No card on file</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(r.start_at), "EEE MMM d, h:mm a")} · {formatDistanceToNow(new Date(r.end_at), { addSuffix: true })}
                      {r.client_phone && <> · {r.client_phone}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={working === r.id}
                      onClick={() => markNoCharge(r, "no_show")}
                    >
                      No-show (don't charge)
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={working === r.id}
                      onClick={() => markNoCharge(r, "cancelled")}
                    >
                      Mark cancelled
                    </Button>
                    <Button
                      size="sm"
                      disabled={!hasCard || working === r.id}
                      onClick={() => charge(r)}
                    >
                      {working === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5 mr-1" />}
                      Charge $200
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

