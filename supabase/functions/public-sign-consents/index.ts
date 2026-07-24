// Public endpoint: client signs assigned consent forms via their booking public_token.
// GET  ?token=xxx                          -> returns appointment + assigned forms (with body)
// POST { token, signatures: [...] }        -> persists signatures, marks assignments signed, regenerates PDF
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { computeExpiresAt, getDefaultValidityMonths } from "../_shared/consent-validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      const includeSigned = url.searchParams.get("includeSigned") === "1";
      if (!token || token.length < 16) return json({ error: "Invalid token" }, 400);
      const { data: appt } = await supa.from("appointments")
        .select("id, client_first_name, client_last_name, client_email, status, start_at, services(name)")
        .eq("public_token", token).maybeSingle();
      if (!appt) return json({ error: "Not found" }, 404);

      const { data: assigned } = await supa.from("appointment_consents")
        .select("consent_form_id, signed, consent_forms!inner(id, title, slug, body_markdown, version, is_active, is_optional)")
        .eq("appointment_id", appt.id);

      const activeAssigned = (assigned ?? []).filter((r: any) => r.consent_forms?.is_active);
      const { data: priorSigs } = activeAssigned.length ? await supa.from("consent_signatures")
        .select("consent_form_id, form_version, decision, expires_at")
        .eq("client_email", String(appt.client_email ?? "").toLowerCase())
        .in("consent_form_id", activeAssigned.map((r: any) => r.consent_form_id)) : { data: [] };
      const nowIso = new Date().toISOString();
      const satisfied = new Set<string>();
      for (const r of activeAssigned as any[]) {
        const cf = r.consent_forms;
        const hit = (priorSigs ?? []).find((s: any) =>
          s.consent_form_id === cf.id &&
          s.decision === "consent" &&
          s.form_version === cf.version &&
          (!s.expires_at || s.expires_at > nowIso)
        );
        if (r.signed || hit) satisfied.add(cf.id);
      }

      const forms = activeAssigned
        .filter((r: any) => includeSigned || !satisfied.has(r.consent_forms.id))
        .map((r: any) => ({
          id: r.consent_forms.id,
          slug: r.consent_forms.slug,
          title: r.consent_forms.title,
          version: r.consent_forms.version,
          body_markdown: r.consent_forms.body_markdown,
          is_optional: r.consent_forms.is_optional,
          already_signed: satisfied.has(r.consent_forms.id),
        }));
      return json({ appointment: appt, forms });
    }

    if (req.method === "POST") {
      const { token, signatures, signingMode, witnessName } = await req.json();
      if (!token || !Array.isArray(signatures) || !signatures.length) return json({ error: "Invalid input" }, 400);
      const { data: appt } = await supa.from("appointments")
        .select("id, client_email, client_first_name, services(name)").eq("public_token", token).maybeSingle();
      if (!appt) return json({ error: "Not found" }, 404);

      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const ua = req.headers.get("user-agent") ?? null;
      const mode = signingMode === "in_person_kiosk" || signingMode === "staff_assisted" ? signingMode : "remote";

      const defaultMonths = await getDefaultValidityMonths(supa);
      const now = new Date();
      for (const s of signatures) {
        if (!s.consentFormId || !s.signedFullName) continue;
        const { data: form } = await supa.from("consent_forms")
          .select("id, version, is_optional, consent_scope, validity_months")
          .eq("id", s.consentFormId).single();
        if (!form) continue;
        const decision = s.decision === "decline" ? "decline" : "consent";
        if (decision === "decline" && !form.is_optional) continue;
        await supa.from("consent_signatures").insert({
          appointment_id: appt.id,
          consent_form_id: form.id,
          form_version: form.version,
          client_email: appt.client_email,
          signed_full_name: s.signedFullName,
          signature_png: decision === "consent" ? s.signaturePng : null,
          decision,
          ip_address: ip,
          user_agent: ua,
          expires_at: decision === "consent" ? computeExpiresAt(form as any, defaultMonths, now) : null,
          attestation_flags: s.attestationFlags ?? {},
          client_attested_review: !!s.clientAttestedReview,
          signing_mode: mode,
          witness_name: mode !== "remote" ? (witnessName ?? null) : null,
          witness_signed_at: mode !== "remote" && witnessName ? new Date().toISOString() : null,
        });
        await supa.from("appointment_consents").update({ signed: true })
          .eq("appointment_id", appt.id).eq("consent_form_id", form.id);
      }

      // Regenerate PDF receipt and email a copy to the client
      let pdfUrl: string | undefined;
      try {
        const { data: pdfData } = await supa.functions.invoke("generate-consent-pdf", { body: { appointmentId: appt.id } });
        pdfUrl = pdfData?.url;
      } catch (e) { console.error("pdf regen failed", e); }

      try {
        if (appt.client_email) {
          await supa.functions.invoke("send-transactional-email", {
            body: {
              templateName: "consent-receipt",
              recipientEmail: appt.client_email,
              idempotencyKey: `consent-receipt-${appt.id}-${Date.now()}`,
              templateData: {
                clientName: (appt as any).client_first_name,
                serviceName: (appt as any).services?.name,
                pdfUrl: pdfUrl ?? "",
              },
            },
          });
        }
      } catch (e) { console.error("consent receipt email failed", e); }

      return json({ ok: true, pdfUrl });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
