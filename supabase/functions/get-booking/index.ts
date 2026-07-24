// Public read of a single appointment by public_token (for client status page).
// Returns appointment basics, all booked services, and consent status (assigned forms,
// signed flag, and which procedures require each form).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token || token.length < 16) return json({ error: "Invalid token" }, 400);

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: appt, error } = await supa.from("appointments").select(`
    id, public_token, status, start_at, end_at, client_first_name, client_last_name, denial_reason,
    service_id, staff_id, location_id,
    services(name), staff_profiles(full_name, title), locations(name, address, city, state, zip)
  `).eq("public_token", token).maybeSingle();
  if (error || !appt) return json({ error: "Not found" }, 404);

  // All booked services on this appointment (multi-service support)
  const { data: apsv } = await supa
    .from("appointment_services")
    .select("service_id, display_order, services(id, name)")
    .eq("appointment_id", appt.id)
    .order("display_order", { ascending: true });
  const services_list = (apsv ?? []).map((r: any) => ({
    id: r.service_id,
    name: r.services?.name ?? "",
  }));
  // Fallback to the primary service if appointment_services rows are missing
  if (services_list.length === 0 && appt.service_id) {
    services_list.push({ id: appt.service_id, name: (appt as any).services?.name ?? "" });
  }
  const serviceIds = services_list.map((s) => s.id).filter(Boolean);

  // Assigned consents for this appointment
  const { data: assigned } = await supa
    .from("appointment_consents")
    .select("consent_form_id, signed, consent_forms!inner(id, title, is_optional, is_active, is_universal)")
    .eq("appointment_id", appt.id);

  // Map: form_id -> [service names] requiring it (universal forms apply to all services)
  const serviceConsentMap = new Map<string, Set<string>>();
  if (serviceIds.length) {
    const { data: scLinks } = await supa
      .from("service_consents")
      .select("service_id, consent_form_id")
      .in("service_id", serviceIds);
    const nameById = new Map(services_list.map((s) => [s.id, s.name]));
    for (const r of scLinks ?? []) {
      const set = serviceConsentMap.get(r.consent_form_id) ?? new Set<string>();
      set.add(nameById.get(r.service_id) ?? "");
      serviceConsentMap.set(r.consent_form_id, set);
    }
  }
  const allServiceNames = services_list.map((s) => s.name).filter(Boolean);

  const consents = (assigned ?? [])
    .filter((r: any) => r.consent_forms?.is_active)
    .map((r: any) => {
      const cf = r.consent_forms;
      const procedureNames = cf.is_universal
        ? allServiceNames
        : Array.from(serviceConsentMap.get(cf.id) ?? []);
      return {
        id: cf.id,
        title: cf.title,
        is_optional: !!cf.is_optional,
        is_universal: !!cf.is_universal,
        signed: !!r.signed,
        procedures: procedureNames,
      };
    })
    .sort((a, b) => Number(a.signed) - Number(b.signed) || a.title.localeCompare(b.title));

  const required_unsigned = consents.filter((c) => !c.signed && !c.is_optional).length;
  const optional_unsigned = consents.filter((c) => !c.signed && c.is_optional).length;

  return json({
    ...appt,
    services_list,
    consents,
    consents_summary: {
      total: consents.length,
      signed: consents.filter((c) => c.signed).length,
      required_unsigned,
      optional_unsigned,
    },
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
