// Mark an appointment as completed and send a post-visit review request email.
// Body: { appointmentId: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { appointmentId } = await req.json();
    if (!appointmentId) return json({ error: "Invalid input" }, 400);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Authorization: admin/scheduler OR staff owner of the appointment
    const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", user.id);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isPriv = roleSet.has("admin") || roleSet.has("scheduler") || roleSet.has("receptionist");

    const { data: appt } = await supa.from("appointments").select("*").eq("id", appointmentId).single();
    if (!appt) return json({ error: "Not found" }, 404);
    if (!["approved", "pending", "arrived"].includes(appt.status)) {
      return json({ error: `Cannot complete an appointment in status "${appt.status}"` }, 400);
    }

    if (!isPriv) {
      const { data: sp } = await supa.from("staff_profiles").select("id")
        .eq("id", appt.staff_id).eq("user_id", user.id).maybeSingle();
      if (!sp) return json({ error: "Forbidden" }, 403);
    }

    const fromStatus = appt.status;
    // Atomic transition: only succeed if status hasn't changed since we read it.
    const { data: updated, error: uErr } = await supa.from("appointments")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", appointmentId)
      .eq("status", fromStatus)
      .select("id");
    if (uErr) return json({ error: uErr.message }, 500);
    if (!updated || updated.length === 0) {
      return json({ error: "Appointment status changed — please refresh and try again" }, 409);
    }

    await supa.from("appointment_audit_log").insert({
      appointment_id: appointmentId,
      action: "marked_completed",
      from_status: fromStatus,
      to_status: "completed",
      actor_user_id: user.id,
    });

    // Gather review email context
    const [{ data: svc }, { data: staff }, { data: loc }] = await Promise.all([
      supa.from("services").select("name").eq("id", appt.service_id).maybeSingle(),
      supa.from("staff_profiles").select("full_name").eq("id", appt.staff_id).maybeSingle(),
      supa.from("locations").select("name, google_review_url").eq("id", appt.location_id).maybeSingle(),
    ]);

    const reviewUrl = (loc as any)?.google_review_url || undefined;

    // Build a one-click rebook URL: prefilled service / provider / location and client details.
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

    // Send post-visit review email (idempotent per appointment)
    try {
      await supa.functions.invoke("send-transactional-email", {
        body: {
          templateName: "post-visit-review",
          recipientEmail: appt.client_email,
          idempotencyKey: `post-visit-${appointmentId}`,
          templateData: {
            clientFirstName: appt.client_first_name,
            serviceName: svc?.name ?? "your treatment",
            providerName: staff?.full_name ?? undefined,
            locationName: (loc as any)?.name ?? undefined,
            reviewUrl,
            rebookUrl,
            feedbackUrl,
          },
        },
      });
    } catch (e) {
      console.error("post-visit email failed", e);
    }

    // GHL: tag as completed for follow-up workflows
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

    return json({ ok: true, reviewSent: !!reviewUrl });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
