import { fmt } from "./shared";

type Totals = {
  subtotal_cents: number;
  discount_cents: number;
  tip_cents: number;
  processing_fee_cents: number;
  voucher_applied_cents: number;
  total_cents: number;
  amount_due_cents: number;
};

type Props = {
  totals: Totals;
  creditCents: number;
  claimedServiceCreditCents: number;
  netDueCents: number;
};

export function TotalsPanel({ totals, creditCents, claimedServiceCreditCents, netDueCents }: Props) {
  return (
    <>
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Totals</h2>
      <dl className="space-y-1.5 text-sm">
        <Row label="Subtotal" v={totals.subtotal_cents} />
        {totals.discount_cents > 0 && <Row label="Discount" v={-totals.discount_cents} muted />}
        {totals.tip_cents > 0 && <Row label="Tip" v={totals.tip_cents} muted />}
        {totals.processing_fee_cents > 0 && <Row label="Processing fee" v={totals.processing_fee_cents} muted />}
        {totals.voucher_applied_cents > 0 && <Row label="Voucher" v={-totals.voucher_applied_cents} muted />}
        {creditCents > 0 && <Row label="Account credit" v={-creditCents} muted />}
        {claimedServiceCreditCents > 0 && <Row label="Service credit" v={-claimedServiceCreditCents} muted />}
        <div className="border-t border-border pt-2 mt-2 flex justify-between text-base font-medium">
          <span>Amount due</span><span className="tabular-nums">{fmt(netDueCents)}</span>
        </div>
      </dl>
    </>
  );
}

function Row({ label, v, muted }: { label: string; v: number; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span><span className="tabular-nums">{fmt(v)}</span>
    </div>
  );
}
