// Issue (sell or comp) a voucher / gift card. Admin only. 60-day expiry.
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders, errorResponse, json, requireStaff } from "../_shared/pos.ts";

const Entitlement = z.object({
  service_id: z.string().uuid().optional(),
  service_name: z.string().min(1).max(160),
  quantity: z.number().min(0.5).max(500),
  unit_label: z.string().max(40).optional(), // "units", "pen", "session", "syringe"
});

const Body = z.object({
  amountCents: z.number().int().min(0).max(1000000),
  issuedToEmail: z.string().email().optional(),
  issuedToName: z.string().max(120).optional(),
  source: z.enum(["purchased", "comp", "refund_credit"]).default("comp"),
  notes: z.string().max(500).optional(),
  code: z.string().min(4).max(50).optional(),
  locationId: z.string().uuid().optional(),
  entitlements: z.array(Entitlement).max(20).default([]),
});

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let s = "GC-";
  for (let i = 0; i < 8; i++) s += chars[bytes[i] % chars.length];
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;

  if (!auth.roles.has("admin")) {
    return errorResponse("Only admins can issue vouchers or gift cards", 403);
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Invalid input: " + JSON.stringify(parsed.error.flatten().fieldErrors));
  const p = parsed.data;

  if (p.amountCents < 1 && p.entitlements.length === 0) {
    return errorResponse("Provide an amount or at least one service entitlement");
  }

  const code = (p.code ?? genCode()).toUpperCase();
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  // Service vouchers without a dollar value still need a positive amount for the existing CHECK constraint.
  const amount = Math.max(1, p.amountCents);

  const { data, error } = await auth.supa.from("vouchers").insert({
    code,
    original_amount_cents: amount,
    balance_cents: amount,
    issued_to_email: p.issuedToEmail ?? null,
    issued_to_name: p.issuedToName ?? null,
    issued_by: auth.user.id,
    source: p.source,
    expires_at: expiresAt,
    notes: p.notes ?? null,
    location_id: p.locationId ?? null,
    entitlements: p.entitlements,
  }).select("*").single();
  if (error) return errorResponse(error.message);
  return json({ voucher: data });
});
