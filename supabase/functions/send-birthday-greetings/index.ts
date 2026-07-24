// Daily sweep — finds client_profiles whose dob month/day matches today (PT)
// and sends a birthday email + tags them in GHL for SMS workflows.
// Designed to be invoked by pg_cron once per day. Idempotent per (client, year).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TZ = "America/Los_Angeles";

function todayPT(): { mm: number; dd: number; year: number; ymd: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const ymd = fmt.format(new Date()); // YYYY-MM-DD
  const [y, m, d] = ymd.split("-").map(Number);
  return { mm: m, dd: d, year: y, ymd };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { mm, dd, year, ymd } = todayPT();

  // Pull all clients with a DOB; filter by month/day in JS (small dataset, simpler than SQL extracts).
  const { data: clients, error } = await supa
    .from("client_profiles")
    .select("id, email, first_name, last_name, phone, dob")
    .not("dob", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const matches = (clients ?? []).filter((c: any) => {
    if (!c.dob) return false;
    const [, m, d] = String(c.dob).split("-").map(Number);
    return m === mm && d === dd;
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const c of matches) {
    if (!c.email) { skipped++; continue; }
    try {
      await supa.functions.invoke("send-transactional-email", {
        body: {
          templateName: "birthday",
          recipientEmail: c.email,
          // Once per client per calendar year.
          idempotencyKey: `birthday-${c.id}-${year}`,
          templateData: {
            clientFirstName: c.first_name || "there",
            rebookUrl: "https://bookrka.com/book?utm_source=birthday_email&utm_medium=email&utm_campaign=birthday",
          },
        },
      });
      sent++;
    } catch (e) {
      errors.push(`${c.email}: ${(e as Error).message}`);
    }

    // Tag in GHL so SMS / pipeline workflows can fire today.
    if (c.email) {
      try {
        await supa.functions.invoke("ghl-sync-contact", {
          body: {
            email: c.email,
            firstName: c.first_name,
            lastName: c.last_name,
            phone: c.phone,
            tags: ["rkabook", "birthday-today"],
          },
        });
      } catch (e) {
        console.error("ghl tag failed", c.email, e);
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, ymd, candidates: matches.length, sent, skipped, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
