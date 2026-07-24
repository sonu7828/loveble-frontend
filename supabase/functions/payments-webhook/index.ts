// Receives Stripe webhooks. Verifies signature, then handles POS/Terminal events.
import { createStripeClient } from "../_shared/stripe.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const env = (url.searchParams.get("env") === "live" ? "live" : "sandbox") as "live" | "sandbox";

  const secretName = env === "live" ? "PAYMENTS_LIVE_WEBHOOK_SECRET" : "PAYMENTS_SANDBOX_WEBHOOK_SECRET";
  const webhookSecret = Deno.env.get(secretName);
  const sig = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();

  if (!webhookSecret) {
    console.error(`[payments-webhook] missing ${secretName}`);
    return new Response("Webhook not configured", { status: 500 });
  }
  if (!sig) return new Response("Missing signature", { status: 400 });

  let event: any;
  try {
    const stripe = createStripeClient(env);
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (e) {
    console.error("[payments-webhook] signature verification failed", e);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log(`[payments-webhook] env=${env} type=${event.type} id=${event.id}`);
  const supa = svc();

  // Idempotency guard — if we've already processed this Stripe event, ack and skip
  const { error: idemErr } = await supa
    .from("webhook_events_processed")
    .insert({ id: event.id, source: `stripe-${env}`, event_type: event.type });
  if (idemErr) {
    if ((idemErr as any).code === "23505") {
      console.log(`[payments-webhook] duplicate event ${event.id} — already processed`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("[payments-webhook] idempotency insert failed", idemErr);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const saleId = pi.metadata?.sale_id;
        if (saleId) {
          await supa.from("sales").update({
            status: "paid",
            paid_at: new Date().toISOString(),
            stripe_charge_id: pi.latest_charge ?? null,
            reader_action_status: "succeeded",
          }).eq("id", saleId);

          // Auto-save card on file from this payment (best-effort)
          try {
            const { data: saleRow } = await supa.from("sales").select("client_email").eq("id", saleId).maybeSingle();
            const customerId = pi.customer as string | null;
            const paymentMethodId = pi.payment_method as string | null;
            if (saleRow?.client_email && customerId && paymentMethodId) {
              const { saveCardOnFile } = await import("../_shared/save-card-on-file.ts");
              await saveCardOnFile(supa, env, {
                clientEmail: saleRow.client_email,
                stripeCustomerId: customerId,
                stripePaymentMethodId: paymentMethodId,
              });
            }
          } catch (e) { console.error("[payments-webhook] auto-save card failed", e); }

          const apptId = pi.metadata?.appointment_id;
          if (apptId) {
            const { completeAppointmentAndNotify } = await import("../_shared/complete-appointment.ts");
            await completeAppointmentAndNotify(supa, apptId, { reason: "auto_completed_after_payment" });
          }
          const { sendSaleReceiptIfNeeded } = await import("../_shared/send-sale-receipt.ts");
          await sendSaleReceiptIfNeeded(supa, saleId);

          // Increment promo usage if a promo code was applied
          try {
            const { data: saleRow2 } = await supa.from("sales").select("promo_code").eq("id", saleId).maybeSingle();
            if (saleRow2?.promo_code) {
              const { data: pc } = await supa.from("promo_codes").select("id, used_count").ilike("code", saleRow2.promo_code).maybeSingle();
              if (pc) await supa.from("promo_codes").update({ used_count: (pc.used_count ?? 0) + 1 }).eq("id", pc.id);
            }
          } catch (e) { console.error("[payments-webhook] promo usage increment failed", e); }
        }

        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        const saleId = pi.metadata?.sale_id;
        if (saleId) {
          await supa.from("sales").update({
            status: "draft",
            reader_action_status: "failed",
            notes: pi.last_payment_error?.message ?? null,
          }).eq("id", saleId);
        }
        break;
      }
      case "terminal.reader.action_succeeded":
      case "terminal.reader.action_failed": {
        const reader = event.data.object;
        await supa.from("terminal_readers").update({
          status: reader.status ?? null,
          last_seen_at: new Date().toISOString(),
        }).eq("stripe_reader_id", reader.id);

        const action = reader.action;
        const paymentIntentId = action?.process_payment_intent?.payment_intent ?? action?.payment_intent;
        if (paymentIntentId && event.type === "terminal.reader.action_succeeded") {
          const stripe = createStripeClient(env);
          let pi = await stripe.paymentIntents.retrieve(paymentIntentId);
          if (pi.status === "requires_capture") pi = await stripe.paymentIntents.capture(pi.id);
          if (pi.status === "succeeded") {
            await supa.from("sales").update({
              status: "paid",
              paid_at: new Date().toISOString(),
              stripe_charge_id: pi.latest_charge ?? null,
              reader_action_status: "succeeded",
            }).eq("stripe_payment_intent_id", pi.id);

            const { data: saleRow } = await supa.from("sales").select("id, appointment_id").eq("stripe_payment_intent_id", pi.id).maybeSingle();
            if (saleRow?.appointment_id) {
              const { completeAppointmentAndNotify } = await import("../_shared/complete-appointment.ts");
              await completeAppointmentAndNotify(supa, saleRow.appointment_id, { reason: "auto_completed_after_payment" });
            }
            if (saleRow?.id) {
              const { sendSaleReceiptIfNeeded } = await import("../_shared/send-sale-receipt.ts");
              await sendSaleReceiptIfNeeded(supa, saleRow.id);
            }
          }
        } else if (paymentIntentId && event.type === "terminal.reader.action_failed") {
          await supa.from("sales").update({
            status: "draft",
            reader_action_status: "failed",
            notes: action?.failure_message ?? "Reader payment failed",
          }).eq("stripe_payment_intent_id", paymentIntentId);
        }
        break;
      }
      case "charge.refunded": {
        const ch = event.data.object;
        const pi = ch.payment_intent;
        if (pi) {
          await supa.from("sales").update({
            status: ch.amount_refunded >= ch.amount ? "refunded" : "paid",
            refunded_amount_cents: ch.amount_refunded,
          }).eq("stripe_payment_intent_id", pi);
        }
        break;
      }
    }
  } catch (e) {
    console.error("[payments-webhook] handler error", e);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
