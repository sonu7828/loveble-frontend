// Cron-driven: N weeks after a completed appointment, send a one-time "time to
// book your next visit" SMS. Opt-in respected, per-provider configurable.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_TEMPLATE =
  "Hi {{clientFirstName}}, it's {{providerFirstName}}. You're due for your next visit! Whenever you're ready, you can book here: https://bookrka.com";

function render(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}
function firstName(full?: string | null) {
  return (full ?? "").trim().split(/\s+/)[0] ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Look back up to 26 weeks for safety
  const since = new Date(Date.now() - 26 * 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: appts, error } = await supa
    .from("appointments")
    .select("id, staff_id, client_email, client_first_name, client_phone, updated_at, sms_opt_in")
    .eq("status", "completed")
    .eq("sms_opt_in", true)
    .is("rebook_sms_sent_at", null)
    .gte("updated_at", since)
    .limit(200);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0, skipped = 0, failed = 0;
  const now = Date.now();

  for (const a of appts ?? []) {
    try {
      if (!a.client_phone) { skipped++; continue; }

      const { data: staff } = await supa
        .from("staff_profiles")
        .select("full_name")
        .eq("id", a.staff_id).maybeSingle();
      const { data: tpl_row } = await supa
        .from("staff_message_templates")
        .select("enabled, template, delay_minutes")
        .eq("staff_id", a.staff_id).eq("message_type", "rebook").maybeSingle();
      if (!staff || !tpl_row || (tpl_row as any).enabled !== true) { skipped++; continue; }

      const delayMin = (tpl_row as any).delay_minutes ?? 4 * 7 * 24 * 60;
      const ageMs = now - new Date(a.updated_at).getTime();
      if (ageMs < delayMin * 60 * 1000) { skipped++; continue; }

      // Skip if client already has a future appointment booked
      if (a.client_email) {
        const { data: future } = await supa
          .from("appointments")
          .select("id").eq("client_email", a.client_email)
          .in("status", ["pending", "approved"])
          .gt("start_at", new Date().toISOString())
          .limit(1).maybeSingle();
        if (future) {
          await supa.from("appointments")
            .update({ rebook_sms_sent_at: new Date().toISOString() })
            .eq("id", a.id);
          skipped++; continue;
        }
      }

      const tpl = ((tpl_row as any).template as string | null) || DEFAULT_TEMPLATE;
      const body = render(tpl, {
        clientFirstName: a.client_first_name ?? "",
        providerFirstName: firstName((staff as any).full_name),
      });

      const res = await supa.functions.invoke("send-sms-via-ghl", {
        body: { appointmentId: a.id, template: "rebook-reminder", body },
      });
      if ((res as any)?.error) { failed++; continue; }

      await supa.from("appointments")
        .update({ rebook_sms_sent_at: new Date().toISOString() })
        .eq("id", a.id);
      sent++;
    } catch (e) {
      console.error("rebook send failed", a.id, e);
      failed++;
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, skipped, failed, total: appts?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
