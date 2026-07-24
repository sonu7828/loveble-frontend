// Resend an updated receipt for a paid sale.
// Public verify_jwt=false; low-risk since it only re-sends an existing
// paid sale's receipt to the client_email already on the sale record.
// Uses a unique idempotency key so a prior send does not block the resend.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sendSaleReceiptIfNeeded } from "../_shared/send-sale-receipt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { saleId } = await req.json().catch(() => ({}));
  if (!saleId || typeof saleId !== "string") {
    return new Response(JSON.stringify({ error: "saleId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: sale } = await supa.from("sales").select("id,status,client_email").eq("id", saleId).maybeSingle();
  if (!sale) {
    return new Response(JSON.stringify({ error: "Sale not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (sale.status !== "paid" && sale.status !== "partially_refunded") {
    return new Response(JSON.stringify({ error: `Sale is ${sale.status}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!sale.client_email) {
    return new Response(JSON.stringify({ error: "No email on file" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  await supa.from("sales").update({ receipt_email_sent_at: null, receipt_url: null }).eq("id", saleId);

  const suffix = `corrected-${Date.now()}`;
  await sendSaleReceiptIfNeeded(supa, saleId, { keySuffix: suffix });

  return new Response(JSON.stringify({ ok: true, keySuffix: suffix }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
