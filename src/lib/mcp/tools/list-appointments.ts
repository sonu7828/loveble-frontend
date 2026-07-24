import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function client(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_appointments",
  title: "List appointments",
  description:
    "List appointments visible to the signed-in staff user within a date range (inclusive). Dates are ISO 8601 (YYYY-MM-DD). Row-Level Security limits results to what the caller is allowed to see.",
  inputSchema: {
    from: z.string().describe("Start date, YYYY-MM-DD."),
    to: z.string().describe("End date, YYYY-MM-DD (inclusive)."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = client(ctx);
    const start = `${from}T00:00:00Z`;
    const end = `${to}T23:59:59Z`;
    const { data, error } = await sb
      .from("appointments")
      .select("id, starts_at, ends_at, status, service_name, client_name, staff_name, location_slug")
      .gte("starts_at", start)
      .lte("starts_at", end)
      .order("starts_at", { ascending: true })
      .limit(limit ?? 50);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { appointments: data ?? [] },
    };
  },
});
