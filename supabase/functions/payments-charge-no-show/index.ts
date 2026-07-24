// Charges $200 to the card-on-file for a no-show appointment. Staff/admin only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createStripeClient, currentEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NO_SHOW_AMOUNT_CENTS = 20000;
// Note: charging is allowed any time after approval; UI may also pass a manually-entered paymentMethodId.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: isStaff } = await supa.rpc("is_scheduler_or_admin", { _user_id: userRes.user.id });
    if (!isStaff) {
      const { data: isStaffRole } = await supa.rpc("is_staff_or_admin", { _user_id: userRes.user.id });
      if (!isStaffRole) return json({ error: "Forbidden" }, 403);
    }

    const { appointmentId, amountCents, paymentMethodId } = await req.json();
    if (!appointmentId) return json({ error: "Missing appointmentId" }, 400);
    const chargeAmount = Number.isFinite(amountCents) && amountCents > 0 ? Math.round(amountCents) : NO_SHOW_AMOUNT_CENTS;

    // ATOMIC GUARD: race-safe claim of the no-show charge slot.
    // Sets no_show_charge_id='PENDING' only if it was NULL. Two simultaneous
    // requests cannot both pass this gate, eliminating the double-charge race.
    const PENDING = "PENDING";
    const { data: claim, error: claimErr } = await supa.from("appointments")
      .update({ no_show_charge_id: PENDING })
      .eq("id", appointmentId)
      .is("no_show_charge_id", null)
      .select("id, status, stripe_customer_id, stripe_payment_method_id, client_email, client_first_name, client_last_name")
      .maybeSingle();
    if (claimErr) return json({ error: "Database error" }, 500);
    if (!claim) {
      // Either appointment doesn't exist, or charge already attempted.
      const { data: existing } = await supa.from("appointments")
        .select("id, no_show_charge_id").eq("id", appointmentId).maybeSingle();
      if (!existing) return json({ error: "Appointment not found" }, 404);
      return json({ error: "Already charged or charge in progress" }, 409);
    }
    const appt = claim;

    const env = currentEnv();
    const stripe = createStripeClient(env);

    let pmId: string | null = paymentMethodId ?? appt.stripe_payment_method_id ?? null;
    let customerId: string | null = appt.stripe_customer_id;

    if (paymentMethodId && !customerId) {
      const cust = await stripe.customers.create({
        email: appt.client_email,
        name: `${appt.client_first_name} ${appt.client_last_name}`,
      });
      customerId = cust.id;
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    }
    if (!pmId || !customerId) {
      // Release the PENDING claim so the user can retry with a manual card.
      await supa.from("appointments").update({ no_show_charge_id: null }).eq("id", appt.id);
      return json({ error: "No card on file. Send paymentMethodId to charge a manually-entered card." }, 400);
    }

    let pi: Awaited<ReturnType<typeof stripe.paymentIntents.create>>;
    try {
      pi = await stripe.paymentIntents.create({
        amount: chargeAmount,
        currency: "usd",
        customer: customerId,
        payment_method: pmId,
        off_session: true,
        confirm: true,
        description: `No-show fee — ${appt.client_first_name} ${appt.client_last_name}`,
        metadata: { appointment_id: appt.id, purpose: "no_show_fee" },
      });
    } catch (stripeErr) {
      // Release the PENDING claim so the user can retry.
      await supa.from("appointments").update({ no_show_charge_id: null }).eq("id", appt.id);
      throw stripeErr;
    }

    await supa.from("appointments").update({
      status: "no_show",
      no_show_charge_id: pi.id,
      no_show_charged_at: new Date().toISOString(),
    }).eq("id", appt.id);

    await supa.from("appointment_audit_log").insert({
      appointment_id: appt.id,
      actor_id: userRes.user.id,
      action: "no_show_charged",
      details: { payment_intent_id: pi.id, amount_cents: NO_SHOW_AMOUNT_CENTS },
    }).then(() => {}, () => {});

    // Tag contact in GHL for no-show SMS workflow (best effort)
    try {
      await supa.functions.invoke("ghl-sync-contact", {
        body: {
          email: appt.client_email,
          firstName: appt.client_first_name,
          lastName: appt.client_last_name,
          tags: ["rkabook", "no-show"],
        },
      });
    } catch (e) { console.error("ghl no-show sync failed", e); }

    return json({ ok: true, paymentIntentId: pi.id, status: pi.status });
  } catch (e) {
    const err = e as { code?: string; message?: string; decline_code?: string };
    console.error("[payments-charge-no-show]", err);
    // Sanitize: never leak raw Stripe internals to the browser.
    const decline = err.decline_code;
    let userMsg = "Charge failed. Please verify the card or use a different one.";
    if (decline === "insufficient_funds") userMsg = "Card declined: insufficient funds.";
    else if (decline === "expired_card") userMsg = "Card declined: expired.";
    else if (decline === "incorrect_cvc") userMsg = "Card declined: incorrect CVC.";
    else if (err.code === "authentication_required") userMsg = "Card requires authentication — charge a card in person.";
    return json({ error: userMsg }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
