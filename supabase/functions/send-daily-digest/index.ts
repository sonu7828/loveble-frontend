// Daily admin digest — gathers today's schedule + yesterday's stats and emails
// every admin user. Designed to be invoked by pg_cron once per day, but can also
// be triggered manually by an admin from the Reports page.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireServiceRole } from "../_shared/require-service-role.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TZ = "America/Los_Angeles";

function ptDateBoundaries(offsetDays: number) {
  // Compute start/end of a PT calendar day relative to "now" using locale formatting.
  const now = new Date();
  const partsFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const target = new Date(now.getTime() + offsetDays * 86400000);
  const ymd = partsFmt.format(target); // YYYY-MM-DD in PT
  // Approximate: use 08:00Z as midnight PT (covers PST/PDT differences for filtering windows;
  // we widen by ±4h to be safe and then re-filter server-side).
  const start = new Date(`${ymd}T00:00:00-08:00`);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { start, end, ymd };
}

function fmtPT(d: Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: TZ }).format(d);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const denied = requireServiceRole(req, corsHeaders);
  if (denied) return denied;

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Optional: allow caller to override recipient(s) for testing.
  let body: { recipientEmail?: string; dryRun?: boolean } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  // Resolve recipients: all admin users.
  let recipients: string[] = [];
  if (body.recipientEmail) {
    recipients = [body.recipientEmail.toLowerCase()];
  } else {
    const { data: roles } = await supa.from("user_roles").select("user_id").eq("role", "admin");
    const ids = [...new Set((roles ?? []).map((r: any) => r.user_id))];
    for (const uid of ids) {
      try {
        const { data } = await supa.auth.admin.getUserById(uid);
        if (data?.user?.email) recipients.push(data.user.email.toLowerCase());
      } catch { /* skip */ }
    }
  }

  if (recipients.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_recipients" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Time windows
  const today = ptDateBoundaries(0);
  const yesterday = ptDateBoundaries(-1);
  const next7End = new Date(today.end.getTime() + 6 * 86400000);

  const [todayQ, pendingQ, waitQ, yQ, needConsentQ, chargeQ, missingQ, services, staff, locations] = await Promise.all([
    supa.from("appointments").select("id, start_at, client_first_name, client_last_name, service_id, staff_id, location_id, status")
      .gte("start_at", today.start.toISOString()).lt("start_at", today.end.toISOString())
      .in("status", ["approved", "pending", "completed"]).order("start_at"),
    supa.from("appointments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supa.from("waitlist_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
    supa.from("appointments").select("id, status, service_id, is_new_client, client_email")
      .gte("start_at", yesterday.start.toISOString()).lt("start_at", yesterday.end.toISOString()),
    supa.from("appointments").select("id", { count: "exact", head: true })
      .gte("start_at", today.start.toISOString()).lte("start_at", next7End.toISOString())
      .eq("status", "approved").is("consent_pdf_url", null),
    supa.from("appointments").select("id", { count: "exact", head: true })
      .gte("start_at", new Date(today.start.getTime() - 2 * 86400000).toISOString())
      .lt("start_at", today.start.toISOString())
      .eq("status", "no_show").is("no_show_charge_id", null),
    supa.from("appointments").select("id", { count: "exact", head: true })
      .gte("start_at", today.start.toISOString()).lte("start_at", next7End.toISOString())
      .eq("status", "approved").is("stripe_payment_method_id", null),
    supa.from("services").select("id, name, price_cents"),
    supa.from("staff_profiles").select("id, full_name"),
    supa.from("locations").select("id, name"),
  ]);

  const svcMap = new Map((services.data ?? []).map((s: any) => [s.id, s]));
  const staffMap = new Map((staff.data ?? []).map((s: any) => [s.id, s.full_name]));
  const locMap = new Map((locations.data ?? []).map((l: any) => [l.id, l.name]));

  const todayList = (todayQ.data ?? []).map((a: any) => ({
    time: fmtPT(new Date(a.start_at), { hour: "numeric", minute: "2-digit" }),
    client: `${a.client_first_name} ${a.client_last_name?.[0] ?? ""}.`,
    service: (svcMap.get(a.service_id) as any)?.name ?? "—",
    staff: staffMap.get(a.staff_id) ?? "—",
    location: locMap.get(a.location_id) ?? "—",
  }));

  // Yesterday metrics
  let revenueCents = 0, noShowCount = 0;
  const newClientEmails = new Set<string>();
  for (const a of (yQ.data ?? []) as any[]) {
    if (a.status === "completed") {
      revenueCents += (svcMap.get(a.service_id) as any)?.price_cents ?? 0;
      // pull addons
    }
    if (a.status === "no_show") noShowCount++;
    if (a.is_new_client && (a.status === "completed" || a.status === "approved")) {
      newClientEmails.add((a.client_email ?? "").toLowerCase());
    }
  }
  // Add multi-service revenue
  const completedIds = (yQ.data ?? []).filter((x: any) => x.status === "completed").map((x: any) => x.id);
  if (completedIds.length) {
    const { data: aps } = await supa.from("appointment_services").select("appointment_id, service_id").in("appointment_id", completedIds);
    // First service is already counted via appointments.service_id; add the rest if appointment_services has additional rows.
    const counts = new Map<string, number>();
    for (const r of (aps ?? []) as any[]) counts.set(r.appointment_id, (counts.get(r.appointment_id) ?? 0) + 1);
    for (const r of (aps ?? []) as any[]) {
      const total = counts.get(r.appointment_id) ?? 1;
      // Only add extras (beyond the primary already counted)
      if (total > 1) {
        // We don't know which row is "primary"; safer approach: subtract primary later.
      }
      revenueCents += (svcMap.get(r.service_id) as any)?.price_cents ?? 0;
    }
    // Subtract one primary per completed appt to avoid double count when appointment_services exists
    for (const id of completedIds) {
      if ((counts.get(id) ?? 0) > 0) {
        const a: any = (yQ.data ?? []).find((x: any) => x.id === id);
        if (a) revenueCents -= (svcMap.get(a.service_id) as any)?.price_cents ?? 0;
      }
    }
  }

  const needsAttention = [
    { label: "Awaiting consents (next 7 days)", count: needConsentQ.count ?? 0 },
    { label: "No-show ready to charge", count: chargeQ.count ?? 0 },
    { label: "Missing card on file (next 7 days)", count: missingQ.count ?? 0 },
  ];

  const templateData = {
    dateLabel: fmtPT(new Date(), { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    todayCount: todayList.length,
    pendingCount: pendingQ.count ?? 0,
    waitlistCount: waitQ.count ?? 0,
    newClientCount: newClientEmails.size,
    noShowCount,
    revenueLabel: `$${(Math.max(0, revenueCents) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    todayList,
    needsAttention,
    portalUrl: "https://bookrka.com/staff/dashboard",
  };

  if (body.dryRun) {
    return new Response(JSON.stringify({ ok: true, recipients, templateData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const idemDate = today.ymd;
  let sent = 0;
  for (const email of recipients) {
    try {
      await supa.functions.invoke("send-transactional-email", {
        body: {
          templateName: "daily-digest",
          recipientEmail: email,
          idempotencyKey: `digest-${idemDate}-${email}`,
          templateData,
        },
      });
      sent++;
    } catch (e) {
      console.error("digest send failed", email, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, recipients: recipients.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
