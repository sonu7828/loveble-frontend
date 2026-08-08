import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Printer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiQuery, ApiClient } from "@/services/api";
import { fmt, LineItem } from "./shared";

type SaleRecord = {
  id?: string;
  client_email?: string;
  payment_method?: string;
  paid_at?: string;
  total_cents?: number;
  client_first_name?: string;
  client_last_name?: string;
  subtotal_cents?: number;
  discount_cents?: number;
  voucher_applied_cents?: number;
  tax_cents?: number;
  tip_cents?: number;
  processing_fee_cents?: number;
  receipt_url?: string;
  [key: string]: unknown;
};

type Props = {
  sale: SaleRecord;
  items: LineItem[];
  redirectSecs: number;
  backHref: string;
};

export function PaidSuccessScreen({ sale, items, backHref }: Props) {
  const navigate = useNavigate();
  const [points, setPoints] = useState<{ earned: number; redeemed: number; balance: number; valueCents: number } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!sale?.id || !sale?.client_email) return;
      const [{ data: ledger }, { data: settings }, pointsBalRes] = await Promise.all([
        apiQuery("client_points_ledger").select("delta, reason").eq("sale_id", String(sale.id)),
        apiQuery("client_points_settings").select("point_value_cents").eq("id", true).maybeSingle(),
        apiQuery.functions.invoke("get_points_balance", { body: { _client_email: String(sale.client_email) } }),
      ]);
      if (!alive) return;
      const ledgerRows = (ledger ?? []) as Record<string, unknown>[];
      const earned = ledgerRows.filter((r) => r.reason === "earned").reduce((s: number, r) => s + (Number(r.delta) || 0), 0);
      const redeemed = -ledgerRows.filter((r) => r.reason === "redeemed").reduce((s: number, r) => s + (Number(r.delta) || 0), 0);
      const valueCents = settings?.point_value_cents ?? 10;
      const bal = (pointsBalRes?.data as number) ?? 0;
      if (earned > 0 || redeemed > 0) {
        setPoints({ earned, redeemed, balance: bal, valueCents });
      }
    })();
    return () => { alive = false; };
  }, [sale?.id, sale?.client_email]);

  const paymentLabelMap: Record<string, string> = {
    terminal: "Card · Reader",
    card_on_file: "Card on file",
    manual_card: "Credit / Debit Card",
    cash: "Cash",
    voucher_only: "Gift card / voucher",
  };
  const payLabel = paymentLabelMap[sale.payment_method ?? ""] ?? (sale.payment_method ?? "Cash");
  const paidWhen = sale.paid_at ? new Date(sale.paid_at).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }) : "";

  const handleDownloadBill = () => {
    const printWindow = window.open("", "_blank", "width=850,height=950");
    if (!printWindow) {
      window.print();
      return;
    }
    const clientFullName = `${sale.client_first_name || ""} ${sale.client_last_name || ""}`.trim() || "Valued Client";
    const todayStr = sale.paid_at
      ? new Date(sale.paid_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
      : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    const invoiceNum = `INV-${sale.id || Math.floor(100000 + Math.random() * 900000)}`;

    const itemsRowsHtml = items.map((it) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #111827; font-weight: 500;">${it.label}</td>
        <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: center; color: #4b5563;">${it.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; color: #4b5563;">${fmt(it.unit_price_cents)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; font-weight: 600; color: #111827;">${fmt(it.line_total_cents)}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Medical Invoice - ${invoiceNum}</title>
          <style>
            body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; color: #1f2937; margin: 0; padding: 40px 20px; background: #fff; }
            .invoice-card { max-width: 680px; margin: 0 auto; padding: 36px; border: 1px solid #e5e7eb; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
            .brand-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 2px solid #f3f4f6; }
            .brand-title { font-size: 24px; font-weight: 700; color: #111827; letter-spacing: -0.02em; }
            .brand-sub { font-size: 12px; color: #6b7280; margin-top: 3px; }
            .inv-badge { background: #d1fae5; color: #065f46; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
            .info-box { background: #f9fafb; padding: 16px; border-radius: 12px; border: 1px solid #f3f4f6; }
            .info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.05em; margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { background: #f9fafb; padding: 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #6b7280; border-bottom: 2px solid #e5e7eb; text-align: left; letter-spacing: 0.05em; }
            .summary-container { width: 280px; margin-left: auto; margin-top: 24px; }
            .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #4b5563; }
            .summary-total { display: flex; justify-content: space-between; padding: 12px 0; font-size: 17px; font-weight: 700; color: #111827; border-top: 2px solid #111827; margin-top: 8px; }
            .footer-note { margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; }
          </style>
        </head>
        <body>
          <div class="invoice-card">
            <div class="brand-header">
              <div>
                <div class="brand-title">Radiantilyk Aesthetic Medspa</div>
                <div class="brand-sub">San Jose, CA · Tel: (408) 555-0199 · Tax ID: 94-3829101</div>
              </div>
              <div style="text-align: right;">
                <span class="inv-badge">PAID IN FULL ✓</span>
                <div style="font-size: 15px; font-weight: 700; margin-top: 8px; color: #111827;">${invoiceNum}</div>
                <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${todayStr}</div>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-box">
                <div class="info-label">Billed Patient</div>
                <div style="font-weight: 700; font-size: 14px; color: #111827;">${clientFullName}</div>
                <div style="color: #6b7280; font-size: 12px;">${sale.client_email || "N/A"}</div>
              </div>
              <div class="info-box">
                <div class="info-label">Payment Method</div>
                <div style="font-weight: 700; font-size: 14px; color: #111827;">${payLabel}</div>
                <div style="color: #6b7280; font-size: 12px;">Processed & Settled</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Description / Service</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Unit Price</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRowsHtml}
              </tbody>
            </table>

            <div class="summary-container">
              <div class="summary-row">
                <span>Subtotal</span>
                <span>${fmt(sale.subtotal_cents ?? 0)}</span>
              </div>
              ${(sale.discount_cents ?? 0) > 0 ? `<div class="summary-row" style="color: #dc2626;"><span>Discount</span><span>−${fmt(sale.discount_cents)}</span></div>` : ""}
              ${(sale.tip_cents ?? 0) > 0 ? `<div class="summary-row"><span>Tip</span><span>${fmt(sale.tip_cents)}</span></div>` : ""}
              ${(sale.processing_fee_cents ?? 0) > 0 ? `<div class="summary-row"><span>Processing Fee</span><span>${fmt(sale.processing_fee_cents)}</span></div>` : ""}
              <div class="summary-total">
                <span>Total Paid</span>
                <span>${fmt(sale.total_cents ?? 0)}</span>
              </div>
            </div>

            <div class="footer-note">
              <div style="font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 4px;">Thank you for choosing Radiantilyk Aesthetic Medspa!</div>
              <div style="font-size: 11px; color: #9ca3af;">All sales final · No refunds for rendered services · Official Medical Receipt Statement</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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
            <div className="font-medium text-foreground">{sale.client_first_name} {sale.client_last_name}</div>
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

          <div className="flex gap-2 justify-center flex-wrap pt-2">
            <Button className="rounded-full cursor-pointer px-6" onClick={() => navigate(backHref)}>Done</Button>
            <Button variant="outline" className="rounded-full cursor-pointer gap-1.5" onClick={handleDownloadBill}>
              <Printer className="h-3.5 w-3.5 text-primary" /> Download / Print Bill
            </Button>

          </div>
        </div>
      </div>
    </div>
  );
}
