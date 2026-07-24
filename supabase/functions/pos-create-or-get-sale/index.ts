// Get-or-create a draft sale for an appointment (or an ad-hoc walk-in sale).
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders, errorResponse, json, requireStaff, recomputeTotals } from "../_shared/pos.ts";

const Body = z.object({
  appointmentId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  clientEmail: z.string().email().optional(),
  clientFirstName: z.string().optional(),
  clientLastName: z.string().optional(),
  clientPhone: z.string().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Invalid input");

  const { supa, user } = auth;
  let { appointmentId, locationId, clientEmail, clientFirstName, clientLastName, clientPhone } = parsed.data;

  // If linked to an appointment, look up details
  let appointment: any = null;
  if (appointmentId) {
    const { data: appt } = await supa.from("appointments").select("*").eq("id", appointmentId).maybeSingle();
    if (!appt) return errorResponse("Appointment not found", 404);
    appointment = appt;
    locationId = appt.location_id;
    clientEmail = appt.client_email;
    clientFirstName = appt.client_first_name;
    clientLastName = appt.client_last_name;
    clientPhone = appt.client_phone;

    // Return existing draft if present
    const { data: existing } = await supa
      .from("sales")
      .select("id")
      .eq("appointment_id", appointmentId)
      .in("status", ["draft", "pending_payment"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (existing && existing.length) {
      return json({ saleId: existing[0].id, existing: true });
    }
  }

  if (!locationId) return errorResponse("locationId required");

  // Get location for processing fee + tip default
  const { data: loc } = await supa.from("locations").select("processing_fee_pct, tip_enabled").eq("id", locationId).maybeSingle();
  const processingFeePct = Number(loc?.processing_fee_pct ?? 3.5);

  // Create sale
  const { data: sale, error: serr } = await supa.from("sales").insert({
    appointment_id: appointmentId ?? null,
    client_email: clientEmail ?? null,
    client_first_name: clientFirstName ?? null,
    client_last_name: clientLastName ?? null,
    client_phone: clientPhone ?? null,
    location_id: locationId,
    staff_id: appointment?.staff_id ?? null,
    cashier_user_id: user.id,
    status: "draft",
  }).select("*").single();
  if (serr) return errorResponse(serr.message);

  // Pre-load services from appointment
  if (appointmentId) {
    const { data: apsv } = await supa
      .from("appointment_services")
      .select("service_id, services(name, price_cents, tippable)")
      .eq("appointment_id", appointmentId)
      .order("display_order", { ascending: true });

    // Load all unit-priced services so we can prefer them for injectables
    const { data: allUnits } = await supa
      .from("unit_services")
      .select("service_id, price_per_unit_cents, unit_label, services(name)")
      .eq("is_active", true);
    const unitsByServiceId = new Map<string, any>();
    for (const u of allUnits ?? []) unitsByServiceId.set(u.service_id, u);
    const neurotoxin = (allUnits ?? []).find((u: any) =>
      (u.services?.name ?? "").toLowerCase().includes("neurotoxin")
    );
    const INJECTABLE_RX = /(botox|dysport|jeuveau|xeomin|neurotox|tox\b)/i;

    const items: any[] = [];
    const seen = new Set<string>();
    (apsv ?? []).forEach((row: any, idx: number) => {
      const s = row.services;
      const name = s?.name ?? "Service";

      // Per-unit replacement: this service has unit pricing
      const unit = unitsByServiceId.get(row.service_id) ??
        (INJECTABLE_RX.test(name) ? neurotoxin : null);

      if (unit) {
        const key = `u-${unit.service_id}`;
        if (seen.has(key)) return;
        seen.add(key);
        items.push({
          sale_id: sale.id,
          kind: "unit_service",
          reference_id: unit.service_id,
          label: `${unit.services?.name} (0 ${unit.unit_label})`,
          quantity: 0,
          unit_price_cents: unit.price_per_unit_cents,
          line_total_cents: 0,
          taxable: false,
          tippable: true,
          display_order: idx,
          metadata: { unit_label: unit.unit_label, units: 0, needs_unit_input: true },
        });
        return;
      }

      const key = `s-${row.service_id}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({
        sale_id: sale.id,
        kind: "service",
        reference_id: row.service_id,
        label: name,
        quantity: 1,
        unit_price_cents: s?.price_cents ?? 0,
        line_total_cents: s?.price_cents ?? 0,
        taxable: false,
        tippable: s?.tippable ?? true,
        display_order: idx,
        metadata: {},
      });
    });
    if (items.length) await supa.from("sale_items").insert(items);
  }

  // Recompute & save
  const { data: items } = await supa.from("sale_items").select("*").eq("sale_id", sale.id);
  const totals = recomputeTotals({
    items: (items ?? []) as any,
    processingFeePct,
  });
  await supa.from("sales").update(totals).eq("id", sale.id);

  return json({ saleId: sale.id, existing: false });
});
