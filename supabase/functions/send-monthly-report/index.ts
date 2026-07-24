// Monthly admin report — sums the prior calendar month (or current month-to-date when run mid-month)
// and emails every admin a full list of services performed with revenue, plus location/staff breakdown.
// Designed to be invoked by pg_cron on the 30th of every month at 15:00 UTC, but can also be
// triggered manually by an admin from the Reports page.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireServiceRole } from "../_shared/require-service-role.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TZ = "America/Los_Angeles";

function ptYmd(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function monthBounds(year: number, monthIdx: number) {
  // PT-relative month bounds, widened-safe by using offset strings.
  const startYmd = `${year}-${String(monthIdx + 1).padStart(2, "0")}-01`;
  const nextMonth = monthIdx === 11 ? { y: year + 1, m: 0 } : { y: year, m: monthIdx + 1 };
  const endYmd = `${nextMonth.y}-${String(nextMonth.m + 1).padStart(2, "0")}-01`;
  return {
    start: new Date(`${startYmd}T00:00:00-08:00`),
    end: new Date(`${endYmd}T00:00:00-08:00`),
    label: new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "long", year: "numeric" })
      .format(new Date(`${startYmd}T12:00:00-08:00`)),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Allow either: (a) service-role token (pg_cron / internal), or (b) an admin user.
  const denied = requireServiceRole(req, corsHeaders);
  if (denied) {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) return denied;
    const { data: userData, error: userErr } = await supa.auth.getUser(token);
    if (userErr || !userData?.user) return denied;
    const { data: roleRow } = await supa
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return denied;
  }


  let body: { recipientEmail?: string; dryRun?: boolean; year?: number; month?: number } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  // Pick the period: if user passed year/month, use it; otherwise the PREVIOUS calendar month
  // in PT (cron runs on the 1st at 00:00 PT, so we report the month that just ended).
  let year: number, monthIdx: number;
  if (typeof body.year === "number" && typeof body.month === "number") {
    year = body.year; monthIdx = body.month;
  } else {
    const ymd = ptYmd(new Date()); // YYYY-MM-DD in PT
    const curYear = parseInt(ymd.slice(0, 4), 10);
    const curMonthIdx = parseInt(ymd.slice(5, 7), 10) - 1;
    if (curMonthIdx === 0) { year = curYear - 1; monthIdx = 11; }
    else { year = curYear; monthIdx = curMonthIdx - 1; }
  }
  const { start, end, label } = monthBounds(year, monthIdx);

  // Resolve recipients: all admin users (or the override).
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

  if (recipients.length === 0 && !body.dryRun) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_recipients" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch appointments in window + lookups + sales
  const [appts, services, staff, locations, salesRes] = await Promise.all([
    supa.from("appointments")
      .select("id, status, start_at, service_id, staff_id, location_id, is_new_client, client_email, client_first_name, client_last_name")
      .gte("start_at", start.toISOString()).lt("start_at", end.toISOString()),
    supa.from("services").select("id, name, price_cents, category_id, service_categories(name)"),
    supa.from("staff_profiles").select("id, full_name"),
    supa.from("locations").select("id, name"),
    supa.from("sales")
      .select("id, appointment_id, client_email, total_cents, refunded_amount_cents, status, paid_at")
      .in("status", ["paid", "completed", "partially_refunded"])
      .gte("paid_at", start.toISOString()).lt("paid_at", end.toISOString()),
  ]);

  const apptList = (appts.data ?? []) as any[];
  const salesList = (salesRes.data ?? []) as any[];
  const svcMap = new Map((services.data ?? []).map((s: any) => [s.id, s]));
  const staffMap = new Map((staff.data ?? []).map((s: any) => [s.id, s.full_name]));
  const locMap = new Map((locations.data ?? []).map((l: any) => [l.id, l.name]));

  const CATEGORY_BUCKETS = ["Neurotoxin", "Filler", "Laser", "Body Contouring", "Weight Loss", "Mental health", "IVs", "Other"] as const;
  function bucketFor(svc: any): string {
    const cat = (svc?.service_categories?.name ?? "").toLowerCase();
    const name = (svc?.name ?? "").toLowerCase();
    if (cat.includes("neurotoxin") || name.includes("botox") || name.includes("daxxify") || name.includes("neurotoxin")) return "Neurotoxin";
    if (cat.includes("filler") || cat.includes("biostimulator") || name.includes("filler") || name.includes("sculptra") || name.includes("radiesse") || name.includes("hyaluronidase")) return "Filler";
    if (cat.includes("laser")) return "Laser";
    if (cat.includes("body contouring") || cat.includes("skin tightening") || name.includes("hifu") || name.includes("hifem") || name.includes("exilis") || name.includes("lipolytic") || name.includes("everesse")) return "Body Contouring";
    if (name.includes("glp") || name.includes("weight")) return "Weight Loss";
    if (cat.includes("mental") || name.includes("mental health") || name.includes("psych")) return "Mental health";
    if (cat.includes("iv") || /\biv\b/.test(name) || name.includes("infusion") || name.includes("drip")) return "IVs";
    return "Other";
  }

  const ids = apptList.map((a) => a.id);
  const apptSvc: Record<string, string[]> = {};
  if (ids.length) {
    const { data } = await supa.from("appointment_services").select("appointment_id, service_id").in("appointment_id", ids);
    for (const r of (data ?? []) as any[]) (apptSvc[r.appointment_id] ||= []).push(r.service_id);
  }

  let totalBookings = 0, completedCount = 0, noShowCount = 0, cancelledCount = 0;
  const newClientEmails = new Set<string>();
  const svcCount = new Map<string, number>();
  const svcRevenue = new Map<string, number>();
  const catCount = new Map<string, number>();
  const catRevenue = new Map<string, number>();
  const locCount = new Map<string, number>();
  const staffCount = new Map<string, number>();

  const salesByAppt = new Map<string, any[]>();
  for (const s of salesList) {
    if (!s.appointment_id) continue;
    const arr = salesByAppt.get(s.appointment_id) ?? [];
    arr.push(s);
    salesByAppt.set(s.appointment_id, arr);
  }
  const unlinkedSalesRevenue = salesList
    .filter(s => !s.appointment_id)
    .reduce((sum, s) => sum + Math.max(0, (s.total_cents ?? 0) - (s.refunded_amount_cents ?? 0)), 0);

  for (const a of apptList) {
    totalBookings++;
    if (a.status === "completed") completedCount++;
    else if (a.status === "no_show") noShowCount++;
    else if (a.status === "cancelled") cancelledCount++;

    if (a.is_new_client && (a.status === "completed" || a.status === "approved")) {
      newClientEmails.add((a.client_email ?? "").toLowerCase());
    }

    const svcIds = apptSvc[a.id]?.length ? apptSvc[a.id] : [a.service_id];
    if (a.status === "completed") {
      const listTotals = svcIds.map((sid: string) => (svcMap.get(sid) as any)?.price_cents ?? 0);
      const listSum = listTotals.reduce((x: number, y: number) => x + y, 0) || 1;
      const linked = salesByAppt.get(a.id) ?? [];
      const actualRevenue = linked.reduce((sum: number, s: any) => sum + Math.max(0, (s.total_cents ?? 0) - (s.refunded_amount_cents ?? 0)), 0);
      const useActual = linked.length > 0;
      for (let i = 0; i < svcIds.length; i++) {
        const sid = svcIds[i];
        svcCount.set(sid, (svcCount.get(sid) ?? 0) + 1);
        const svc = svcMap.get(sid) as any;
        const revenue = useActual
          ? Math.round((actualRevenue * listTotals[i]) / listSum)
          : (svc?.price_cents ?? 0);
        svcRevenue.set(sid, (svcRevenue.get(sid) ?? 0) + revenue);
        const bucket = bucketFor(svc);
        catCount.set(bucket, (catCount.get(bucket) ?? 0) + 1);
        catRevenue.set(bucket, (catRevenue.get(bucket) ?? 0) + revenue);
      }
    }

    if (a.status !== "cancelled" && a.status !== "denied") {
      locCount.set(a.location_id, (locCount.get(a.location_id) ?? 0) + 1);
      staffCount.set(a.staff_id, (staffCount.get(a.staff_id) ?? 0) + 1);
    }
  }

  const totalRevenue = [...svcRevenue.values()].reduce((a, b) => a + b, 0) + unlinkedSalesRevenue;
  const moneyLabel = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const servicesRows = [...svcCount.entries()]
    .map(([sid, count]) => ({
      name: (svcMap.get(sid) as any)?.name ?? "—",
      count,
      revenueLabel: moneyLabel(svcRevenue.get(sid) ?? 0),
    }))
    .sort((a, b) => b.count - a.count);

  const byLocation = [...locCount.entries()]
    .map(([id, count]) => ({ name: locMap.get(id) ?? "—", count }))
    .sort((a, b) => b.count - a.count);

  const byStaff = [...staffCount.entries()]
    .map(([id, count]) => ({ name: staffMap.get(id) ?? "—", count }))
    .sort((a, b) => b.count - a.count);

  const byCategory = CATEGORY_BUCKETS
    .map((name) => ({
      name,
      count: catCount.get(name) ?? 0,
      revenueLabel: moneyLabel(catRevenue.get(name) ?? 0),
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  // ===== Missing GFE & missing charts for completed appts =====
  const completedAppts = apptList.filter(a => a.status === "completed");
  const completedApptIds = completedAppts.map(a => a.id);
  const completedEmails = [...new Set(completedAppts.map(a => (a.client_email ?? "").toLowerCase()).filter(Boolean))];

  const [notesRes, gfesRes] = await Promise.all([
    completedApptIds.length
      ? supa.from("clinical_notes").select("appointment_id").in("appointment_id", completedApptIds)
      : Promise.resolve({ data: [] as any[] }),
    completedEmails.length
      ? supa.from("gfe_records").select("client_email").in("client_email", completedEmails)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const chartedApptIds = new Set(((notesRes as any).data ?? []).map((r: any) => r.appointment_id));
  const gfeEmails = new Set(((gfesRes as any).data ?? []).map((r: any) => (r.client_email ?? "").toLowerCase()));

  const fmtDate = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" }).format(new Date(iso));
  const apptLabel = (a: any) => {
    const svcIds = apptSvc[a.id]?.length ? apptSvc[a.id] : [a.service_id];
    const names = svcIds.map((sid: string) => (svcMap.get(sid) as any)?.name).filter(Boolean).join(" + ") || "Service";
    return {
      client: `${a.client_first_name ?? ""} ${a.client_last_name ?? ""}`.trim() || (a.client_email ?? "—"),
      date: fmtDate(a.start_at),
      service: names,
      staff: staffMap.get(a.staff_id) ?? "—",
    };
  };

  const missingCharts = completedAppts
    .filter(a => !chartedApptIds.has(a.id))
    .map(apptLabel);
  const missingGFE = completedAppts
    .filter(a => !gfeEmails.has((a.client_email ?? "").toLowerCase()))
    .map(apptLabel);

  const templateData = {
    periodLabel: label,
    totalBookings,
    completedCount,
    noShowCount,
    cancelledCount,
    newClientCount: newClientEmails.size,
    revenueLabel: moneyLabel(totalRevenue),
    services: servicesRows,
    byCategory,
    byLocation,
    byStaff,
    missingCharts,
    missingGFE,
    missingChartsCount: missingCharts.length,
    missingGFECount: missingGFE.length,
    portalUrl: "https://bookrka.com/staff/reports",
  };

  if (body.dryRun) {
    return new Response(JSON.stringify({ ok: true, recipients, templateData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const idemMonth = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
  let sent = 0;
  for (const email of recipients) {
    try {
      await supa.functions.invoke("send-transactional-email", {
        body: {
          templateName: "monthly-report",
          recipientEmail: email,
          idempotencyKey: `monthly-v2-${idemMonth}-${email}-${Date.now()}`,
          templateData,
        },
      });
      sent++;
    } catch (e) {
      console.error("monthly report send failed", email, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, recipients: recipients.length, period: label }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
