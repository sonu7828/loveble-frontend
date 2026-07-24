// Centralized consent validation. Single source of truth for "which consent
// forms must this client still sign for this appointment?".
//
// Rules:
//   - Universal active forms are always required.
//   - service_consents add per-service requirements, unless services.skip_consents is true.
//   - A required form is "satisfied" by a prior consent_signatures row when:
//       * client_email (case-insensitive) matches AND
//       * form_version matches current consent_forms.version AND
//       * decision = 'consent' AND
//       * expires_at IS NULL OR expires_at > asOf AND
//       * if form.consent_scope = 'per_treatment', the client must have a prior
//         appointment_services row for one of the current serviceIds.

export type ConsentForm = {
  id: string;
  slug: string;
  title: string;
  version: number;
  is_universal: boolean;
  is_optional: boolean;
  consent_scope: "annual" | "per_treatment" | "perpetual";
  validity_months: number | null;
  body_markdown?: string;
};

export type SatisfiedSignature = {
  id: string;
  consent_form_id: string;
  signed_at: string;
  expires_at: string | null;
  source_appointment_id: string | null;
};

export type ValidationResult = {
  requiredForms: ConsentForm[];
  satisfied: Map<string, SatisfiedSignature>;
  missing: ConsentForm[];
};

export async function computeMissingConsents(
  supa: any,
  opts: {
    clientEmail: string;
    serviceIds: string[];
    appointmentId?: string;
    asOf?: Date;
  },
): Promise<ValidationResult> {
  const asOf = opts.asOf ?? new Date();
  const cleanEmail = String(opts.clientEmail || "").trim().toLowerCase();
  const serviceIds = (opts.serviceIds ?? []).filter(Boolean);

  // 1) Resolve which services participate (drop skip_consents)
  let consentServiceIds: string[] = [];
  if (serviceIds.length) {
    const { data: svcs } = await supa
      .from("services")
      .select("id, skip_consents")
      .in("id", serviceIds);
    consentServiceIds = (svcs ?? [])
      .filter((s: any) => !s.skip_consents)
      .map((s: any) => s.id);
  }

  // 2) Build required form set
  const [{ data: universal }, mapped] = await Promise.all([
    supa
      .from("consent_forms")
      .select("id, slug, title, version, is_universal, is_optional, consent_scope, validity_months, body_markdown")
      .eq("is_universal", true)
      .eq("is_active", true),
    consentServiceIds.length
      ? supa
          .from("service_consents")
          .select(
            "consent_form_id, consent_forms!inner(id, slug, title, version, is_universal, is_optional, is_active, consent_scope, validity_months, body_markdown)",
          )
          .in("service_id", consentServiceIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const formMap = new Map<string, ConsentForm>();
  for (const f of (universal ?? []) as ConsentForm[]) formMap.set(f.id, f);
  for (const r of (mapped.data ?? []) as any[]) {
    const f = r.consent_forms;
    if (f?.is_active && !f.is_universal) formMap.set(f.id, f as ConsentForm);
  }
  const requiredForms = [...formMap.values()];

  if (!requiredForms.length || !cleanEmail) {
    return { requiredForms, satisfied: new Map(), missing: requiredForms.slice() };
  }

  // 3) Pull all candidate prior signatures for this client + these forms
  const { data: sigs } = await supa
    .from("consent_signatures")
    .select("id, consent_form_id, form_version, decision, signed_at, expires_at, appointment_id")
    .eq("client_email", cleanEmail)
    .in("consent_form_id", requiredForms.map((f) => f.id))
    .order("signed_at", { ascending: false });

  // 4) For per_treatment forms we also need prior service history for this client
  let priorServiceIds = new Set<string>();
  const perTreatment = requiredForms.some((f) => f.consent_scope === "per_treatment");
  if (perTreatment && consentServiceIds.length) {
    const { data: history } = await supa
      .from("appointment_services")
      .select("service_id, appointments!inner(client_email, status, id)")
      .in("service_id", consentServiceIds)
      .eq("appointments.client_email", cleanEmail)
      .in("appointments.status", ["approved", "completed", "checked_in"]);
    for (const row of history ?? []) {
      // Exclude the current appointment itself
      if (opts.appointmentId && (row as any).appointments?.id === opts.appointmentId) continue;
      priorServiceIds.add((row as any).service_id);
    }
  }

  // 5) Match each required form against latest qualifying signature
  const satisfied = new Map<string, SatisfiedSignature>();
  for (const form of requiredForms) {
    const candidates = (sigs ?? []).filter((s: any) => s.consent_form_id === form.id);
    for (const s of candidates) {
      if (s.decision !== "consent") continue;
      if (s.form_version !== form.version) continue;
      if (s.expires_at && new Date(s.expires_at) <= asOf) continue;
      if (form.consent_scope === "per_treatment") {
        // Must have prior treatment history; signature_only doesn't count
        const hasHistory = consentServiceIds.some((sid) => priorServiceIds.has(sid));
        if (!hasHistory) continue;
      }
      satisfied.set(form.id, {
        id: s.id,
        consent_form_id: s.consent_form_id,
        signed_at: s.signed_at,
        expires_at: s.expires_at,
        source_appointment_id: s.appointment_id,
      });
      break;
    }
  }

  const missing = requiredForms.filter((f) => !satisfied.has(f.id));
  return { requiredForms, satisfied, missing };
}

/** Compute expires_at for a new signature based on form + global default. */
export function computeExpiresAt(
  form: { consent_scope: string; validity_months: number | null },
  defaultMonths: number,
  signedAt: Date = new Date(),
): string | null {
  if (form.consent_scope === "perpetual") return null;
  const months =
    form.validity_months ??
    (form.consent_scope === "annual" || form.consent_scope === "per_treatment" ? defaultMonths : 12);
  if (!months || months <= 0) return null;
  const d = new Date(signedAt);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export async function getDefaultValidityMonths(supa: any): Promise<number> {
  const { data } = await supa
    .from("app_settings")
    .select("default_consent_validity_months")
    .eq("id", 1)
    .maybeSingle();
  return data?.default_consent_validity_months ?? 12;
}

export async function logValidation(
  supa: any,
  opts: {
    appointmentId: string;
    clientEmail: string;
    result: ValidationResult;
    source: string;
    extra?: Record<string, unknown>;
  },
) {
  try {
    await supa.from("consent_validation_log").insert({
      appointment_id: opts.appointmentId,
      client_email: opts.clientEmail.toLowerCase(),
      required_form_ids: opts.result.requiredForms.map((f) => f.id),
      satisfied_form_ids: [...opts.result.satisfied.keys()],
      missing_form_ids: opts.result.missing.map((f) => f.id),
      source: opts.source,
      decision: {
        satisfiedBy: Object.fromEntries(
          [...opts.result.satisfied.entries()].map(([formId, s]) => [
            formId,
            { signed_at: s.signed_at, expires_at: s.expires_at, appointment_id: s.source_appointment_id },
          ]),
        ),
        ...(opts.extra ?? {}),
      },
    });
  } catch (e) {
    console.error("consent_validation_log insert failed", e);
  }
}
