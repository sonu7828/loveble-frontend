// Register a Stripe Terminal reader (S710) for a location.
// Admin-only. Creates the Stripe terminal location on demand if missing.
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders, errorResponse, json, requireStaff, currentEnv } from "../_shared/pos.ts";
import { createStripeClient } from "../_shared/stripe.ts";

const Body = z.object({
  locationId: z.string().uuid(),
  registrationCode: z.string().min(3).max(100),
  label: z.string().min(1).max(100),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;
  if (!auth.roles.has("admin")) return errorResponse("Admin only", 403);

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Invalid input");
  const { locationId, registrationCode, label } = parsed.data;

  const { supa, user } = auth;
  const { data: loc } = await supa.from("locations").select("*").eq("id", locationId).maybeSingle();
  if (!loc) return errorResponse("Location not found", 404);

  const env = currentEnv();
  const stripe = createStripeClient(env);

  // Ensure Stripe Terminal Location exists
  let stripeLocationId = loc.stripe_terminal_location_id;
  if (!stripeLocationId) {
    const tloc = await stripe.terminal.locations.create({
      display_name: loc.name,
      address: {
        line1: loc.address ?? "",
        city: loc.city ?? "",
        state: loc.state ?? "",
        postal_code: loc.zip ?? "",
        country: "US",
      },
    });
    stripeLocationId = tloc.id;
    await supa.from("locations").update({ stripe_terminal_location_id: stripeLocationId }).eq("id", locationId);
  }

  try {
    const reader = await stripe.terminal.readers.create({
      registration_code: registrationCode.trim(),
      location: stripeLocationId,
      label,
    });

    const { data: row, error } = await supa.from("terminal_readers").insert({
      location_id: locationId,
      label,
      stripe_reader_id: reader.id,
      device_type: reader.device_type,
      serial_number: reader.serial_number,
      status: reader.status ?? "offline",
      registered_by: user.id,
    }).select("*").single();
    if (error) return errorResponse(error.message);

    return json({ reader: row });
  } catch (e: any) {
    return errorResponse(`Stripe: ${e.message}`);
  }
});
