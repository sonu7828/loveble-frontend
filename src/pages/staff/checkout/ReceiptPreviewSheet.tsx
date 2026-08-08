import { useState } from "react";
import { Eye, Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmt, LineItem } from "./shared";
import rkaLogo from "@/assets/rka-logo.webp";

type Totals = {
  subtotal_cents: number;
  discount_cents: number;
  tip_cents: number;
  processing_fee_cents: number;
  voucher_applied_cents: number;
  total_cents: number;
  amount_due_cents: number;
};

export function ReceiptPreviewSheet({
  items,
  totals,
  netDueCents,
  creditCents,
  claimedServiceCreditCents,
  clientName,
  clientEmail,
}: {
  items: LineItem[];
  totals: Totals;
  netDueCents: number;
  creditCents: number;
  claimedServiceCreditCents: number;
  clientName?: string | null;
  clientEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=850,height=950");
    if (!printWindow) {
      window.print();
      return;
    }
    const todayStr = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const invoiceNum = `INV-${Math.floor(100000 + Math.random() * 900000)}`;

    const itemsRowsHtml = items
      .map(
        (it) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #111827; font-weight: 500;">${it.label}</td>
        <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: center; color: #4b5563;">${it.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; color: #4b5563;">${fmt(it.unit_price_cents)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; text-align: right; font-weight: 600; color: #111827;">${fmt(it.line_total_cents)}</td>
      </tr>
    `
      )
      .join("");

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
            .inv-badge { background: #e0e7ff; color: #3730a3; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; }
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
                <span class="inv-badge">OFFICIAL INVOICE</span>
                <div style="font-size: 15px; font-weight: 700; margin-top: 8px; color: #111827;">${invoiceNum}</div>
                <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${todayStr}</div>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-box">
                <div class="info-label">Billed Patient</div>
                <div style="font-weight: 700; font-size: 14px; color: #111827;">${clientName || "Valued Client"}</div>
                <div style="color: #6b7280; font-size: 12px;">${clientEmail || "N/A"}</div>
              </div>
              <div class="info-box">
                <div class="info-label">Payment Status</div>
                <div style="font-weight: 700; font-size: 14px; color: #059669;">${netDueCents === 0 ? "PAID IN FULL ✓" : "PAYMENT DUE"}</div>
                <div style="color: #6b7280; font-size: 12px;">Location: Main Medical Facility</div>
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
                <span>${fmt(totals.subtotal_cents)}</span>
              </div>
              ${totals.discount_cents > 0 ? `<div class="summary-row" style="color: #dc2626;"><span>Discount</span><span>−${fmt(totals.discount_cents)}</span></div>` : ""}
              ${totals.tip_cents > 0 ? `<div class="summary-row"><span>Tip</span><span>${fmt(totals.tip_cents)}</span></div>` : ""}
              ${totals.processing_fee_cents > 0 ? `<div class="summary-row"><span>Processing Fee</span><span>${fmt(totals.processing_fee_cents)}</span></div>` : ""}
              <div class="summary-total">
                <span>Total Due</span>
                <span>${fmt(netDueCents)}</span>
              </div>
            </div>

            <div class="footer-note">
              <div style="font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 4px;">Thank you for choosing Radiantilyk Aesthetic Medspa!</div>
              <div style="font-size: 11px; color: #9ca3af;">All sales final · No refunds for rendered services · Official Medical Billing Statement</div>
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
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full mt-3 rounded-full cursor-pointer"
        onClick={() => setOpen(true)}
        disabled={items.length === 0}
      >
        <Eye className="h-4 w-4 mr-1.5" /> Preview & Print Receipt
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto p-6">
          <SheetHeader>
            <SheetTitle className="font-serif text-xl flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Official Medical Receipt Preview
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <img src={rkaLogo} alt="" className="h-10 w-10 rounded-full object-cover" />
                <div>
                  <div className="font-serif text-base font-semibold leading-tight">Radiantilyk Aesthetic</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">San Jose, CA</div>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                Official Bill
              </span>
            </div>

            {(clientName || clientEmail) && (
              <div className="bg-muted/40 p-3 rounded-xl border border-border/50 text-xs">
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Billed Patient</div>
                {clientName && <div className="text-sm font-semibold text-foreground">{clientName}</div>}
                {clientEmail && <div className="text-muted-foreground">{clientEmail}</div>}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Itemized Breakdown</div>
              <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/60 text-xs">
                {items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-background/50">
                    <div>
                      <div className="font-medium text-foreground">{it.label}</div>
                      <div className="text-[11px] text-muted-foreground">{it.quantity} × {fmt(it.unit_price_cents)}</div>
                    </div>
                    <div className="font-semibold tabular-nums text-foreground">{fmt(it.line_total_cents)}</div>
                  </div>
                ))}
              </div>
            </div>

            <dl className="pt-3 border-t border-border space-y-1.5 text-xs">
              <Row label="Subtotal" v={totals.subtotal_cents} />
              {totals.discount_cents > 0 && <Row label="Discount" v={-totals.discount_cents} muted />}
              {totals.tip_cents > 0 && <Row label="Tip" v={totals.tip_cents} muted />}
              {totals.processing_fee_cents > 0 && <Row label="Processing fee" v={totals.processing_fee_cents} muted />}
              {totals.voucher_applied_cents > 0 && <Row label="Voucher" v={-totals.voucher_applied_cents} muted />}
              {creditCents > 0 && <Row label="Account credit" v={-creditCents} muted />}
              {claimedServiceCreditCents > 0 && <Row label="Service credit" v={-claimedServiceCreditCents} muted />}
              <div className="flex justify-between text-base font-bold pt-2.5 border-t border-border mt-2 text-foreground">
                <span>Total Amount Due</span>
                <span className="tabular-nums">{fmt(netDueCents)}</span>
              </div>
            </dl>

            <div className="text-[10px] text-center text-muted-foreground pt-2 border-t border-border/60">
              ALL SALES FINAL · NO REFUNDS FOR RENDERED SERVICES
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="default" className="w-full gap-2 rounded-xl cursor-pointer" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Print Systematic Invoice
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Row({ label, v, muted }: { label: string; v: number; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums font-medium">{fmt(v)}</span>
    </div>
  );
}
