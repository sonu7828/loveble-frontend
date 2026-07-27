import { useState, useImperativeHandle, forwardRef } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { apiQuery, authService, ApiClient } from "@/services/api";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { functionErrorMessage } from "@/lib/functionError";

const PUBLISHABLE = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  if (!PUBLISHABLE) return null;
  if (!stripePromise) stripePromise = loadStripe(PUBLISHABLE);
  return stripePromise;
}

export interface CardOnFileResult {
  customerId: string;
  paymentMethodId: string;
  setupIntentId: string;
}

export interface CardOnFileHandle {
  collect: (input: { email: string; name: string; phone: string }) => Promise<CardOnFileResult>;
}

export const CardOnFile = forwardRef<CardOnFileHandle, { ready: boolean }>(function CardOnFile(
  { ready },
  ref,
) {
  const stripeP = getStripe();
  if (!stripeP) {
    // Demo mode — no Stripe key configured. Render a placeholder card form
    // and expose a collect() that returns mock IDs so the booking flow completes.
    return <DemoCardForm forwardedRef={ref} ready={ready} />;
  }
  // Deferred-intent pattern: we declare mode/currency up front so Apple Pay,
  // Google Pay, and Link can render in the PaymentElement. The actual
  // SetupIntent is created at `collect` time, and confirmSetup uses the
  // mounted Elements instance to confirm against the freshly-issued
  // client_secret without re-mounting the UI.
  return (
    <Elements
      stripe={stripeP}
      options={{
        mode: "setup",
        currency: "usd",
        setupFutureUsage: "off_session",
        paymentMethodCreation: "manual",
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "hsl(var(--primary))",
            colorBackground: "hsl(var(--background))",
            colorText: "hsl(var(--foreground))",
            colorDanger: "hsl(var(--destructive))",
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto',
            borderRadius: "8px",
          },
        },
      }}
    >
      <CardForm forwardedRef={ref} ready={ready} />
    </Elements>
  );
});

function CardForm({
  forwardedRef,
  ready,
}: {
  forwardedRef: React.Ref<CardOnFileHandle>;
  ready: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [walletReady, setWalletReady] = useState(false);

  useImperativeHandle(forwardedRef, () => ({
    async collect({ email, name, phone }) {
      setError(null);
      if (!stripe || !elements) throw new Error("Card form not ready");

      // Validate input on the PaymentElement first (per Stripe's deferred flow)
      const { error: submitErr } = await elements.submit();
      if (submitErr) {
        const msg = submitErr.message || "Please check your payment details";
        setError(msg);
        throw new Error(msg);
      }

      // Now create the SetupIntent on the server
      const { data, error: fnErr } = await ApiClient.post(
        "payments-create-setup-intent",
        { body: { email, name, phone } },
      );
      if (fnErr || !data?.clientSecret) {
        const msg = (data as any)?.error || (fnErr ? await functionErrorMessage(fnErr, "Could not initialize payment") : "Could not initialize payment");
        setError(msg);
        throw new Error(msg);
      }

      // Confirm with the mounted Elements — Apple Pay / Google Pay / card all
      // flow through this single call. redirect:"if_required" keeps card flows
      // inline (our SetupIntent excludes redirect-only methods).
      const result = await stripe.confirmSetup({
        elements,
        clientSecret: data.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/book`,
          payment_method_data: {
            billing_details: { name, email, phone: phone || undefined },
          },
        },
        redirect: "if_required",
      });

      if (result.error || !result.setupIntent?.payment_method) {
        const msg = result.error?.message || "Card was declined";
        setError(msg);
        throw new Error(msg);
      }

      return {
        customerId: data.customerId,
        paymentMethodId: String(result.setupIntent.payment_method),
        setupIntentId: data.setupIntentId,
      };
    },
  }), [stripe, elements]);

  return (
    <div>
      <PaymentElement
        onReady={() => setWalletReady(true)}
        options={{
          layout: { type: "tabs", defaultCollapsed: false },
          wallets: { applePay: "auto", googlePay: "auto" },
          fields: { billingDetails: { name: "never", email: "never", phone: "never" } },
        }}
      />
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3" /> Secured by Stripe. Card saved, not charged. Apple Pay & Google Pay supported on capable devices.
      </div>
      {(!ready || !walletReady) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Preparing secure payment…
        </div>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Demo-mode card form shown when no Stripe publishable key is set. */
function DemoCardForm({
  forwardedRef,
  ready,
}: {
  forwardedRef: React.Ref<CardOnFileHandle>;
  ready: boolean;
}) {
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12/30");
  const [cvc, setCvc] = useState("123");

  useImperativeHandle(forwardedRef, () => ({
    async collect({ email, name, phone }) {
      // Simulate a short delay like a real payment processor
      await new Promise((r) => setTimeout(r, 800));
      return {
        customerId: `demo_cus_${Date.now()}`,
        paymentMethodId: `demo_pm_${Date.now()}`,
        setupIntentId: `demo_seti_${Date.now()}`,
      };
    },
  }), []);

  return (
    <div>
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">Demo Mode</span> — No real charge. Card details are simulated for testing.
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Card Number</label>
          <input
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono tracking-wider"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            placeholder="4242 4242 4242 4242"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Expiry</label>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              placeholder="MM/YY"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">CVC</label>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              value={cvc}
              onChange={(e) => setCvc(e.target.value)}
              placeholder="123"
            />
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3" /> Demo mode — card saved locally, not charged. Connect Stripe for live payments.
      </div>
    </div>
  );
}
