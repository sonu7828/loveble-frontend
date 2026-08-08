import { CreditCard, Wallet, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="mt-5 space-y-2.5">
      {fullyCoveredNoCredit && (
        <div className="rounded-lg border border-success/30 bg-success-soft p-3 mb-1">
          <p className="text-xs font-medium text-success-soft-foreground">
            {p.claimedServiceCreditCents > 0
              ? `Service credit covers this sale — ${fmt(p.claimedServiceCreditCents)} will be deducted.`
              : "Nothing left to charge — covered by credits."}
          </p>
          <Button
            variant="default"
            className="w-full mt-2 bg-success hover:bg-success text-xs h-10"
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

      {p.creditCents > 0 && p.netDueCents === 0 && (
        <Button className="w-full text-xs h-10" disabled={p.working} onClick={() => p.finalize("credit_only")}>
          <Wallet className="h-4 w-4 mr-2" /> Pay with account credit ({fmt(p.creditCents)})
        </Button>
      )}

      {p.netDueCents > 0 && (
        <>
          <Button
            variant="default"
            className="w-full h-11 text-xs font-medium cursor-pointer"
            disabled={p.working}
            onClick={() => p.finalize("manual_card_intent")}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Credit / Debit Card
          </Button>

          {(p.sale?.appointment_id || p.walkInCardOnFile) && (
            <Button
              variant="outline"
              className="w-full h-10 text-xs font-medium cursor-pointer"
              disabled={p.working}
              onClick={() => p.finalize("card_on_file")}
            >
              <CreditCard className="h-4 w-4 mr-2 text-primary" />
              Charge card on file
              {p.walkInCardOnFile && !p.sale?.appointment_id && (
                <span className="ml-1 text-xs text-muted-foreground">
                  · {p.walkInCardOnFile.brand ?? "Card"} ••{p.walkInCardOnFile.last4 ?? ""}
                </span>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full h-10 text-xs font-medium cursor-pointer"
            disabled={p.working}
            onClick={() => p.finalize("cash")}
          >
            <Banknote className="h-4 w-4 mr-2 text-emerald-600" />
            Cash
          </Button>
        </>
      )}
    </div>
  );
}
