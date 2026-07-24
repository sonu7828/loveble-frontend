import { defineTool } from "@lovable.dev/mcp-js";
import { mcpSupabase, requireAuth, ok, err } from "./_shared";

export default defineTool({
  name: "list_staff",
  title: "List staff",
  description:
    "List active staff members with title, credentials, and contact email.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const auth = requireAuth(ctx);
    if (auth) return auth;
    const sb = mcpSupabase(ctx);
    const { data, error } = await sb
      .from("staff_profiles")
      .select("id, full_name, title, credentials, email, phone, is_owner")
      .eq("is_active", true)
      .order("full_name", { ascending: true });
    if (error) return err(error.message);
    return ok({ count: data?.length ?? 0, staff: data ?? [] });
  },
});
