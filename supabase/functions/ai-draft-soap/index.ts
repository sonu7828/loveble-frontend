// AI-assisted SOAP note draft.
// Clinical staff submits the structured chart inputs already gathered in the editor
// and receives a SOAP-style narrative draft they can paste into provider notes.
// The Lovable AI Gateway key is server-side; no client model calls.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Body = {
  category: "neurotoxin" | "filler" | "energy" | "wellness";
  service_name?: string | null;
  chief_concerns?: string[];
  treatment_areas?: string[];
  vitals?: { bp?: string; hr?: string; pain_pre?: string; pain_post?: string };
  allergies?: string[];
  meds?: string[];
  neuro?: any;
  filler?: any;
  energy?: any;
  wellness?: any;
  adverse?: string[];
  post_assessment?: string[];
  followup_weeks?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing auth" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: userRes } = await supabase.auth.getUser(token);
  const user = userRes?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Invalid auth" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isClinical } = await supabase.rpc("is_clinical_staff", { _user_id: user.id });
  if (!isClinical) {
    return new Response(JSON.stringify({ error: "Not authorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Body;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Pre-extract the exact product / dilution / lot so the model cannot hallucinate
  // a different brand (e.g. writing "Botox" when Daxxify was administered).
  const exactProduct =
    body.category === "neurotoxin" ? (body as any)?.neuro?.product :
    body.category === "filler"     ? (body as any)?.filler?.product :
    body.category === "energy"     ? (body as any)?.energy?.device :
    null;
  const exactDilution = body.category === "neurotoxin" ? (body as any)?.neuro?.dilution : null;
  const exactLot      = (body as any)?.neuro?.lot_number ?? (body as any)?.filler?.lot_number ?? null;
  const exactTotal    = body.category === "neurotoxin" ? (body as any)?.neuro?.total_units : null;

  const factLines = [
    exactProduct ? `PRODUCT ADMINISTERED: ${exactProduct}` : null,
    exactDilution ? `DILUTION: ${exactDilution}` : null,
    exactTotal ? `TOTAL UNITS: ${exactTotal}` : null,
    exactLot ? `LOT: ${exactLot}` : null,
    body.service_name ? `SERVICE: ${body.service_name}` : null,
  ].filter(Boolean).join("\n");

  const systemPrompt =
    "You are an aesthetic medicine clinical scribe. Convert the structured chart data " +
    "into a concise, professional SOAP narrative (Subjective, Objective, Assessment, Plan) " +
    "suitable for a medical-spa chart note. Use 4-8 short sentences total, no headings, " +
    "no bullet points, no markdown. Plain prose only. Do not invent vitals, lots, or doses " +
    "that are not in the data. Do not include PHI like full names or DOB. End with the " +
    "planned follow-up interval if provided.\n\n" +
    "CRITICAL ACCURACY RULES — failure to follow these is a charting error:\n" +
    "1. Use the EXACT product/brand name from PRODUCT ADMINISTERED below. NEVER substitute " +
    "a different brand (do NOT write 'Botox' if the product is Daxxify, Dysport, Xeomin, Jeuveau, etc.). " +
    "If unsure, write 'neurotoxin' generically — never guess a brand.\n" +
    "2. Use the EXACT dilution string from DILUTION below. Do not change the mL or unit values.\n" +
    "3. Use the EXACT total units from TOTAL UNITS below. Do not round or alter.\n" +
    "4. Use the EXACT lot number from LOT below if referencing it.\n\n" +
    (factLines ? `EXACT FACTS YOU MUST USE VERBATIM:\n${factLines}\n` : "");


  const userPrompt = JSON.stringify(body, null, 2);

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit — try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: `AI gateway error: ${errText.slice(0, 300)}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const draft = json?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ draft }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `AI request failed: ${(e as Error).message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
