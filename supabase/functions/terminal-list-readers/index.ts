// List Stripe Terminal readers for a location (or all).
import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders, errorResponse, json, requireStaff } from "../_shared/pos.ts";

const Body = z.object({ locationId: z.string().uuid().optional() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Invalid input");

  let q = auth.supa.from("terminal_readers").select("*").order("created_at", { ascending: false });
  if (parsed.data.locationId) q = q.eq("location_id", parsed.data.locationId);
  const { data, error } = await q;
  if (error) return errorResponse(error.message);
  return json({ readers: data ?? [] });
});
