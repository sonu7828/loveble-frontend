// Cron-driven: Day 2 and Day 14 post-visit follow-up emails.
// Day 2 window: 36h–72h after appointment end. Day 14 window: 13–15 days after.
// One-time per appointment per day (stamped via followup_day2_sent_at / followup_day14_sent_at).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PUBLIC_SITE_URL = "https://bookrka.com";

function firstName(full?: string | null) {
  if (!full) return "";
  return full.trim().split(/\s+/)[0] ?? "";
}

async function processDay(
  supa: ReturnType<typeof createClient>,
  day: 2 | 14,
) {
  const now = Date.now();
  const windows = day === 2
    ? { start: now - 72 * 3600 * 1000, end: now - 36 * 3600 * 1000, col: "followup_day2_sent_at" as const }
    : { start: now - 15 * 24 * 3600 * 1000, end: now - 13 * 24 * 3600 * 1000, col: "followup_day14_sent_at" as const };

  const { data: appts } = await supa
    .from("appointments")
    .select(`id, client_first_name, client_email, public_token, end_at, staff_id, services(name)`)
    .eq("status", "completed")
    .is(windows.col, null)
    .gte("end_at", new Date(windows.start).toISOString())
    .lt("end_at", new Date(windows.end).toISOString())
    .limit(200);

  let sent = 0, skipped = 0, failed = 0;
  for (const a of (appts ?? []) as any[]) {
    try {
      if (!a.client_email) { skipped++; continue; }

      let providerName = "";
      if (a.staff_id) {
        const { data: sp } = await supa
          .from("staff_profiles")
          .select("full_name")
          .eq("id", a.staff_id)
          .maybeSingle();
        providerName = firstName((sp as any)?.full_name);
      }

      const res = await supa.functions.invoke("send-transactional-email", {
        body: {
          templateName: "followup-checkin",
          recipientEmail: a.client_email,
          idempotencyKey: `followup-d${day}-${a.id}`,
          templateData: {
            clientFirstName: a.client_first_name ?? "",
            serviceName: a.services?.name ?? "your treatment",
            day,
            providerFirstName: providerName,
            feedbackUrl: a.public_token
              ? `${PUBLIC_SITE_URL}/feedback/${a.public_token}`
              : `${PUBLIC_SITE_URL}/book`,
            rebookUrl: `${PUBLIC_SITE_URL}/book`,
          },
        },
      });
      if ((res as any)?.error) { failed++; continue; }
      await supa.from("appointments")
        .update({ [windows.col]: new Date().toISOString() })
        .eq("id", a.id);
      sent++;
    } catch (e) {
      console.error(`followup-d${day} failed`, a.id, e);
      failed++;
    }
  }
  return { sent, skipped, failed, total: appts?.length ?? 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const day2 = await processDay(supa, 2);
  const day14 = await processDay(supa, 14);
  return new Response(JSON.stringify({ ok: true, day2, day14 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
