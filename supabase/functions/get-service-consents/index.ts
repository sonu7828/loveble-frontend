// Returns required consent forms for a service, marking which are already satisfied
// by a prior valid signature for the given email (version match + not expired +
// per-treatment history rule).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { computeMissingConsents } from "../_shared/consent-validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const serviceIds: string[] = Array.isArray(body?.serviceIds) && body.serviceIds.length > 0
      ? body.serviceIds.filter((x: any) => typeof x === "string" && x)
      : (body?.serviceId ? [body.serviceId] : []);
    const email = body?.email;
    if (serviceIds.length === 0) return json({ error: "serviceId(s) required" }, 400);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const result = await computeMissingConsents(supa, {
      clientEmail: email || "",
      serviceIds,
    });

    return json({
      forms: result.requiredForms.map((f) => ({
        id: f.id,
        slug: f.slug,
        title: f.title,
        body_markdown: f.body_markdown,
        version: f.version,
        is_universal: f.is_universal,
        is_optional: !!f.is_optional,
        consent_scope: f.consent_scope,
        validity_months: f.validity_months,
        alreadySigned: result.satisfied.has(f.id),
        validUntil: result.satisfied.get(f.id)?.expires_at ?? null,
      })),
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
