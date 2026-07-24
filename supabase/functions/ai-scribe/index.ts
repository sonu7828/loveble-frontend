// AI Scribe: transcribe visit audio + generate structured aesthetic note.
// Actions (multipart or JSON):
//   action=transcribe (multipart: file, session_id) -> uploads audio, transcribes, updates session
//   action=generate  (json:  session_id) -> uses stored transcript to generate structured note
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data } = await anon.auth.getUser();
  return data.user;
}

// ---- Transcription ----
async function transcribeAudio(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("model", "openai/gpt-4o-mini-transcribe");
  // Rename with sensible extension based on mime
  const mime = (file.type || "").split(";")[0];
  const extMap: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
  };
  const ext = extMap[mime] ?? "wav";
  fd.append("file", file, `recording.${ext}`);

  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Transcription failed ${res.status}: ${err}`);
  }
  const out = await res.json();
  return String(out.text ?? "").trim();
}

// ---- Note generation ----
function templateForCategory(category: string | null, service: string | null): string {
  const s = (service || "").toLowerCase();
  const isFollowup = /follow.?up|touch.?up|check.?in/.test(s);
  if (isFollowup) {
    return `SIMPLIFIED FOLLOW-UP NOTE (California board-certified NP)
- Interval since last visit
- Patient-reported outcome (kick-in, symmetry, longevity, satisfaction)
- Any concerns / side effects
- Exam findings (brief)
- Assessment (result summary)
- Plan (touch-up units/syringes if any, next appt window)`;
  }
  switch (category) {
    case "neurotoxin":
      return `AESTHETIC NEUROTOXIN NOTE
- Chief concerns
- Relevant history / meds / allergies confirmed
- Product (Botox/Dysport/Daxxify/Xeomin/Jeuveau) + dilution
- Units per zone (glabella, frontalis, crow's feet, brow lift, bunny lines, DAO, mentalis, masseter, platysma, etc.)
- Technique / needle / anesthesia
- Adverse events (none / list)
- Post-care instructions given
- Follow-up in 2 weeks`;
    case "filler":
      return `AESTHETIC FILLER NOTE
- Chief concerns
- Product (Juvederm/Restylane/RHA/Radiesse/Sculptra) + lot
- Syringes/mL per region (cheeks, midface, tear trough, NLF, lips, chin, jawline, temples)
- Technique (cannula/needle, gauge), delivery, anesthesia
- Immediate result / symmetry
- Adverse events
- Aftercare + follow-up`;
    case "energy":
      return `ENERGY / LASER / MICRONEEDLING NOTE
- Device (Moxi, BBL, Halo, Morpheus8, Pen microneedling, Everesse, Volnewmer)
- Areas treated
- Settings / passes / depth / fluence / spot size
- Endpoint achieved
- Adverse events
- Post-care + follow-up`;
    case "wellness":
      return `MEDICAL WELLNESS NOTE (SOAP)
S: subjective symptoms, weight, appetite, side effects
O: vitals, weight, relevant exam, current dose
A: response to therapy, tolerance, weight change
P: dose titration, labs ordered, next follow-up, counseling`;
    default:
      return `SOAP NOTE
S: subjective
O: objective
A: assessment
P: plan`;
  }
}

async function generateNote(params: {
  transcript: string;
  category: string | null;
  serviceName: string | null;
  patientFirst: string | null;
  patientLast: string | null;
  allergies: string | null;
  medications: string | null;
}): Promise<{ narrative: string; structured: Record<string, unknown> }> {
  const template = templateForCategory(params.category, params.serviceName);
  const sys = `You are a California board-certified medical aesthetic nurse practitioner scribe. Convert the recorded visit conversation into a clean, defensible clinical note.

STRICT RULES:
- ONLY document what is actually stated in the transcript. Do NOT invent units, doses, lot numbers, products, vitals, or findings.
- Leave any field blank/omit it if it wasn't discussed.
- Use professional medical language, third-person, past-tense for the procedure.
- Include an attestation phrase: "Patient tolerated the procedure well" ONLY if the transcript supports it.
- Never diagnose beyond what was said.
- Match brand names exactly (Botox, Dysport, Daxxify, Xeomin, Jeuveau, Juvederm, Restylane, RHA, Radiesse, Sculptra). Never substitute one for another.
- Output valid JSON only.

Note template for this visit:
${template}

Return JSON with:
{
  "narrative": "full clinical note as a well-formatted string, ready to paste into provider notes",
  "structured": {
    "chief_concerns": [], "assessment": "", "plan": "",
    "product": "", "units_by_zone": { "zone": number }, "syringes_by_region": { "region": number },
    "device_settings": "", "adverse_events": "", "followup_weeks": null
  }
}
Only include structured fields that were actually discussed.`;

  const userMsg = `Patient: ${params.patientFirst ?? ""} ${params.patientLast ?? ""}
Service: ${params.serviceName ?? "unspecified"}
Known allergies: ${params.allergies || "none on file"}
Current medications: ${params.medications || "none on file"}

TRANSCRIPT OF VISIT:
"""
${params.transcript}
"""`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Note generation failed ${res.status}: ${err}`);
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    return {
      narrative: String(parsed.narrative ?? "").trim(),
      structured: parsed.structured ?? {},
    };
  } catch {
    return { narrative: String(raw).trim(), structured: {} };
  }
}

