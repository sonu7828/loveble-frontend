// AI drafter for marketing newsletters. Given a short prompt, returns a
// brand-voiced subject + preview text + body markdown + CTA. Optionally
// generates a hero image from the same prompt and stores it in the
// marketing-assets bucket.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `You write monthly newsletters for Radiantilyk Aesthetic, a luxury medspa with locations in San Jose and San Mateo, CA.
Voice: warm, polished, confident, brand-forward — like a thoughtful note from a trusted aesthetic provider. Never pushy, never spammy, never use ALL CAPS, no exclamation overload.
Output ONLY a JSON object with these exact keys: subject, preview_text, body_markdown, cta_label, cta_url.
- subject: under 60 chars, intriguing, no emojis.
- preview_text: under 110 chars.
- body_markdown: 120-300 words. Use the literal token {{first_name}} once near the top. Use short paragraphs and at most one bullet list. Markdown only (** for bold, * for italic, - for bullets). Do NOT include a subject line, greeting block, signature, unsubscribe, or images — those are added by the template.
- cta_label: 2-4 words.
- cta_url: default to https://bookrka.com/book unless the prompt specifies otherwise.
Return raw JSON only, no code fences, no commentary.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { prompt, generateImage = false } = await req.json();
    if (!prompt || typeof prompt !== "string") return json({ error: "prompt required" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    // Authz: admin or scheduler
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const supa = createClient(url, serviceKey);
    const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", user.id);
    const ok = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "scheduler");
    if (!ok) return json({ error: "Forbidden" }, 403);

    // 1. Draft copy
    const chat = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (chat.status === 429) return json({ error: "Rate limit — try again in a moment" }, 429);
    if (chat.status === 402) return json({ error: "AI credits exhausted. Add credits in workspace settings." }, 402);
    if (!chat.ok) {
      const t = await chat.text();
      return json({ error: `AI draft failed: ${t.slice(0, 200)}` }, 500);
    }
    const chatJson = await chat.json();
    const raw = chatJson?.choices?.[0]?.message?.content ?? "{}";
    let draft: any = {};
    try { draft = JSON.parse(raw); }
    catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { draft = JSON.parse(m[0]); } catch { /* */ } }
    }

    // 2. Optional hero image
    let hero_image_url: string | null = null;
    if (generateImage) {
      try {
        const img = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{
              role: "user",
              content: `Editorial, photo-real hero banner for a luxury medspa newsletter. Warm cream/blush palette, soft natural light, spa-quality aesthetic. Subject: ${prompt}. No text overlays, no logos, no watermarks.`,
            }],
            modalities: ["image", "text"],
          }),
        });
        if (img.ok) {
          const ij = await img.json();
          const b64 = ij?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (b64 && typeof b64 === "string") {
            // b64 is a data: URL — extract and upload
            const m = b64.match(/^data:(image\/[\w+]+);base64,(.+)$/);
            if (m) {
              const ct = m[1];
              const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
              const ext = ct.split("/")[1].split("+")[0];
              const path = `${user.id}/ai-${Date.now()}.${ext}`;
              const { error: upErr } = await supa.storage.from("marketing-assets")
                .upload(path, bytes, { contentType: ct, upsert: false });
              if (!upErr) {
                const { data: pub } = supa.storage.from("marketing-assets").getPublicUrl(path);
                hero_image_url = pub.publicUrl;
              }
            }
          }
        }
      } catch (e) {
        console.error("image gen failed", e);
      }
    }

    return json({
      ok: true,
      draft: {
        subject: String(draft.subject || "").slice(0, 120),
        preview_text: String(draft.preview_text || "").slice(0, 200),
        body_markdown: String(draft.body_markdown || ""),
        cta_label: String(draft.cta_label || "Book your visit"),
        cta_url: String(draft.cta_url || "https://bookrka.com/book"),
      },
      hero_image_url,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
