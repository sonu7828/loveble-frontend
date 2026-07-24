import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpSupabase, requireAuth, ok, err } from "./_shared";

export default defineTool({
  name: "get_client_summary",
  title: "Get client summary",
  description:
    "Return a client's profile, upcoming appointments (next 5), recent appointments (last 5), active credits, and active vouchers. PHI — use only when the user needs a client overview.",
  inputSchema: {
    email: z
      .string()
      .email()
      .optional()
      .describe("Client email (preferred if known)."),
    client_id: z.string().uuid().optional().describe("Client UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ email, client_id }, ctx) => {
    const auth = requireAuth(ctx);
    if (auth) return auth;
    if (!email && !client_id) return err("Provide either email or client_id.");
    const sb = mcpSupabase(ctx);

    let clientQ = sb.from("clients").select("id, first_name, last_name, email, phone, dob, created_at").limit(1);
    clientQ = client_id ? clientQ.eq("id", client_id) : clientQ.eq("email", email!.toLowerCase());
    const { data: clients, error: cErr } = await clientQ;
    if (cErr) return err(cErr.message);
    const client = clients?.[0];
    if (!client) return err("Client not found (or not visible to this account).");

    const nowIso = new Date().toISOString();
    const [upcoming, recent, credits, vouchers] = await Promise.all([
      sb.from("appointments")
        .select("id, starts_at, status, service_name, staff_name")
        .eq("client_email", client.email)
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(5),
      sb.from("appointments")
        .select("id, starts_at, status, service_name, staff_name")
        .eq("client_email", client.email)
        .lt("starts_at", nowIso)
        .order("starts_at", { ascending: false })
        .limit(5),
      sb.from("client_credits")
        .select("id, kind, amount_cents, redeemed_amount_cents, reason, service_label, units, created_at")
        .eq("client_email", client.email)
        .is("redeemed_at", null)
        .order("created_at", { ascending: false }),
      sb.from("vouchers")
        .select("id, code, balance_cents, original_amount_cents, expires_at, source")
        .eq("issued_to_email", client.email)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
    ]);

    return ok({
      client,
      upcoming_appointments: upcoming.data ?? [],
      recent_appointments: recent.data ?? [],
      active_credits: credits.data ?? [],
      active_vouchers: vouchers.data ?? [],
    });
  },
});
