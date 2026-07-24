// Sends a "new waitlist request" email to all admins (and the preferred staff if any).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const b = await req.json();
    if (!b?.waitlistId || !b?.clientEmail) {
      return json({ error: "Missing fields" }, 400);
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: adminRows } = await supa.from("user_roles").select("user_id").eq("role", "admin");
    const adminIds = (adminRows ?? []).map((r: any) => r.user_id);
    const recipients = new Set<string>();
    if (adminIds.length) {
      const { data: adminStaff } = await supa.from("staff_profiles")
        .select("email").in("user_id", adminIds);
      for (const s of adminStaff ?? []) {
        if (s.email) recipients.add(s.email.toLowerCase());
      }
    }

    await Promise.all([...recipients].map((to) =>
      supa.functions.invoke("send-transactional-email", {
        body: {
          templateName: "waitlist-notification",
          recipientEmail: to,
          idempotencyKey: `waitlist-notify-${b.waitlistId}-${to}`,
          templateData: {
            clientName: b.clientName,
            clientEmail: b.clientEmail,
            clientPhone: b.clientPhone,
            serviceName: b.serviceName,
            locationName: b.locationName,
            windowLabel: b.windowLabel,
            notes: b.notes,
          },
        },
      }).catch((e) => console.error("waitlist notify send failed", to, e))
    ));

    return json({ ok: true, sent: recipients.size });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
