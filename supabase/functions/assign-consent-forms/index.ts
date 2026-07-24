// Staff assigns one or more consent forms to a specific appointment AFTER booking,
// and emails the client a secure link to sign. Idempotent per (appointment, form).
// Body: { appointmentId: string, consentFormIds: string[] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { computeMissingConsents } from "../_shared/consent-validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { appointmentId, consentFormIds } = await req.json();
    if (!appointmentId || !Array.isArray(consentFormIds) || consentFormIds.length === 0) {
      return json({ error: "Missing appointmentId or consentFormIds" }, 400);
    }

    const { data: appt } = await supa.from("appointments")
      .select("id, staff_id, client_email, client_first_name, public_token").eq("id", appointmentId).single();
    if (!appt) return json({ error: "Appointment not found" }, 404);

    // Permission check
    const { data: priv } = await supa.rpc("is_scheduler_or_admin", { _user_id: user.id });
    if (!priv) {
      const { data: sp } = await supa.from("staff_profiles").select("id").eq("id", appt.staff_id).eq("user_id", user.id).maybeSingle();
      if (!sp) return json({ error: "Forbidden" }, 403);
    }

    const { data: forms } = await supa.from("consent_forms")
      .select("id, title, slug, version, consent_scope").in("id", consentFormIds).eq("is_active", true);
    if (!forms?.length) return json({ error: "No active forms found" }, 400);

    // Find prior valid signatures (current version + not expired) for this client across
    // any appointment, so we don't re-email about forms that are already on file.
    const cleanEmail = String(appt.client_email || "").trim().toLowerCase();
    const nowIso = new Date().toISOString();
    const { data: priorSigs } = await supa.from("consent_signatures")
      .select("consent_form_id, form_version, expires_at, decision")
      .eq("client_email", cleanEmail)
      .in("consent_form_id", forms.map((f) => f.id))
      .order("signed_at", { ascending: false });
    const satisfiedFormIds = new Set<string>();
    for (const f of forms) {
      const hit = (priorSigs ?? []).find((s: any) =>
        s.consent_form_id === f.id &&
        s.decision === "consent" &&
        s.form_version === f.version &&
        (!s.expires_at || s.expires_at > nowIso)
      );
      if (hit) satisfiedFormIds.add(f.id);
    }

    const rows = forms.map((f) => ({
      appointment_id: appointmentId,
      consent_form_id: f.id,
      assigned_by: user.id,
      sent_to_email: appt.client_email,
      signed: satisfiedFormIds.has(f.id),
    }));
    const { error: upErr } = await supa.from("appointment_consents")
      .upsert(rows, { onConflict: "appointment_id,consent_form_id" });
    if (upErr) return json({ error: upErr.message }, 500);

    // Only email about forms that aren't already satisfied
    const unsignedForms = forms.filter((f) => !satisfiedFormIds.has(f.id));
    if (!unsignedForms.length) {
      return json({ ok: true, assigned: forms.length, autoSatisfied: forms.length });
    }
    const origin = req.headers.get("origin") || "https://bookrka.com";
    const signUrl = `${origin}/consents/${appt.public_token}`;
    const formList = unsignedForms.map((f) => `• ${f.title}`).join("\n");

    const idemKey = `consent-assign-${appointmentId}-${unsignedForms.map((f) => f.id).sort().join("-")}-${Date.now()}`;
    const logRows = unsignedForms.map((f) => ({
      appointment_id: appointmentId,
      consent_form_id: f.id,
      recipient_email: appt.client_email,
      template_name: "consent-assignment",
      source: "assign-consent-forms",
      idempotency_key: idemKey,
      forms_count: unsignedForms.length,
      metadata: { form_title: f.title, assigned_by: user.id },
    }));

    try {
      await supa.functions.invoke("send-transactional-email", {
        body: {
          templateName: "consent-assignment",
          recipientEmail: appt.client_email,
          idempotencyKey: idemKey,
          templateData: {
            clientFirstName: appt.client_first_name,
            signUrl,
            formList,
          },
        },
      });
      await supa.from("consent_email_log").insert(logRows);
    } catch (e) {
      console.error("email send failed", e);
      await supa.from("consent_email_log").insert(
        logRows.map((r) => ({ ...r, status: "failed", error_message: String((e as Error).message ?? e) }))
      );
    }

    return json({ ok: true, assigned: forms.length, emailed: unsignedForms.length, autoSatisfied: satisfiedFormIds.size, signUrl });

  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
