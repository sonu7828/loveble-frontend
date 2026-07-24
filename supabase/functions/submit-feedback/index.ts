// Public submission of post-visit feedback. Token-authenticated (no JWT).
// Body: { token: string, rating: 1..5, comment?: string, allowTestimonial?: boolean }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { token, rating, comment, allowTestimonial } = await req.json();
    if (!token || typeof token !== "string" || token.length < 16) return json({ error: "Invalid token" }, 400);
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) return json({ error: "Rating must be 1-5" }, 400);
    if (comment && typeof comment !== "string") return json({ error: "Invalid comment" }, 400);
    if (comment && comment.length > 2000) return json({ error: "Comment too long" }, 400);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: appt } = await supa.from("appointments")
      .select("id, client_email, service_id, staff_id, location_id, status, client_phone, client_first_name, client_last_name")
      .eq("public_token", token).maybeSingle();
    if (!appt) return json({ error: "Not found" }, 404);

    const { error } = await supa.from("client_feedback").upsert({
      appointment_id: appt.id,
      client_email: appt.client_email,
      service_id: appt.service_id,
      staff_id: appt.staff_id,
      location_id: appt.location_id,
      rating: r,
      comment: comment?.trim() || null,
      allow_testimonial: !!allowTestimonial,
    }, { onConflict: "appointment_id" });

    if (error) return json({ error: error.message }, 500);

    let reviewUrl: string | null = null;
    if (r === 5 && appt.location_id) {
      const { data: loc } = await supa.from("locations")
        .select("google_review_url").eq("id", appt.location_id).maybeSingle();
      reviewUrl = loc?.google_review_url || null;

      // Backup: text the Google review link so they can complete it later if they bail.
      if (reviewUrl && appt.client_phone) {
        try {
          const firstName = appt.client_first_name?.trim() || "there";
          const body = `Hi ${firstName}, thanks for the 5★! 💛 Would you mind sharing it on Google? It takes 30 seconds and means the world to our team: ${reviewUrl} — Radiantilyk Aesthetic`;
          const { error: smsErr } = await supa.functions.invoke("send-sms-via-ghl", {
            body: { phone: appt.client_phone, body, template: "google-review-request", appendStopFooter: false },
          });
          if (!smsErr) {
            await supa.from("client_feedback")
              .update({ google_review_sms_sent_at: new Date().toISOString() })
              .eq("appointment_id", appt.id);
          }
        } catch (e) { console.error("google review SMS failed", e); }
      }
    }

    // Notify owners on low ratings (≤3) so they can follow up privately.
    if (r <= 3) {
      try {
        const { data: owners } = await supa.from("staff_profiles")
          .select("phone").eq("is_owner", true).not("phone", "is", null);
        const clientName = [appt.client_first_name, appt.client_last_name].filter(Boolean).join(" ") || appt.client_email;
        const snippet = (comment || "").trim().slice(0, 160);
        const body = `⚠️ ${r}★ feedback from ${clientName}${snippet ? `: "${snippet}"` : ""}. Review at /staff/feedback`;
        for (const o of owners ?? []) {
          if (!o.phone) continue;
          await supa.functions.invoke("send-sms-via-ghl", {
            body: { phone: o.phone, body, template: "low-rating-alert", skipOptInCheck: true, appendStopFooter: false },
          });
        }
      } catch (e) { console.error("low-rating alert failed", e); }
    }

    return json({ ok: true, reviewUrl });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
