import { useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const PUBLISHABLE = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
let _p: Promise<Stripe | null> | null = null;
const getStripe = () => (PUBLISHABLE ? (_p ??= loadStripe(PUBLISHABLE)) : null);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientSecret: string | null;
  amountDueCents: number;
  onPaid: () => void;
}

export function ManualCardDialog({ open, onOpenChange, clientSecret, amountDueCents, onPaid }: Props) {
  const stripeP = getStripe();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manual card entry</DialogTitle>
          <DialogDescription>Charge ${(amountDueCents / 100).toFixed(2)} to a card.</DialogDescription>
        </DialogHeader>
        {!stripeP && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" /> Card collection not configured.
          </p>
        )}
        {stripeP && clientSecret && (
          <Elements stripe={stripeP} options={{ clientSecret, appearance: { theme: "stripe" } }}>
            <Inner amountDueCents={amountDueCents} onPaid={() => { onPaid(); onOpenChange(false); }} />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Inner({ amountDueCents, onPaid }: { amountDueCents: number; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!stripe || !elements) return;
    setBusy(true); setErr(null);
    const { error: submitErr } = await elements.submit();
    if (submitErr) { setErr(submitErr.message ?? "Card error"); setBusy(false); return; }
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    setBusy(false);
    if (error) { setErr(error.message ?? "Payment failed"); return; }
    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
      toast.success(`$${(amountDueCents / 100).toFixed(2)} charged`);
      onPaid();
    } else {
      setErr(`Payment ${paymentIntent?.status ?? "incomplete"}`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-background p-3">
        <PaymentElement />
      </div>
      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Lock className="h-3 w-3" /> Secured by Stripe</div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <DialogFooter>
        <Button onClick={submit} disabled={busy || !stripe} className="rounded-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Charge $${(amountDueCents / 100).toFixed(2)}`}
        </Button>
      </DialogFooter>
    </div>
  );
}
