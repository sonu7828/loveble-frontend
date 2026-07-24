// Scheduled — finds booking attempts started >30min ago that never completed
// and tags the contact in GHL with `booking-abandoned` so an SMS workflow can fire.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireServiceRole } from "../_shared/require-service-role.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const denied = requireServiceRole(req, corsHeaders);
  if (denied) return denied;
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Window: started >30 min and <24h ago, no completion, no notification, has email/phone
    const now = Date.now();
    const minAge = new Date(now - 30 * 60 * 1000).toISOString();
    const maxAge = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const { data: attempts } = await supa.from("booking_attempts")
      .select("id, session_id, email, first_name, last_name, phone, service_id, location_id, staff_id, services(name, id), locations(name)")
      .lt("started_at", minAge)
      .gt("started_at", maxAge)
      .is("completed_at", null)
      .is("notified_at", null)
      .not("email", "is", null);

    let tagged = 0;
    let leadsCreated = 0;
    let authUsersCreated = 0;
    const baseUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://bookrka.com";

    for (const a of attempts ?? []) {
      if (!a.email) continue;
      const email = String(a.email).trim().toLowerCase();
      if (!email) continue;

      // 1) Upsert a lead row in client_profiles. Only mark as lead if this is a
      //    brand-new contact (no existing profile and no past appointment).
      try {
        const [{ data: existingProfile }, { count: apptCount }] = await Promise.all([
          supa.from("client_profiles")
            .select("email, first_name, last_name, phone, is_lead")
            .eq("email", email)
            .maybeSingle(),
          supa.from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("client_email", email),
        ]);

        if (!existingProfile) {
          const isReturning = (apptCount ?? 0) > 0;
          const { error: insErr } = await supa.from("client_profiles").insert({
            email,
            first_name: a.first_name ?? null,
            last_name: a.last_name ?? null,
            phone: a.phone ?? null,
            is_lead: !isReturning,
            lead_source: isReturning ? null : "booking_abandoned",
            lead_captured_at: isReturning ? null : new Date().toISOString(),
          });
          if (!insErr) leadsCreated++;
          else console.error("lead insert failed", email, insErr.message);
        } else {
          // Only fill blanks — don't overwrite a returning client's good data.
          const patch: Record<string, unknown> = {};
          if (!existingProfile.first_name && a.first_name) patch.first_name = a.first_name;
          if (!existingProfile.last_name && a.last_name) patch.last_name = a.last_name;
          if (!existingProfile.phone && a.phone) patch.phone = a.phone;
          if (Object.keys(patch).length > 0) {
            await supa.from("client_profiles").update(patch).eq("email", email);
          }
        }
      } catch (e) {
        console.error("lead upsert failed", email, e);
      }

      // 2) Create a dormant auth user (no password, no confirmation email) so
      //    they can later claim the account via magic link without re-registering.
      //    If the email is already in auth.users, skip silently.
      try {
        const { data: created, error: authErr } = await supa.auth.admin.createUser({
          email,
          email_confirm: false,
          user_metadata: {
            source: "booking_abandoned",
            first_name: a.first_name ?? null,
            last_name: a.last_name ?? null,
            phone: a.phone ?? null,
          },
        });
        if (created?.user) authUsersCreated++;
        else if (authErr && !/already|registered|exists/i.test(authErr.message)) {
          console.error("auth admin create failed", email, authErr.message);
        }
      } catch (e) {
        console.error("auth admin create threw", email, e);
      }

      // 3) Tag the contact in GHL so the abandonment SMS workflow can fire.
      const params = new URLSearchParams();
      if (a.service_id) params.set("service", a.service_id);
      if (a.location_id) params.set("location", a.location_id);
      if (a.staff_id) params.set("staff", a.staff_id);
      const resumeUrl = `${baseUrl}/book${params.toString() ? "?" + params.toString() : ""}`;

      try {
        await supa.functions.invoke("ghl-sync-contact", {
          body: {
            email,
            firstName: a.first_name ?? "",
            lastName: a.last_name ?? "",
            phone: a.phone ?? "",
            tags: ["rkabook", "booking-abandoned"],
            customFields: {
              resume_url: resumeUrl,
              next_appointment_service: (a as any).services?.name ?? "",
              next_appointment_location: (a as any).locations?.name ?? "",
            },
          },
        });
        await supa.from("booking_attempts").update({ notified_at: new Date().toISOString() }).eq("id", a.id);
        tagged++;
      } catch (e) {
        console.error("abandonment tag failed", a.id, e);
      }
    }

    return json({ ok: true, processed: attempts?.length ?? 0, tagged, leadsCreated, authUsersCreated });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
