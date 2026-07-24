// Creates a Stripe Customer + SetupIntent so the booking page can collect a card-on-file.
import { createStripeClient, currentEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allow-list of origins that may create SetupIntents. Public booking pages live here.
const ALLOWED_ORIGINS = [
  "https://bookrka.com",
  "https://www.bookrka.com",
  "https://rkabook.lovable.app",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Origin check — prevents random scripts from spawning Stripe customers
    const origin = req.headers.get("origin") ?? "";
    const isLovablePreview = /\.lovable\.app$/i.test(new URL(origin || "http://x").hostname);
    if (!ALLOWED_ORIGINS.includes(origin) && !isLovablePreview) {
      return json({ error: "Origin not allowed" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const name = String(body?.name ?? "").trim();
    const phone = String(body?.phone ?? "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email" }, 400);
    if (email.length > 200) return json({ error: "Invalid email" }, 400);
    if (name.length < 1 || name.length > 120) return json({ error: "Invalid name" }, 400);
    if (phone && phone.length > 30) return json({ error: "Invalid phone" }, 400);

    const env = currentEnv();
    const stripe = createStripeClient(env);

    const customer = await stripe.customers.create({
      email, name, phone: phone || undefined,
      metadata: { source: "rkaglow-booking" },
    });
    if (!customer?.id) throw new Error("Stripe customer creation failed");

    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      // Enables card + wallet (Apple Pay / Google Pay / Link) via PaymentElement.
      // allow_redirects: "never" excludes redirect-only methods we don't support.
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      usage: "off_session",
      metadata: { purpose: "no_show_protection" },
    });
    if (!setupIntent?.client_secret) throw new Error("Stripe setup intent creation failed");

    return json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
      setupIntentId: setupIntent.id,
      env,
    });
  } catch (e) {
    console.error("[payments-create-setup-intent]", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
