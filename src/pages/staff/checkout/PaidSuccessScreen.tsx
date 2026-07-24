import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fmt, LineItem } from "./shared";

type Props = {
  sale: any;
  items: LineItem[];
  redirectSecs: number;
  backHref: string;
};

export function PaidSuccessScreen({ sale, items, redirectSecs, backHref }: Props) {
  const navigate = useNavigate();
  const [points, setPoints] = useState<{ earned: number; redeemed: number; balance: number; valueCents: number } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!sale?.id || !sale?.client_email) return;
      const [{ data: ledger }, { data: settings }, { data: bal }] = await Promise.all([
        supabase.from("client_points_ledger").select("delta, reason").eq("sale_id", sale.id),
        supabase.from("client_points_settings").select("point_value_cents").eq("id", true).maybeSingle(),
        supabase.rpc("get_points_balance", { _client_email: sale.client_email }),
      ]);
      if (!alive) return;
      const earned = (ledger ?? []).filter((r: any) => r.reason === "earned").reduce((s: number, r: any) => s + (r.delta ?? 0), 0);
      const redeemed = -(ledger ?? []).filter((r: any) => r.reason === "redeemed").reduce((s: number, r: any) => s + (r.delta ?? 0), 0);
      const valueCents = settings?.point_value_cents ?? 10;
      if (earned > 0 || redeemed > 0) {
        setPoints({ earned, redeemed, balance: (bal as number) ?? 0, valueCents });
      }
    })();
    return () => { alive = false; };
  }, [sale?.id, sale?.client_email]);

  const paymentLabelMap: Record<string, string> = {
    terminal: "Card · S710 Reader",
    card_on_file: "Card on file",
    manual_card: "Card (manual)",
    cash: "Cash",
    voucher_only: "Gift card / voucher",
  };
  const payLabel = paymentLabelMap[sale.payment_method ?? ""] ?? (sale.payment_method ?? "—");
  const paidWhen = sale.paid_at ? new Date(sale.paid_at).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }) : "";
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-3xl border border-success/30 bg-white shadow-sm overflow-hidden">
        <div className="bg-success-soft p-6 text-center border-b border-success/30">
          <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-success text-white flex items-center justify-center shadow-lg">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="font-serif text-2xl text-success-soft-foreground mb-1">Payment complete</h1>
          <div className="text-3xl font-mono tabular-nums text-success-soft-foreground">{fmt(sale.total_cents ?? 0)}</div>
          <p className="text-xs text-success-soft-foreground mt-2">{payLabel}{paidWhen ? ` · ${paidWhen}` : ""}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-sm">
            <div className="font-medium">{sale.client_first_name} {sale.client_last_name}</div>
            {sale.client_email && <div className="text-muted-foreground text-xs">{sale.client_email}</div>}
          </div>

          {items.length > 0 && (
            <div className="rounded-xl border bg-secondary/30 divide-y">
              {items.map((it, i) => (
                <div key={i} className="flex justify-between gap-3 px-3 py-2 text-sm">
                  <span className="truncate">{it.label}{it.quantity !== 1 ? ` × ${it.quantity}` : ""}</span>
                  <span className="font-mono tabular-nums">{fmt(it.line_total_cents ?? 0)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-sm space-y-1">
            {(sale.subtotal_cents ?? 0) > 0 && (
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono tabular-nums">{fmt(sale.subtotal_cents)}</span></div>
            )}
            {(sale.discount_cents ?? 0) > 0 && (
              <div className="flex justify-between text-muted-foreground"><span>Discount</span><span className="font-mono tabular-nums">−{fmt(sale.discount_cents)}</span></div>
            )}
            {(sale.voucher_applied_cents ?? 0) > 0 && (
              <div className="flex justify-between text-muted-foreground"><span>Gift card</span><span className="font-mono tabular-nums">−{fmt(sale.voucher_applied_cents)}</span></div>
            )}
            {(sale.tax_cents ?? 0) > 0 && (
              <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="font-mono tabular-nums">{fmt(sale.tax_cents)}</span></div>
            )}
            {(sale.tip_cents ?? 0) > 0 && (
              <div className="flex justify-between text-muted-foreground"><span>Tip</span><span className="font-mono tabular-nums">{fmt(sale.tip_cents)}</span></div>
            )}
            {(sale.processing_fee_cents ?? 0) > 0 && (
              <div className="flex justify-between text-muted-foreground"><span>Processing fee</span><span className="font-mono tabular-nums">{fmt(sale.processing_fee_cents)}</span></div>
            )}
            {points && points.redeemed > 0 && (
              <div className="flex justify-between text-muted-foreground"><span>Points redeemed ({points.redeemed} pts)</span><span className="font-mono tabular-nums">−{fmt(points.redeemed * points.valueCents)}</span></div>
            )}
            <div className="flex justify-between pt-2 mt-1 border-t font-semibold">
              <span>Total paid</span><span className="font-mono tabular-nums">{fmt(sale.total_cents ?? 0)}</span>
            </div>

          {points && (
            <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Rewards
              </div>
              {points.earned > 0 && (
                <div className="flex justify-between"><span>Points earned this visit</span><span className="font-mono tabular-nums">+{points.earned} pts</span></div>
              )}
              {points.redeemed > 0 && (
                <div className="flex justify-between"><span>Points redeemed</span><span className="font-mono tabular-nums">−{points.redeemed} pts ({fmt(points.redeemed * points.valueCents)})</span></div>
              )}
              <div className="flex justify-between border-t border-primary/20 pt-1 mt-1 font-medium">
                <span>New balance</span><span className="font-mono tabular-nums">{points.balance} pts · {fmt(points.balance * points.valueCents)}</span>
              </div>
            </div>
          )}
          </div>

          <div className={`rounded-xl border p-3 text-xs ${sale.client_email ? "border-success/30 bg-success-soft text-success-soft-foreground" : "border-warning/30 bg-warning-soft text-warning-soft-foreground"}`}>
            {sale.client_email
              ? <>✓ Email receipt sent to <span className="font-medium">{sale.client_email}</span></>
              : <>⚠ No client email on file — receipt was not emailed.</>}
          </div>

          <p className="text-xs text-muted-foreground text-center">Returning in {redirectSecs}s…</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button className="rounded-full" onClick={() => navigate(backHref)}>Done</Button>
            {sale.receipt_url && (
              <Button variant="outline" className="rounded-full" onClick={() => window.open(sale.receipt_url!, "_blank")}>View PDF</Button>
            )}
            <Button variant="outline" className="rounded-full" onClick={() => navigate("/staff/checkout")}>New sale</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
