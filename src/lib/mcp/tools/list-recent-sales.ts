import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpSupabase, requireAuth, ok, err } from "./_shared";

export default defineTool({
  name: "list_recent_sales",
  title: "List recent sales",
  description:
    "List completed (paid) sales within a date range with totals, discount, tip, and client. Dates are YYYY-MM-DD, inclusive.",
  inputSchema: {
    from: z.string().describe("Start date, YYYY-MM-DD."),
    to: z.string().describe("End date, YYYY-MM-DD (inclusive)."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, limit }, ctx) => {
    const auth = requireAuth(ctx);
    if (auth) return auth;
    const sb = mcpSupabase(ctx);
    const { data, error } = await sb
      .from("sales")
      .select(
        "id, paid_at, amount_due_cents, discount_cents, credit_applied_cents, client_first_name, client_last_name, client_email, notes",
      )
      .gte("paid_at", `${from}T00:00:00Z`)
      .lte("paid_at", `${to}T23:59:59Z`)
      .not("paid_at", "is", null)
      .order("paid_at", { ascending: false })
      .limit(limit ?? 50);
    if (error) return err(error.message);
    const total = (data ?? []).reduce((s, r: any) => s + (r.amount_due_cents ?? 0), 0);
    return ok({ range: { from, to }, count: data?.length ?? 0, total_cents: total, sales: data ?? [] });
  },
});