// ---- GFE generation ----
// Turns a visit transcript into a structured GFE draft. The caller passes the
// allowed enum values for each multi-select field so the model can only echo
// exact option labels — anything else is dropped client-side.
async function generateGfe(params: {
  transcript: string;
  patientFirst: string | null;
  patientLast: string | null;
  allergiesOnFile: string | null;
  medsOnFile: string | null;
  options: Record<string, string[]>;
}): Promise<Record<string, unknown>> {
  const opt = params.options ?? {};
  const list = (k: string) => Array.isArray(opt[k]) ? opt[k] : [];

  const sys = `You are a California board-certified NP scribe drafting a Good Faith Exam (GFE) intake from a recorded consultation.

STRICT RULES:
- ONLY document what is actually stated in the transcript. Do NOT invent history, meds, allergies, vitals, or findings.
- For every multi-select field, ONLY return values from the provided allowed list — exact string match, case and punctuation identical. Drop anything not on the list.
- If a field wasn't discussed, return an empty array or null.
- Fitzpatrick must be one of: I, II, III, IV, V, VI (or null).
- Vitals are numbers only (integers) or null. Do NOT guess.
- Output valid JSON only.

Allowed values:
- chief_concerns: ${JSON.stringify(list("chief_concerns"))}
- treatment_goals: ${JSON.stringify(list("treatment_goals"))}
- medical_history: ${JSON.stringify(list("medical_history"))}
- current_medications: ${JSON.stringify(list("current_medications"))}
- allergies: ${JSON.stringify(list("allergies"))}
- prior_treatments: ${JSON.stringify(list("prior_treatments"))}
- skin_assessment: ${JSON.stringify(list("skin_assessment"))}
- pregnancy_status (single): ${JSON.stringify(list("pregnancy_status"))}
- assessment_findings: ${JSON.stringify(list("assessment_findings"))}
- plan_items: ${JSON.stringify(list("plan_items"))}
- additional_approved_services: ${JSON.stringify(list("additional_approved_services"))}

Return JSON with EXACTLY these keys:
{
  "chief_concerns": [], "chief_concerns_notes": "",
  "treatment_goals": [],
  "medical_history": [], "medical_history_other": "",
  "current_medications": [], "current_medications_other": "",
  "allergies": [], "allergies_other": "",
  "prior_treatments": [], "prior_treatments_last_date": "",
  "fitzpatrick": null,
  "skin_assessment": [],
  "bp_systolic": null, "bp_diastolic": null, "heart_rate": null,
  "height_ft": null, "height_in_part": null, "weight_lb": null,
  "pregnancy_status": "",
  "assessment_findings": [],
  "plan_items": [],
  "additional_approved_services": [],
  "plan_notes": ""
}`;

  const userMsg = `Patient: ${params.patientFirst ?? ""} ${params.patientLast ?? ""}
Allergies on file: ${params.allergiesOnFile || "none"}
Meds on file: ${params.medsOnFile || "none"}

TRANSCRIPT:
"""
${params.transcript}
"""`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`GFE generation failed ${res.status}: ${err}`);
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(raw); } catch { return {}; }
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await getUser(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const contentType = req.headers.get("content-type") ?? "";

    // ============ TRANSCRIBE ============
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const sessionId = String(form.get("session_id") ?? "");
      if (!(file instanceof File)) return json({ error: "Audio file required" }, 400);
      if (!sessionId) return json({ error: "session_id required" }, 400);
      if (file.size < 2048) return json({ error: "Recording too short — please try again" }, 400);
      if (file.size > 25 * 1024 * 1024) return json({ error: "Recording too large (max 25MB)" }, 400);

      // Verify session belongs to caller
      const { data: sess, error: sErr } = await svc
        .from("scribe_sessions").select("*").eq("id", sessionId).single();
      if (sErr || !sess) return json({ error: "Session not found" }, 404);
      if (sess.provider_user_id !== user.id) return json({ error: "Forbidden" }, 403);

      // Upload to storage
      const ext = (file.type || "").includes("webm") ? "webm"
        : (file.type || "").includes("mp4") ? "mp4"
        : (file.type || "").includes("ogg") ? "ogg"
        : "wav";
      const path = `${user.id}/${sessionId}.${ext}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const up = await svc.storage.from("scribe-audio").upload(path, bytes, {
        contentType: file.type || "audio/wav",
        upsert: true,
      });
      if (up.error) return json({ error: `Upload failed: ${up.error.message}` }, 500);

      await svc.from("scribe_sessions").update({
        audio_path: path, status: "transcribing",
      }).eq("id", sessionId);

      // Transcribe
      const transcript = await transcribeAudio(file);
      await svc.from("scribe_sessions").update({
        transcript, status: "transcribed",
      }).eq("id", sessionId);

      return json({ ok: true, transcript, session_id: sessionId });
    }

    // ============ GENERATE ============
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "generate";
    const sessionId = String(body.session_id ?? "");
    if (!sessionId) return json({ error: "session_id required" }, 400);

    const { data: sess, error: sErr } = await svc
      .from("scribe_sessions").select("*").eq("id", sessionId).single();
    if (sErr || !sess) return json({ error: "Session not found" }, 404);
    if (sess.provider_user_id !== user.id && !(await isAdmin(svc, user.id)))
      return json({ error: "Forbidden" }, 403);

    if (action === "generate") {
      if (!sess.transcript || sess.transcript.trim().length < 5) {
        return json({ error: "No transcript to generate from" }, 400);
      }
      // Fetch light patient context
      let allergies: string | null = null;
      let medications: string | null = null;
      let firstName: string | null = null;
      let lastName: string | null = null;
      if (sess.client_email) {
        const { data: prof } = await svc.from("client_profiles")
          .select("first_name,last_name,allergies,current_medications")
          .eq("email", sess.client_email).maybeSingle();
        if (prof) {
          firstName = prof.first_name; lastName = prof.last_name;
          allergies = Array.isArray(prof.allergies) ? prof.allergies.join(", ") : (prof.allergies ?? null);
          medications = Array.isArray(prof.current_medications) ? prof.current_medications.join(", ") : (prof.current_medications ?? null);
        }
      }

      await svc.from("scribe_sessions").update({ status: "generating" }).eq("id", sessionId);
      const result = await generateNote({
        transcript: sess.transcript,
        category: sess.category,
        serviceName: sess.service_name,
        patientFirst: firstName,
        patientLast: lastName,
        allergies,
        medications,
      });
      await svc.from("scribe_sessions").update({
        status: "generated", generated_note: result,
      }).eq("id", sessionId);
      return json({ ok: true, ...result });
    }

    if (action === "generate_gfe") {
      if (!sess.transcript || sess.transcript.trim().length < 5) {
        return json({ error: "No transcript to generate from" }, 400);
      }
      let allergies: string | null = null;
      let medications: string | null = null;
      let firstName: string | null = null;
      let lastName: string | null = null;
      if (sess.client_email) {
        const { data: prof } = await svc.from("client_profiles")
          .select("first_name,last_name,allergies,current_medications")
          .eq("email", sess.client_email).maybeSingle();
        if (prof) {
          firstName = prof.first_name; lastName = prof.last_name;
          allergies = Array.isArray(prof.allergies) ? prof.allergies.join(", ") : (prof.allergies ?? null);
          medications = Array.isArray(prof.current_medications) ? prof.current_medications.join(", ") : (prof.current_medications ?? null);
        }
      }
      await svc.from("scribe_sessions").update({ status: "generating" }).eq("id", sessionId);
      const gfe = await generateGfe({
        transcript: sess.transcript,
        patientFirst: firstName,
        patientLast: lastName,
        allergiesOnFile: allergies,
        medsOnFile: medications,
        options: (body.options ?? {}) as Record<string, string[]>,
      });
      await svc.from("scribe_sessions").update({
        status: "generated", generated_note: { gfe },
      }).eq("id", sessionId);
      return json({ ok: true, gfe });
    }

    return json({ error: "Unknown action" }, 400);

  } catch (err) {
    console.error("[ai-scribe] error", err);
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});

async function isAdmin(svc: ReturnType<typeof createClient>, uid: string): Promise<boolean> {
  const { data } = await svc.from("user_roles").select("role").eq("user_id", uid);
  return Array.isArray(data) && data.some((r) => r.role === "admin");
}
