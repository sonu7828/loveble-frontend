// Staff-callable: send post-op instructions email for an appointment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: ok } = await supa.rpc("is_staff_or_admin", { _user_id: user.id });
    const { data: ok2 } = ok ? { data: true } : await supa.rpc("is_scheduler_or_admin", { _user_id: user.id });
    if (!ok && !ok2) return json({ error: "Forbidden" }, 403);

    const { appointmentId, force } = await req.json().catch(() => ({}));
    if (!appointmentId) return json({ error: "appointmentId required" }, 400);

    const { data: appt, error: ae } = await supa
      .from("appointments")
      .select("id, client_first_name, client_email, service_id, post_op_sent_at, services(name)")
      .eq("id", appointmentId)
      .maybeSingle();
    if (ae || !appt) return json({ error: "Appointment not found" }, 404);
    if (!appt.client_email) return json({ error: "Client has no email" }, 400);

    // Gather all services on this appointment (multi-service bookings)
    const { data: addl } = await supa
      .from("appointment_services")
      .select("service_id, display_order, services(name)")
      .eq("appointment_id", appointmentId)
      .order("display_order");

    const serviceIds = Array.from(new Set([
      appt.service_id,
      ...(addl ?? []).map((r: any) => r.service_id),
    ].filter(Boolean)));

    const { data: postOps } = await supa
      .from("service_post_op_instructions")
      .select("service_id, title, body_markdown")
      .in("service_id", serviceIds);
    const byId = new Map((postOps ?? []).map((p: any) => [p.service_id, p]));

    const blocks: { name: string; title: string; body: string }[] = [];
    for (const sid of serviceIds) {
      const po = byId.get(sid);
      const sname = sid === appt.service_id
        ? (appt as any).services?.name
        : (addl ?? []).find((r: any) => r.service_id === sid)?.services?.name;
      // Guard: skip services whose post-op body is missing or empty — never send blank instructions.
      if (po && (po.body_markdown ?? "").trim()) {
        blocks.push({ name: sname ?? "Treatment", title: po.title, body: po.body_markdown });
      }
    }

    if (!blocks.length) return json({ error: "No post-op instructions configured for these services" }, 400);

    const serviceName = blocks.map((b) => b.name).join(" + ");
    const title = blocks.length === 1 ? blocks[0].title : "After-Care Instructions";
    const bodyMarkdown = blocks
      .map((b) => `## ${b.name}\n\n${b.body}`)
      .join("\n\n---\n\n");

    const { error: ee } = await supa.functions.invoke("send-transactional-email", {
      body: {
        templateName: "post-op-instructions",
        recipientEmail: appt.client_email,
        idempotencyKey: force ? `post-op-${appointmentId}-${Date.now()}` : `post-op-${appointmentId}`,
        templateData: {
          clientFirstName: appt.client_first_name ?? "there",
          serviceName,
          title,
          bodyMarkdown,
        },
      },
    });
    if (ee) return json({ error: ee.message ?? "Email failed" }, 500);

    await supa.from("appointments").update({ post_op_sent_at: new Date().toISOString() }).eq("id", appointmentId);

    return json({ ok: true, blocks });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
