// AI photo quality check.
// Compares a newly uploaded clinical photo against a baseline reference photo
// and returns lighting / angle / framing feedback plus a "retake" recommendation.
// Used from the chart editor and client-upload review surface.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Body = {
  current_url: string;        // signed or public URL to the photo to evaluate
  baseline_url?: string | null; // optional comparison reference
  intent?: string | null;     // e.g. "neurotoxin before", "lip filler after"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing auth" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: userRes } = await supabase.auth.getUser(token);
  const user = userRes?.user;
  if (!user) return json({ error: "Invalid auth" }, 401);
  const { data: ok } = await supabase.rpc("is_clinical_staff", { _user_id: user.id });
  if (!ok) return json({ error: "Not authorized" }, 403);

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return json({ error: "Missing LOVABLE_API_KEY" }, 500);

  let body: Body;
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }
  if (!body?.current_url) return json({ error: "current_url required" }, 400);

  const userParts: any[] = [
    { type: "text", text:
      `You are an aesthetic-medicine photo QC assistant. Compare the CURRENT photo` +
      (body.baseline_url ? " to the BASELINE reference" : "") +
      ` and judge whether it is usable for charting${body.intent ? ` (${body.intent})` : ""}. ` +
      `Check lighting consistency, framing, angle, focus, makeup/jewelry interference, and face/body coverage. ` +
      `Respond ONLY with strict JSON: {"verdict":"ok"|"retake","reasons":[string], "tips":[string]}.`
    },
    { type: "image_url", image_url: { url: body.current_url } },
  ];
  if (body.baseline_url) {
    userParts.push({ type: "image_url", image_url: { url: body.baseline_url } });
  }

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: userParts }],
        response_format: { type: "json_object" },
      }),
    });
    if (resp.status === 429) return json({ error: "Rate limit — try again shortly." }, 429);
    if (resp.status === 402) return json({ error: "AI credits exhausted." }, 402);
    if (!resp.ok) {
      const t = await resp.text();
      return json({ error: `AI gateway error: ${t.slice(0, 300)}` }, 502);
    }
    const j = await resp.json();
    const raw = j?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { verdict: "ok", reasons: [], tips: [String(raw).slice(0, 200)] }; }
    const verdict = parsed.verdict === "retake" ? "retake" : "ok";
    return json({
      verdict,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 6) : [],
      tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 6) : [],
    });
  } catch (e) {
    return json({ error: `AI request failed: ${(e as Error).message}` }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
