import Stripe from "https://esm.sh/stripe@22.0.2";

const getEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = "sandbox" | "live";

const GATEWAY_STRIPE_BASE = "https://connector-gateway.lovable.dev/stripe";

export function getConnectionApiKey(env: StripeEnv): string {
  return env === "sandbox"
    ? getEnv("STRIPE_SANDBOX_API_KEY")
    : getEnv("STRIPE_LIVE_API_KEY");
}

export function createStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv("LOVABLE_API_KEY");

  return new Stripe(connectionApiKey, {
    apiVersion: "2026-03-25.dahlia",
    httpClient: Stripe.createFetchHttpClient((url: string | URL, init?: RequestInit) => {
      const gatewayUrl = url.toString().replace("https://api.stripe.com", GATEWAY_STRIPE_BASE);
      const headers = new Headers(init?.headers);
      // The gateway rejects requests carrying both an Authorization bearer and
      // gateway keys ("Multiple auth schemes provided"). Strip the SDK's
      // Authorization header — auth goes via X-Connection-Api-Key + Lovable-API-Key.
      headers.delete("Authorization");
      headers.set("X-Connection-Api-Key", connectionApiKey);
      headers.set("Lovable-API-Key", lovableApiKey);
      return fetch(gatewayUrl, {
        ...init,
        headers: Object.fromEntries(headers.entries()),
      });
    }),
  });
}

export function currentEnv(): StripeEnv {
  // Live keys exist after go-live. Prefer live when available.
  return Deno.env.get("STRIPE_LIVE_API_KEY") ? "live" : "sandbox";
}
