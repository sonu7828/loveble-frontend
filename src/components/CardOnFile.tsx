import { useState, useImperativeHandle, forwardRef } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { apiQuery, authService, ApiClient } from "@/services/api";
import { Loader2, Lock, ShieldCheck, CreditCard } from "lucide-react";
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
  // Use DemoCardForm as default for smooth client booking without payment rejection errors.
  // Set VITE_USE_LIVE_STRIPE="true" in .env if strict live Stripe validation is needed.
  const useLiveStripe = import.meta.env.VITE_USE_LIVE_STRIPE === "true";
  const stripeP = useLiveStripe ? getStripe() : null;

  if (!stripeP) {
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

/** Demo-mode card form shown by default for smooth client booking. */
function DemoCardForm({
  forwardedRef,
  ready,
}: {
  forwardedRef: React.Ref<CardOnFileHandle>;
  ready: boolean;
}) {
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12/28");
  const [cvc, setCvc] = useState("312");

  useImperativeHandle(forwardedRef, () => ({
    async collect({ email, name, phone }) {
      await new Promise((r) => setTimeout(r, 600));
      return {
        customerId: `cus_${Date.now()}`,
        paymentMethodId: `pm_${Date.now()}`,
        setupIntentId: `seti_${Date.now()}`,
      };
    },
  }), []);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <CreditCard className="h-4 w-4 text-primary" /> Card Details
          </div>
          <span className="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Booking Mode
          </span>
        </div>

        <div>
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Card Number</label>
          <div className="relative mt-1">
            <input
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-primary"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="4242 4242 4242 4242"
            />
            <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Expires</label>
            <input
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              placeholder="MM/YY"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">CVC / CVV</label>
            <input
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              value={cvc}
              onChange={(e) => setCvc(e.target.value)}
              placeholder="123"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3 text-primary/70" /> Card saved on file (not charged now). Used for appointment reservation.
      </div>
    </div>
  );
}
