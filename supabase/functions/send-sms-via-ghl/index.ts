// Internal helper: sends an SMS via GoHighLevel conversations API, gated on
// appointment.sms_opt_in (or a force flag for transactional confirmations the
// client explicitly opted into). Logs every attempt to sms_send_log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GHL_BASE = "https://services.leadconnectorhq.com";
const STOP_FOOTER = " Reply STOP to opt out.";

type Body = {
  appointmentId?: string;
  phone?: string;
  clientEmail?: string;
  body: string;
  template: string;
  createdBy?: string;
  skipOptInCheck?: boolean;
  appendStopFooter?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = Deno.env.get("GHL_PRIVATE_TOKEN");
    const locationId = Deno.env.get("GHL_LOCATION_ID");
    if (!token || !locationId) return json({ error: "GHL not configured" }, 500);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const input = (await req.json()) as Body;
    if (!input?.body || !input?.template) return json({ error: "body and template are required" }, 400);

    let appt: any = null;
    if (input.appointmentId) {
      const { data } = await supa.from("appointments")
        .select("id, sms_opt_in, client_phone, client_email")
        .eq("id", input.appointmentId).maybeSingle();
      appt = data;
    }

    const phone = (input.phone || appt?.client_phone || "").trim();
    const clientEmail = (input.clientEmail || appt?.client_email || "").trim().toLowerCase();
    if (!phone) {
      await logRow(supa, input, phone, clientEmail, null, "failed", "missing phone");
      return json({ error: "missing phone" }, 400);
    }

    if (!input.skipOptInCheck) {
      const optedIn = !!appt?.sms_opt_in;
      if (!optedIn) {
        await logRow(supa, input, phone, clientEmail, null, "skipped", "not opted in");
        return json({ skipped: true, reason: "not_opted_in" }, 200);
      }
    }

    const messageBody = input.appendStopFooter === false ? input.body : `${input.body}${STOP_FOOTER}`;

    // Lookup contactId by phone (GHL requires a contactId for conversations/messages)
    let contactId: string | null = null;
    try {
      const lookup = await fetch(`${GHL_BASE}/contacts/?locationId=${locationId}&query=${encodeURIComponent(phone)}`, {
        headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" },
      });
      const lj = await lookup.json().catch(() => ({}));
      const contacts = lj?.contacts ?? [];
      contactId = contacts?.[0]?.id ?? null;
    } catch {}

    // If no contact found, upsert one
    if (!contactId) {
      try {
        const up = await fetch(`${GHL_BASE}/contacts/upsert`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`, Version: "2021-07-28",
            Accept: "application/json", "Content-Type": "application/json",
          },
          body: JSON.stringify({ locationId, phone, email: clientEmail || undefined, source: "rkabook.com sms" }),
        });
        const uj = await up.json().catch(() => ({}));
        contactId = uj?.contact?.id ?? uj?.id ?? null;
      } catch {}
    }

    if (!contactId) {
      await logRow(supa, input, phone, clientEmail, null, "failed", "contact lookup/upsert failed");
      return json({ error: "could not resolve GHL contact" }, 502);
    }

    const sendRes = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`, Version: "2021-04-15",
        Accept: "application/json", "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "SMS", contactId, message: messageBody }),
    });
    const sendJson = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok) {
      await logRow(supa, input, phone, clientEmail, null, "failed", JSON.stringify(sendJson).slice(0, 500));
      return json({ error: "send failed", details: sendJson }, 502);
    }

    const messageId = sendJson?.messageId ?? sendJson?.id ?? null;
    await logRow(supa, input, phone, clientEmail, messageId, "sent", null, messageBody);

    // Mirror into the two-way thread, unless the caller is the client portal
    // (client-send-sms already inserts its own row with sender_role='client').
    if (clientEmail && input.template !== "client-reply") {
      try {
        await supa.from("sms_messages").insert({
          client_email: clientEmail,
          phone,
          appointment_id: input.appointmentId ?? null,
          direction: "outbound",
          body: messageBody,
          ghl_message_id: messageId,
          sender_role: "staff",
          created_by: input.createdBy ?? null,
        });
      } catch (e) { console.error("sms_messages mirror insert failed", e); }
    }

    return json({ ok: true, messageId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

async function logRow(
  supa: ReturnType<typeof createClient>,
  input: Body, phone: string, clientEmail: string,
  messageId: string | null, status: string, error: string | null, finalBody?: string,
) {
  try {
    await supa.from("sms_send_log").insert({
      appointment_id: input.appointmentId ?? null,
      client_email: clientEmail || null,
      phone: phone || null,
      template: input.template,
      body: finalBody ?? input.body,
      ghl_message_id: messageId,
      status, error,
      created_by: input.createdBy ?? null,
    });
  } catch (e) { console.error("sms log insert failed", e); }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
