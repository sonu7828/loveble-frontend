import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpSupabase, requireAuth, ok, err } from "./_shared";

export default defineTool({
  name: "list_services",
  title: "List services",
  description:
    "List active services in the catalog with pricing and duration. Optional case-insensitive name filter.",
  inputSchema: {
    query: z.string().optional().describe("Optional name fragment."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows (default 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    const auth = requireAuth(ctx);
    if (auth) return auth;
    const sb = mcpSupabase(ctx);
    let q = sb
      .from("services")
      .select("id, name, price_cents, price_note, duration_minutes, deposit_cents, is_featured, requires_consult")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(limit ?? 100);
    if (query) q = q.ilike("name", `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`);
    const { data, error } = await q;
    if (error) return err(error.message);
    return ok({ count: data?.length ?? 0, services: data ?? [] });
  },
});
