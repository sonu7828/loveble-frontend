// Staff ad-hoc SMS to any client by email (no appointment required).
// Looks up phone from client_profiles or most recent appointment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await userClient.auth.getUser();
    const user = ures?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
    const ok = (roles ?? []).some((r: any) => ["admin", "staff", "scheduler", "receptionist"].includes(r.role));
    if (!ok) return json({ error: "forbidden" }, 403);

    const { clientEmail, phone: phoneIn, message, appointmentId } = await req.json();
    if (!message || typeof message !== "string") return json({ error: "message required" }, 400);
    if (message.length > 320) return json({ error: "message too long (max 320 chars)" }, 400);
    if (!clientEmail && !phoneIn) return json({ error: "clientEmail or phone required" }, 400);

    const supa = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let phone = (phoneIn ?? "").trim();
    let email = (clientEmail ?? "").trim().toLowerCase();

    if (!phone && email) {
      const { data: prof } = await supa.from("client_profiles").select("phone").eq("email", email).maybeSingle();
      phone = (prof as any)?.phone ?? "";
      if (!phone) {
        const { data: appt } = await supa.from("appointments")
          .select("client_phone").eq("client_email", email)
          .not("client_phone", "is", null)
          .order("start_at", { ascending: false }).limit(1).maybeSingle();
        phone = (appt as any)?.client_phone ?? "";
      }
    }
    if (!phone) return json({ error: "no phone on file for client" }, 400);

    const res = await supa.functions.invoke("send-sms-via-ghl", {
      body: {
        appointmentId: appointmentId ?? null,
        phone,
        clientEmail: email || undefined,
        template: "staff-direct",
        body: message.trim(),
        createdBy: user.id,
        skipOptInCheck: true,
      },
    });
    if ((res as any)?.error) return json({ error: (res as any).error.message ?? "send failed" }, 502);
    return json((res as any)?.data ?? {});
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
