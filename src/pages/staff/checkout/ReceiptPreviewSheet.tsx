import { useState } from "react";
import { Eye, Printer } from "lucide-react";
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

/**
 * Pre-payment receipt preview so staff (and the client) can verify line items,
 * tip, discounts and totals before charging.
 */
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

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full mt-3 rounded-full"
        onClick={() => setOpen(true)}
        disabled={items.length === 0}
      >
        <Eye className="h-4 w-4 mr-1.5" /> Preview receipt
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Receipt preview</SheetTitle>
          </SheetHeader>

          <div className="mt-4 rounded-xl border border-border bg-card p-5 print:border-0 print:shadow-none">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <img src={rkaLogo} alt="" className="h-10 w-10 rounded-full object-cover" />
              <div>
                <div className="font-serif text-base leading-tight">Radiantilyk Aesthetic</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">San Jose, CA</div>
              </div>
            </div>

            {(clientName || clientEmail) && (
              <div className="text-xs text-muted-foreground mt-3">
                {clientName && <div className="text-foreground">{clientName}</div>}
                {clientEmail && <div>{clientEmail}</div>}
              </div>
            )}

            <ul className="mt-3 space-y-1.5 text-sm">
              {items.map((it, idx) => (
                <li key={idx} className="flex justify-between gap-3">
                  <span className="flex-1 truncate">
                    {it.label}
                    <span className="text-muted-foreground"> × {it.quantity}</span>
                  </span>
                  <span className="tabular-nums">{fmt(it.line_total_cents)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-3 pt-3 border-t border-border space-y-1 text-sm">
              <Row label="Subtotal" v={totals.subtotal_cents} />
              {totals.discount_cents > 0 && <Row label="Discount" v={-totals.discount_cents} muted />}
              {totals.tip_cents > 0 && <Row label="Tip" v={totals.tip_cents} muted />}
              {totals.processing_fee_cents > 0 && <Row label="Processing fee" v={totals.processing_fee_cents} muted />}
              {totals.voucher_applied_cents > 0 && <Row label="Voucher" v={-totals.voucher_applied_cents} muted />}
              {creditCents > 0 && <Row label="Account credit" v={-creditCents} muted />}
              {claimedServiceCreditCents > 0 && <Row label="Service credit" v={-claimedServiceCreditCents} muted />}
              <div className="flex justify-between text-base font-medium pt-2 border-t border-border mt-1">
                <span>Amount due</span>
                <span className="tabular-nums">{fmt(netDueCents)}</span>
              </div>
            </dl>

            <p className="mt-4 text-[10px] uppercase tracking-wider text-muted-foreground text-center">
              ALL SALES FINAL · NO REFUNDS FOR RENDERED SERVICES
            </p>
            <p className="mt-1 text-[10px] text-center text-muted-foreground">
              Preview only — final receipt is emailed after payment.
            </p>
          </div>

          <Button variant="outline" className="w-full mt-4 print:hidden" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> Print preview
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Row({ label, v, muted }: { label: string; v: number; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{fmt(v)}</span>
    </div>
  );
}
