import { defineTool } from "@lovable.dev/mcp-js";
import { mcpSupabase, requireAuth, ok, err } from "./_shared";

export default defineTool({
  name: "list_todays_schedule",
  title: "List today's schedule",
  description:
    "Return today's appointments (America/Los_Angeles) visible to the signed-in staff user, ordered by start time.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const auth = requireAuth(ctx);
    if (auth) return auth;
    // Compute today in America/Los_Angeles as a YYYY-MM-DD string.
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const sb = mcpSupabase(ctx);
    const { data, error } = await sb
      .from("appointments")
      .select(
        "id, starts_at, ends_at, status, service_name, client_first_name, client_last_name, client_phone, staff_name, location_slug",
      )
      .gte("starts_at", `${today}T00:00:00-08:00`)
      .lte("starts_at", `${today}T23:59:59-08:00`)
      .order("starts_at", { ascending: true });
    if (error) return err(error.message);
    return ok({ date: today, appointments: data ?? [] });
  },
});
