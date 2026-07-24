// Public, token-gated: lets a client upload a post-visit photo tied to their
// appointment without needing an account.
// Body JSON: { token, fileBase64, mimeType, caption? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { token, fileBase64, mimeType, caption } = await req.json();
    if (!token || typeof token !== "string" || token.length < 16) return json({ error: "Invalid token" }, 400);
    if (!fileBase64 || typeof fileBase64 !== "string") return json({ error: "Missing file" }, 400);
    if (!mimeType || !ALLOWED.has(mimeType)) return json({ error: "Unsupported file type" }, 400);
    if (caption && (typeof caption !== "string" || caption.length > 500)) return json({ error: "Invalid caption" }, 400);

    const bytes = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return json({ error: "File too large or empty" }, 400);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: appt } = await supa.from("appointments")
      .select("id, client_email, updated_at, status")
      .eq("public_token", token).maybeSingle();
    if (!appt) return json({ error: "Not found" }, 404);

    // Only accept uploads for visits within the last 90 days.
    const apptAgeDays = (Date.now() - new Date(appt.updated_at).getTime()) / 86400000;
    if (apptAgeDays > 90) return json({ error: "Upload window has closed" }, 410);

    const ext = mimeType.split("/")[1].replace("jpeg", "jpg");
    const path = `${appt.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supa.storage.from("client-uploaded-photos")
      .upload(path, bytes, { contentType: mimeType, upsert: false });
    if (upErr) return json({ error: upErr.message }, 500);

    const { error: insErr } = await supa.from("client_uploaded_photos").insert({
      appointment_id: appt.id,
      client_email: appt.client_email,
      storage_path: path,
      caption: caption?.trim() || null,
    });
    if (insErr) {
      await supa.storage.from("client-uploaded-photos").remove([path]);
      return json({ error: insErr.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
