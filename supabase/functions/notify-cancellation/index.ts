// Sends cancellation emails (client confirmation + staff/admin notifications)
// for an appointment that was just cancelled. Called from the browser by
// either a signed-in client (cancelling their own) or staff (cancelling any).
// Body: { appointmentId: string; reason?: string; cancelledBy?: "client" | "staff" }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { appointmentId, reason, cancelledBy } = await req.json();
    if (!appointmentId) return json({ error: "Missing appointmentId" }, 400);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: appt } = await supa.from("appointments").select("*").eq("id", appointmentId).maybeSingle();
    if (!appt) return json({ error: "Not found" }, 404);

    // Authorization: client owner OR staff/admin/scheduler
    const userEmail = (user.email ?? "").toLowerCase();
    const isOwner = userEmail && userEmail === (appt.client_email ?? "").toLowerCase();
    const { data: priv } = await supa.rpc("is_scheduler_or_admin", { _user_id: user.id });
    const { data: staffRole } = await supa.rpc("is_staff_or_admin", { _user_id: user.id });
    if (!isOwner && !priv && !staffRole) return json({ error: "Forbidden" }, 403);

    const hoursUntil = (new Date(appt.start_at).getTime() - Date.now()) / 3600000;
    const lateCancel = hoursUntil < 48;

    const [{ data: svc }, { data: stf }, { data: loc }, { data: adminRows }, { data: apsvList }] = await Promise.all([
      supa.from("services").select("name").eq("id", appt.service_id).maybeSingle(),
      supa.from("staff_profiles").select("full_name, email").eq("id", appt.staff_id).maybeSingle(),
      supa.from("locations").select("name").eq("id", appt.location_id).maybeSingle(),
      supa.from("user_roles").select("user_id").eq("role", "admin"),
      supa.from("appointment_services").select("display_order, services(name)").eq("appointment_id", appt.id).order("display_order", { ascending: true }),
    ]);
    const allServiceNames = ((apsvList ?? []) as any[]).map((r) => r.services?.name).filter((n: any): n is string => !!n);
    const combinedServiceName = allServiceNames.length > 0 ? allServiceNames.join(" + ") : (svc?.name ?? "");
    const apptTimeStr = new Date(appt.start_at).toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles",
    });
    const origin = req.headers.get("origin") || "https://bookrka.com";

    // Client confirmation
    await supa.functions.invoke("send-transactional-email", {
      body: {
        templateName: "booking-cancelled",
        recipientEmail: appt.client_email,
        idempotencyKey: `cancel-client-${appt.id}`,
        templateData: {
          clientName: appt.client_first_name,
          serviceName: combinedServiceName || "your appointment",
          appointmentTime: apptTimeStr,
          providerName: stf?.full_name ?? "",
          locationName: loc?.name ?? "",
          lateCancel,
          reason: reason ?? "",
          rebookUrl: `${origin}/book`,
        },
      },
    }).catch((e) => console.error("client cancel email failed", e));

    // Staff + admins
    const recipients = new Map<string, string>();
    if (stf?.email) recipients.set(stf.email.toLowerCase(), stf.full_name ?? "Team");
    const adminIds = (adminRows ?? []).map((r: any) => r.user_id);
    if (adminIds.length) {
      const { data: adminStaff } = await supa.from("staff_profiles")
        .select("email, full_name").in("user_id", adminIds);
      for (const s of adminStaff ?? []) {
        if (s.email && !recipients.has(s.email.toLowerCase())) {
          recipients.set(s.email.toLowerCase(), s.full_name ?? "Team");
        }
      }
    }
    const reviewUrl = `${origin}/staff/appointments/${appt.id}`;
    const cancelledByLabel = cancelledBy === "staff" ? "a team member" : "the client";
    await Promise.all([...recipients.entries()].map(([to, name]) =>
      supa.functions.invoke("send-transactional-email", {
        body: {
          templateName: "staff-cancellation-notification",
          recipientEmail: to,
          idempotencyKey: `cancel-staff-${appt.id}-${to}`,
          templateData: {
            staffName: name,
            clientName: `${appt.client_first_name} ${appt.client_last_name}`.trim(),
            clientEmail: appt.client_email,
            clientPhone: appt.client_phone,
            serviceName: combinedServiceName,
            appointmentTime: apptTimeStr,
            locationName: loc?.name ?? "",
            cancelledBy: cancelledByLabel,
            reason: reason ?? "",
            lateCancel,
            reviewUrl,
          },
        },
      }).catch((e) => console.error("staff cancel email failed", to, e))
    ));

    return json({ ok: true, lateCancel });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
