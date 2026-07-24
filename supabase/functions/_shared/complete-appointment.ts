// Shared helper: mark an appointment completed and send the post-visit review email.
// Used by mark-appointment-complete (staff click), pos-finalize-sale (cash/voucher),
// and payments-webhook (auto on paid).
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export async function completeAppointmentAndNotify(
  supa: SupabaseClient,
  appointmentId: string,
  opts: { actorUserId?: string | null; reason?: string } = {},
) {
  const { data: appt } = await supa.from("appointments").select("*").eq("id", appointmentId).maybeSingle();
  if (!appt) return { ok: false, error: "Appointment not found" };
  const canTransition = ["approved", "pending", "arrived"].includes(appt.status);
  const fromStatus = appt.status;

  if (canTransition) {
    const { error: uErr } = await supa.from("appointments")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", appointmentId);
    if (uErr) return { ok: false, error: uErr.message };

    await supa.from("appointment_audit_log").insert({
      appointment_id: appointmentId,
      action: opts.reason ?? "marked_completed",
      from_status: fromStatus,
      to_status: "completed",
      actor_user_id: opts.actorUserId ?? null,
    });
  }
  // Even if status isn't transitionable (already completed, no_show, etc.),
  // fall through and still send the post-visit review email + GHL tag.
  // The idempotency key on the email send prevents duplicates.

  const [{ data: svc }, { data: staff }, { data: loc }, { data: lastSale }] = await Promise.all([
    supa.from("services").select("name").eq("id", appt.service_id).maybeSingle(),
    supa.from("staff_profiles").select("full_name").eq("id", appt.staff_id).maybeSingle(),
    supa.from("locations").select("name, google_review_url").eq("id", appt.location_id).maybeSingle(),
    supa.from("sales")
      .select("discount_cents, discount_pct, discount_amount_cents, discount_reason, promo_code, total_cents, paid_at")
      .eq("appointment_id", appointmentId)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const reviewUrl = (loc as any)?.google_review_url || undefined;

  const rebookParams = new URLSearchParams({
    service: appt.service_id,
    location: appt.location_id,
    staff: appt.staff_id,
    first: appt.client_first_name ?? "",
    last: appt.client_last_name ?? "",
    email: appt.client_email ?? "",
    phone: appt.client_phone ?? "",
    utm_source: "post_visit_email",
    utm_medium: "email",
    utm_campaign: "rebook",
  });
  const rebookUrl = `https://bookrka.com/book?${rebookParams.toString()}`;
  const feedbackUrl = `https://bookrka.com/feedback/${appt.public_token}`;

  // Build a human-readable discount summary, if any was applied on the sale.
  let discountSummary: string | undefined;
  let discountReason: string | undefined;
  let discountAmount: string | undefined;
  if (lastSale && (lastSale.discount_cents ?? 0) > 0) {
    const parts: string[] = [];
    if (lastSale.discount_pct) parts.push(`${Number(lastSale.discount_pct)}%`);
    if (lastSale.discount_amount_cents) parts.push(`$${(lastSale.discount_amount_cents / 100).toFixed(2)} off`);
    if (lastSale.promo_code) parts.push(`code ${lastSale.promo_code}`);
    const totalOff = `$${((lastSale.discount_cents ?? 0) / 100).toFixed(2)}`;
    discountAmount = totalOff;
    discountReason = lastSale.discount_reason || lastSale.promo_code || undefined;
    discountSummary = parts.length
      ? `${parts.join(" + ")} — ${totalOff} off${discountReason ? ` (${discountReason})` : ""}`
      : `${totalOff} off${discountReason ? ` (${discountReason})` : ""}`;
  }

  try {
    await supa.functions.invoke("send-transactional-email", {
      body: {
        templateName: "post-visit-review",
        recipientEmail: appt.client_email,
        idempotencyKey: `post-visit-${appointmentId}`,
        templateData: {
          clientFirstName: appt.client_first_name,
          serviceName: svc?.name ?? "your treatment",
          providerName: (staff as any)?.full_name ?? undefined,
          locationName: (loc as any)?.name ?? undefined,
          reviewUrl, rebookUrl, feedbackUrl,
          discountSummary,
          discountReason,
          discountAmount,
        },
      },
    });
  } catch (e) {
    console.error("post-visit email failed", e);
  }

  try {
    await supa.functions.invoke("ghl-sync-contact", {
      body: {
        email: appt.client_email,
        firstName: appt.client_first_name,
        lastName: appt.client_last_name,
        phone: appt.client_phone,
        tags: ["rkabook", "appointment-completed", "review-requested"],
      },
    });
  } catch (e) {
    console.error("ghl sync failed", e);
  }

  return { ok: true, reviewSent: !!reviewUrl };
}
