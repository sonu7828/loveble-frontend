// Public GHL inbound SMS webhook. No JWT.
// GHL → POST here whenever a contact replies. We match by phone, write a row
// in sms_messages. If the body is STOP/UNSUBSCRIBE we also flip the client's
// SMS opt-in off. We always 200 unless the payload is malformed, to avoid
// GHL retry loops on harmless cases (e.g. unknown phone).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normPhone(p?: string | null): string {
  if (!p) return "";
  const d = p.replace(/\D+/g, "");
  return d.startsWith("1") && d.length === 11 ? d.slice(1) : d;
}

function pickStr(obj: any, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

async function verifyHmac(secret: string, body: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const provided = signature.replace(/^sha256=/i, "").trim().toLowerCase();
    // Constant-time compare
    if (hex.length !== provided.length) return false;
    let mismatch = 0;
    for (let i = 0; i < hex.length; i++) mismatch |= hex.charCodeAt(i) ^ provided.charCodeAt(i);
    return mismatch === 0;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // Read body once so we can both verify HMAC and parse JSON.
  const rawBody = await req.text();

  // HMAC verification — required when GHL_WEBHOOK_SECRET is configured.
  // If the secret is missing, log a loud warning so it's obvious in ops.
  const secret = Deno.env.get("GHL_WEBHOOK_SECRET");
  if (secret) {
    const sig = req.headers.get("x-ghl-signature") || req.headers.get("x-webhook-signature") || "";
    if (!sig || !(await verifyHmac(secret, rawBody, sig))) {
      console.warn("[ghl-sms-webhook] HMAC verification failed");
      return json({ error: "Unauthorized" }, 401);
    }
  } else {
    console.warn("[ghl-sms-webhook] GHL_WEBHOOK_SECRET not configured — accepting unsigned webhook (INSECURE)");
  }

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "invalid json" }, 400); }

  console.log("ghl-sms-webhook payload", JSON.stringify(payload).slice(0, 2000));

  // GHL "Inbound Message" trigger payload shapes vary; tolerate both flat & nested.
  const root = payload?.message ?? payload;
  const contact = payload?.contact ?? root?.contact ?? {};
  const type = (pickStr(root, "type", "messageType") || "SMS").toUpperCase();
  const direction = (pickStr(root, "direction") || "inbound").toLowerCase();
  if (type !== "SMS" || direction !== "inbound") {
    return json({ ok: true, skipped: "not inbound sms" });
  }

  const body = pickStr(root, "body", "message", "messageBody", "text", "lastMessageBody")
    || pickStr(payload, "body", "message", "messageBody", "text", "lastMessageBody")
    || "";
  const phoneRaw = pickStr(root, "phone", "from", "fromNumber", "contactPhone", "contact_phone")
    || pickStr(payload, "phone", "from", "fromNumber", "contactPhone", "contact_phone")
    || pickStr(contact, "phone", "phoneNumber", "contact_phone");
  const ghlMessageId = pickStr(root, "messageId", "id", "message_id");
  const ghlContactId = pickStr(root, "contactId", "contact_id")
    || pickStr(payload, "contactId", "contact_id")
    || pickStr(contact, "id", "contactId", "contact_id");
  const emailRaw = pickStr(root, "email") || pickStr(payload, "email") || pickStr(contact, "email");
  const phone = normPhone(phoneRaw);

  if (!body || (!phone && !emailRaw && !ghlContactId)) {
    console.warn("ghl-sms-webhook: missing body/identifier", { phoneRaw, hasBody: !!body, emailRaw, ghlContactId });
    return json({ ok: true, skipped: "missing body or identifier" });
  }

  // Match a client by email, then phone last-10.
  let clientEmail: string | null = null;
  let appointmentId: string | null = null;

  if (emailRaw) {
    const e = emailRaw.toLowerCase();
    const { data: p } = await supa.from("client_profiles").select("email").eq("email", e).maybeSingle();
    if (p?.email) clientEmail = e;
  }

  if (!clientEmail && phone) {
    const last10 = phone.slice(-10);
    const { data: profiles } = await supa
      .from("client_profiles").select("email, phone").not("phone", "is", null);
    const profMatch = (profiles ?? []).find((p: any) => normPhone(p.phone).endsWith(last10));
    if (profMatch?.email) clientEmail = String(profMatch.email).toLowerCase();

    if (!clientEmail) {
      const { data: appts } = await supa
        .from("appointments")
        .select("id, client_email, client_phone, start_at")
        .order("start_at", { ascending: false }).limit(500);
      const apptMatch = (appts ?? []).find((a: any) => normPhone(a.client_phone).endsWith(last10));
      if (apptMatch) {
        clientEmail = String(apptMatch.client_email).toLowerCase();
        appointmentId = apptMatch.id;
      }
    }
  }

  if (clientEmail && !appointmentId) {
    const { data: appt } = await supa.from("appointments").select("id")
      .eq("client_email", clientEmail).order("start_at", { ascending: false }).limit(1).maybeSingle();
    appointmentId = appt?.id ?? null;
  }

  if (!clientEmail) {
    console.warn("ghl-sms-webhook: no client matched", { phone, emailRaw, ghlContactId });
    // Still record the inbound message under a synthetic email so it's not lost
    clientEmail = emailRaw?.toLowerCase() || `unknown+${phone || ghlContactId || "x"}@sms.local`;
  }

  // STOP handling
  const norm = body.trim().toUpperCase();
  if (["STOP", "UNSUBSCRIBE", "STOPALL", "CANCEL", "END", "QUIT"].includes(norm)) {
    await supa.from("client_profiles").update({ sms_opt_in: false, sms_opt_in_at: null })
      .eq("email", clientEmail);
  }

  const { error } = await supa.from("sms_messages").insert({
    client_email: clientEmail,
    phone: phoneRaw ?? phone,
    appointment_id: appointmentId,
    direction: "inbound",
    body,
    ghl_message_id: ghlMessageId ?? null,
    ghl_contact_id: ghlContactId ?? null,
    sender_role: "client",
  });
  if (error) {
    console.error("insert sms_messages failed", error);
    return json({ error: error.message }, 500);
  }

  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
