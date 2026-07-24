import { useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { functionErrorMessage } from "@/lib/functionError";

const PUBLISHABLE = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
let _p: Promise<Stripe | null> | null = null;
const getStripe = () => (PUBLISHABLE ? (_p ??= loadStripe(PUBLISHABLE)) : null);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appointmentId: string;
  clientName: string;
  hasCardOnFile: boolean;
  onCharged: () => void;
  onSkipCharge?: () => void;
}

export function ChargeNoShowDialog({ open, onOpenChange, appointmentId, clientName, hasCardOnFile, onCharged, onSkipCharge }: Props) {
  const [amount, setAmount] = useState("200");
  const [mode, setMode] = useState<"on_file" | "manual">(hasCardOnFile ? "on_file" : "manual");
  const stripeP = getStripe();
  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const amountValid = Number.isFinite(amountCents) && amountCents >= 100 && amountCents <= 100000; // $1–$1,000
  const amountError = !amount
    ? null
    : !amountValid
      ? (amountCents < 100 ? "Minimum charge is $1.00" : amountCents > 100000 ? "Maximum charge is $1,000.00" : "Enter a valid amount")
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>No-show options</DialogTitle>
          <DialogDescription>For {clientName}. Choose to charge a fee or mark as no-show without charging.</DialogDescription>
        </DialogHeader>
        {onSkipCharge && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Skip the fee (e.g., first-time grace, verified emergency).
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full shrink-0"
              onClick={() => { onSkipCharge(); onOpenChange(false); }}
            >
              Mark no-show · no charge
            </Button>
          </div>
        )}
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Amount (USD)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              aria-invalid={!!amountError}
              className="mt-1"
            />
            {amountError && <p className="mt-1 text-xs text-destructive">{amountError}</p>}
          </div>
          {hasCardOnFile && (
            <div className="flex gap-2 text-xs">
              <button onClick={() => setMode("on_file")}
                className={`flex-1 rounded-lg px-3 py-2 border ${mode === "on_file" ? "border-primary bg-primary/5" : "border-border"}`}>
                Card on file
              </button>
              <button onClick={() => setMode("manual")}
                className={`flex-1 rounded-lg px-3 py-2 border ${mode === "manual" ? "border-primary bg-primary/5" : "border-border"}`}>
                Enter card manually
              </button>
            </div>
          )}
          {mode === "manual" && !stripeP && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" /> Card collection not configured.
            </p>
          )}
          {mode === "manual" && stripeP && (
            <Elements stripe={stripeP}>
              <ManualCardForm appointmentId={appointmentId} amount={amount} amountValid={amountValid} onCharged={() => { onCharged(); onOpenChange(false); }} onCancel={() => onOpenChange(false)} />
            </Elements>
          )}
          {mode === "on_file" && (
            <ChargeOnFile appointmentId={appointmentId} amount={amount} amountValid={amountValid} onCharged={() => { onCharged(); onOpenChange(false); }} onCancel={() => onOpenChange(false)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChargeOnFile({ appointmentId, amount, amountValid, onCharged, onCancel }: { appointmentId: string; amount: string; amountValid: boolean; onCharged: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const charge = async () => {
    if (!amountValid) { toast.error("Enter an amount between $1 and $1,000"); return; }
    setBusy(true);
    const cents = Math.round(parseFloat(amount) * 100);
    const { data, error } = await supabase.functions.invoke("payments-charge-no-show", {
      body: { appointmentId, amountCents: cents },
    });
    setBusy(false);
    if (error || data?.error) {
      const msg = data?.error || (error ? await functionErrorMessage(error, "Charge failed") : "Charge failed");
      toast.error(msg);
      return;
    }
    toast.success(`$${amount} charged`); onCharged();
  };
  return (
    <DialogFooter className="gap-2 sm:gap-2">
      <Button variant="ghost" className="rounded-full" onClick={onCancel} disabled={busy} type="button">
        Cancel
      </Button>
      <Button onClick={charge} disabled={busy || !amountValid} variant="destructive" className="rounded-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Charge $${amount || "0"}`}
      </Button>
    </DialogFooter>
  );
}

function ManualCardForm({ appointmentId, amount, amountValid, onCharged, onCancel }: { appointmentId: string; amount: string; amountValid: boolean; onCharged: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!stripe || !elements) return;
    if (!amountValid) { setErr("Enter an amount between $1 and $1,000"); return; }
    setBusy(true); setErr(null);
    const card = elements.getElement(CardElement);
    if (!card) { setBusy(false); return; }
    const { paymentMethod, error } = await stripe.createPaymentMethod({ type: "card", card });
    if (error || !paymentMethod) { setErr(error?.message ?? "Card error"); setBusy(false); return; }
    const cents = Math.round(parseFloat(amount) * 100);
    const { data, error: fnErr } = await supabase.functions.invoke("payments-charge-no-show", {
      body: { appointmentId, amountCents: cents, paymentMethodId: paymentMethod.id },
    });
    setBusy(false);
    if (fnErr || data?.error) {
      const msg = data?.error || (fnErr ? await functionErrorMessage(fnErr, "Charge failed") : "Charge failed");
      setErr(msg);
      return;
    }
    toast.success(`$${amount} charged`); onCharged();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-background px-3 py-3">
        <CardElement options={{ hidePostalCode: false, style: { base: { fontSize: "15px", color: "hsl(var(--foreground))" } } }} />
      </div>
      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Lock className="h-3 w-3" /> Secured by Stripe</div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="ghost" className="rounded-full" onClick={onCancel} disabled={busy} type="button">
          Cancel
        </Button>
        <Button onClick={submit} disabled={busy || !stripe || !amountValid} variant="destructive" className="rounded-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Charge $${amount || "0"}`}
        </Button>
      </DialogFooter>
    </div>
  );
}
