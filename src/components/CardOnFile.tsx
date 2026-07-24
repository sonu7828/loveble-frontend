import { useState, useImperativeHandle, forwardRef } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock } from "lucide-react";
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
    return (
      <p className="text-xs text-muted-foreground">
        Card collection unavailable — please contact us to confirm.
      </p>
    );
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
      const { data, error: fnErr } = await supabase.functions.invoke(
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
