import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpSupabase, requireAuth, ok, err } from "./_shared";

export default defineTool({
  name: "list_clinical_notes",
  title: "List clinical notes for a client",
  description:
    "List chart notes for a client, most recent first. PHI — restricted by Row-Level Security. Retatrutide-tagged notes are restricted to Kiem only.",
  inputSchema: {
    email: z.string().email().describe("Client email."),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ email, limit }, ctx) => {
    const auth = requireAuth(ctx);
    if (auth) return auth;
    const sb = mcpSupabase(ctx);
    const { data, error } = await sb
      .from("clinical_notes")
      .select("id, created_at, category, indication, followup_weeks, cosigned_at, appointment_id")
      .eq("client_email", email.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (error) return err(error.message);
    return ok({ count: data?.length ?? 0, notes: data ?? [] });
  },
});
