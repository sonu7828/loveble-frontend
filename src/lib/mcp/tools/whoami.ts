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
  name: "whoami",
  title: "Who am I",
  description:
    "Return the signed-in staff user's identity: user id, email, staff id (if any), display name, and assigned roles.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const uid = ctx.getUserId();
    const email = ctx.getUserEmail();
    const sb = client(ctx);
    const [{ data: sp }, { data: roles }] = await Promise.all([
      sb.from("staff_profiles").select("id, display_name").eq("user_id", uid!).maybeSingle(),
      sb.from("user_roles").select("role").eq("user_id", uid!),
    ]);
    const payload = {
      user_id: uid,
      email,
      staff_id: sp?.id ?? null,
      display_name: sp?.display_name ?? null,
      roles: (roles ?? []).map((r: any) => r.role),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
