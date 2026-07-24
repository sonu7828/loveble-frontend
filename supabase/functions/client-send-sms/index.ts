// Client portal → send an SMS to the medspa. Requires the client's JWT.
// Resolves the client's phone from their profile, sends via the existing GHL
// integration with skipOptInCheck=true (the client is initiating), and writes
// the outbound row to sms_messages.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });

    const { data: ures } = await userClient.auth.getUser();
    const user = ures?.user;
    if (!user?.email) return json({ error: "unauthorized" }, 401);
    const clientEmail = user.email.toLowerCase();

    const { message, appointmentId } = await req.json().catch(() => ({}));
    if (!message || typeof message !== "string") return json({ error: "message required" }, 400);
    const trimmed = message.trim();
    if (!trimmed) return json({ error: "message empty" }, 400);
    if (trimmed.length > 320) return json({ error: "message too long (max 320 chars)" }, 400);

    const supa = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: profile } = await supa
      .from("client_profiles")
      .select("phone, first_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const phone = (profile?.phone || "").trim();
    if (!phone) return json({ error: "Please add a phone number to your profile before sending." }, 400);

    // Prefix the client's first name so staff knows who texted (helps when GHL
    // contact isn't matched on their end).
    const prefix = profile?.first_name ? `[${profile.first_name}]: ` : "";
    const sendBody = `${prefix}${trimmed}`;

    const res = await supa.functions.invoke("send-sms-via-ghl", {
      body: {
        phone,
        clientEmail,
        appointmentId: appointmentId ?? null,
        template: "client-reply",
        body: sendBody,
        createdBy: user.id,
        skipOptInCheck: true,
        appendStopFooter: false,
      },
    });
    if ((res as any)?.error) return json({ error: (res as any).error.message ?? "send failed" }, 502);
    const payload = (res as any)?.data ?? {};
    if (payload?.error) return json({ error: payload.error }, 502);

    const { data: inserted, error: insErr } = await supa.from("sms_messages").insert({
      client_email: clientEmail,
      phone,
      appointment_id: appointmentId ?? null,
      direction: "outbound",
      body: trimmed,
      ghl_message_id: payload?.messageId ?? null,
      sender_role: "client",
      created_by: user.id,
    }).select("id").maybeSingle();
    if (insErr) console.error("client-send-sms: thread insert failed", insErr);

    return json({ ok: true, messageId: payload?.messageId ?? null, threadRowId: inserted?.id ?? null });
  } catch (e) {
    console.error("client-send-sms error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
