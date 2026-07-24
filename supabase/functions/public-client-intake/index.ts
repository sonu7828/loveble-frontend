// Public endpoint for pre-visit intake form.
// GET  ?token=xxx                  -> returns appt summary + last submission if any
// POST { token, payload }          -> upserts intake + syncs into client_profiles + stamps appointment
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token || token.length < 16) return json({ error: "Invalid token" }, 400);

      const { data: appt } = await supa
        .from("appointments")
        .select("id, client_first_name, client_last_name, client_email, status, start_at, intake_completed_at, services(name)")
        .eq("public_token", token)
        .maybeSingle();
      if (!appt) return json({ error: "Not found" }, 404);

      const { data: submission } = await supa
        .from("client_intake_submissions")
        .select("*")
        .eq("appointment_id", appt.id)
        .maybeSingle();

      // Look up last FULL submission for this email within the past 12 months.
      // If found, the appointment qualifies for the short check-in flow.
      let lastFull: any = null;
      const email = String((appt as any).client_email ?? "").toLowerCase();
      if (email) {
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
        const { data: lf } = await supa
          .from("client_intake_submissions")
          .select("*")
          .eq("client_email", email)
          .eq("submission_kind", "full")
          .neq("appointment_id", appt.id)
          .gte("submitted_at", oneYearAgo)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        lastFull = lf ?? null;
      }

      return json({ appointment: appt, submission: submission ?? null, lastFull });
    }

    if (req.method === "POST") {
      const { token, payload } = await req.json();
      if (!token || !payload || typeof payload !== "object") {
        return json({ error: "Invalid input" }, 400);
      }

      const { data: appt } = await supa
        .from("appointments")
        .select("id, client_email")
        .eq("public_token", token)
        .maybeSingle();
      if (!appt) return json({ error: "Not found" }, 404);

      const arr = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 50) : [];
      const str = (v: unknown, max = 1000): string | null =>
        typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
      const bool = (v: unknown): boolean => v === true;

      const kind = payload.submission_kind === "checkin" ? "checkin" : "full";

      // Server-side completion guard — reject empty/partial submissions so
      // an opened link or preview-fetch can't be recorded as "completed".
      const sigName = typeof payload.signature_full_name === "string" ? payload.signature_full_name.trim() : "";
      const truthful = payload.truthful_acknowledged === true;
      if (!sigName || !truthful) {
        return json({ error: "Signature and truthful-acknowledgement are required to submit." }, 400);
      }
      if (kind === "full") {
        const hasAllergies = Array.isArray(payload.allergies) && payload.allergies.length > 0;
        const hasMeds = Array.isArray(payload.current_medications) && payload.current_medications.length > 0;
        const hasHistory = Array.isArray(payload.medical_history) && payload.medical_history.length > 0;
        const skinType = typeof payload.skin_type === "string" && payload.skin_type.trim();
        const emName = typeof payload.emergency_contact_name === "string" && payload.emergency_contact_name.trim();
        const emPhone = typeof payload.emergency_contact_phone === "string" && payload.emergency_contact_phone.trim();
        if (!hasAllergies || !hasMeds || !hasHistory || !skinType || !emName || !emPhone || payload.hipaa_acknowledged !== true) {
          return json({ error: "Please complete all required health-history fields before submitting." }, 400);
        }
      } else {
        if (typeof payload.has_changes !== "boolean") {
          return json({ error: "Please confirm whether anything has changed since your last visit." }, 400);
        }
      }

      const row: Record<string, unknown> = {
        appointment_id: appt.id,
        client_email: String(appt.client_email ?? "").toLowerCase(),
        submission_kind: kind,
        allergies: arr(payload.allergies),
        allergies_other: str(payload.allergies_other, 500),
        current_medications: arr(payload.current_medications),
        current_medications_other: str(payload.current_medications_other, 500),
        medical_history: arr(payload.medical_history),
        medical_history_other: str(payload.medical_history_other, 500),
        pregnancy_status: str(payload.pregnancy_status, 50),
        skin_type: str(payload.skin_type, 100),
        skin_concerns: arr(payload.skin_concerns),
        sun_exposure: str(payload.sun_exposure, 50),
        smoking_status: str(payload.smoking_status, 50),
        alcohol_use: str(payload.alcohol_use, 50),
        exercise_frequency: str(payload.exercise_frequency, 50),
        skincare_products: arr(payload.skincare_products),
        prior_cosmetic_procedures: arr(payload.prior_cosmetic_procedures),
        family_history: arr(payload.family_history),
        social_history: arr(payload.social_history),
        primary_care_physician: str(payload.primary_care_physician, 200),
        emergency_contact_name: str(payload.emergency_contact_name, 200),
        emergency_contact_phone: str(payload.emergency_contact_phone, 50),
        emergency_contact_relation: str(payload.emergency_contact_relation, 100),
        concerns: str(payload.concerns, 2000),
        goals: str(payload.goals, 2000),
        recent_treatments: str(payload.recent_treatments, 2000),
        hipaa_acknowledged: bool(payload.hipaa_acknowledged),
        truthful_acknowledged: bool(payload.truthful_acknowledged),
        signature_full_name: str(payload.signature_full_name, 200),
        signature_date: typeof payload.signature_date === "string" ? payload.signature_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        user_agent: req.headers.get("user-agent") ?? null,
        submitted_at: new Date().toISOString(),
        has_changes: typeof payload.has_changes === "boolean" ? payload.has_changes : null,
        changes_meds: str(payload.changes_meds, 1000),
        changes_allergies: str(payload.changes_allergies, 1000),
        changes_history: str(payload.changes_history, 1000),
        changes_pregnancy: str(payload.changes_pregnancy, 200),
        recent_illness_or_event: str(payload.recent_illness_or_event, 1000),
        based_on_submission_id: typeof payload.based_on_submission_id === "string" ? payload.based_on_submission_id : null,
        ai_scribe_consent: bool(payload.ai_scribe_consent),
        ai_scribe_consent_at: payload.ai_scribe_consent === true ? new Date().toISOString() : null,
      };


      const { error: upErr } = await supa
        .from("client_intake_submissions")
        .upsert(row, { onConflict: "appointment_id" });
      if (upErr) return json({ error: upErr.message }, 500);

      if (payload.npp_acknowledged) {
        await supa
          .from("client_profiles")
          .update({ npp_acknowledged_at: new Date().toISOString() })
          .eq("email", String(appt.client_email).toLowerCase());
      }

      await supa
        .from("appointments")
        .update({ intake_completed_at: new Date().toISOString() })
        .eq("id", appt.id);

      // Intake is the source of truth — staff/chart pull from client_intake_submissions.

      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e: any) {
    return json({ error: e?.message ?? "Server error" }, 500);
  }
});
