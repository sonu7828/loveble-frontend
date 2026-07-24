import { Link } from "react-router-dom";
import { CheckCircle2, CreditCard, Smartphone, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmt } from "./shared";

type Props = {
  readers: any[];
  readerId: string;
  setReaderId: (id: string) => void;
  netDueCents: number;
  creditCents: number;
  voucherAppliedCents: number;
  claimedServiceCreditCents: number;
  walkInCardOnFile: { brand: string | null; last4: string | null } | null;
  sale: any;
  working: boolean;
  finalize: (m: "terminal" | "card_on_file" | "manual_card_intent" | "cash" | "credit_only" | "affirm") => void;
};

export function PaymentActionsPanel(p: Props) {
  const fullyCoveredNoCredit = p.netDueCents === 0
    && (p.voucherAppliedCents > 0 || p.claimedServiceCreditCents > 0)
    && p.creditCents === 0;

  return (
    <>
      <div className="mt-5 space-y-2">
        {fullyCoveredNoCredit && (
          <div className="rounded-lg border border-success/30 bg-success-soft p-3 mb-1">
            <p className="text-sm font-medium text-success-soft-foreground">
              {p.claimedServiceCreditCents > 0
                ? `Service credit covers this sale — ${fmt(p.claimedServiceCreditCents)} will be deducted from the client's bank.`
                : "Nothing left to charge — credits & vouchers cover this sale."}
            </p>
            <Button
              variant="default"
              className="w-full mt-2 bg-success hover:bg-success"
              disabled={p.working}
              onClick={() => p.finalize(p.claimedServiceCreditCents > 0 ? "credit_only" : "cash")}
            >
              <Wallet className="h-4 w-4 mr-2" />
              {p.working
                ? "Completing…"
                : p.claimedServiceCreditCents > 0
                  ? `Charge to credit · −${fmt(p.claimedServiceCreditCents)}`
                  : "Complete sale · $0.00 due"}
            </Button>
          </div>
        )}
        {p.readers.length > 0 && p.netDueCents > 0 && (
          <Select value={p.readerId} onValueChange={p.setReaderId}>
            <SelectTrigger><SelectValue placeholder="Pick a reader" /></SelectTrigger>
            <SelectContent>{p.readers.map((r) => <SelectItem key={r.id} value={r.id}>{r.label} · {r.status}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {p.creditCents > 0 && p.netDueCents === 0 && (
          <Button className="w-full" disabled={p.working} onClick={() => p.finalize("credit_only")}>
            <Wallet className="h-4 w-4 mr-2" /> Pay with account credit ({fmt(p.creditCents)})
          </Button>
        )}
        {p.netDueCents > 0 && (
          <>
            <Button className="w-full" disabled={p.working || !p.readerId} onClick={() => p.finalize("terminal")}>
              <Smartphone className="h-4 w-4 mr-2" /> Send to S710 reader
            </Button>
            {(p.sale.appointment_id || p.walkInCardOnFile) && (
              <Button variant="outline" className="w-full" disabled={p.working} onClick={() => p.finalize("card_on_file")}>
                <CreditCard className="h-4 w-4 mr-2" />
                Charge card on file
                {p.walkInCardOnFile && !p.sale.appointment_id && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    · {p.walkInCardOnFile.brand ?? "Card"} ••{p.walkInCardOnFile.last4 ?? ""}
                  </span>
                )}
              </Button>
            )}
            <Button variant="outline" className="w-full" disabled={p.working} onClick={() => p.finalize("manual_card_intent")}>
              <CreditCard className="h-4 w-4 mr-2" /> Manual card entry
            </Button>
            <Button variant="outline" className="w-full" disabled={p.working} onClick={() => p.finalize("cash")}>
              <Wallet className="h-4 w-4 mr-2" /> Cash
            </Button>
            <Button
              variant="outline"
              className="w-full border-info/30 text-info-soft-foreground hover:bg-info-soft hover:text-info-soft-foreground"
              disabled={p.working || p.netDueCents < 5000}
              onClick={() => p.finalize("affirm")}
              title={p.netDueCents < 5000 ? "Affirm requires a minimum of $50" : "Pay over time with Affirm"}
            >
              <Sparkles className="h-4 w-4 mr-2" /> Pay with Affirm
            </Button>
          </>
        )}
      </div>

      {p.readers.length === 0 && <p className="text-xs text-muted-foreground mt-3">No reader paired for this location. <Link to="/staff/terminal" className="underline">Set one up →</Link></p>}
    </>
  );
}
