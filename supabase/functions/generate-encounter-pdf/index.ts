// Generate a clinical visit-note PDF and a patient-handout PDF for a signed
// clinical_encounter, upload to storage, and store URLs on the row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRESET_META: Record<string, { label: string; counseling: string[]; redFlags: string[]; evidence: string[] }> = {
  glp1: {
    label: "GLP-1 Weight Management",
    counseling: [
      "Inject SC; rotate sites weekly.",
      "Hydrate; protein 1.2-1.6 g/kg; resistance training to preserve lean mass.",
      "Hold dose and call for severe abdominal pain, persistent vomiting, dehydration, vision changes.",
      "Stop and notify provider immediately if pregnancy suspected; discontinue 2 months before planned conception.",
    ],
    redFlags: ["Severe persistent abdominal pain","Intractable vomiting / dehydration","Gallbladder pain, jaundice","Hypoglycemia","New thyroid nodule","Suicidal ideation"],
    evidence: [
      "Wilding JPH, et al. Semaglutide STEP 1. NEJM 2021;384:989-1002. PMID:33567185",
      "Jastreboff AM, et al. Tirzepatide SURMOUNT-1. NEJM 2022;387:205-216. PMID:35658024",
    ],
  },
  hrt: {
    label: "Hormone Replacement Therapy",
    counseling: [
      "Apply patch to clean dry skin below the waist; rotate sites.","Take oral progesterone at bedtime.",
      "Testosterone cream: alternate inner thigh daily; avoid skin transfer for 4 h.",
      "Report new breast lump, abnormal vaginal bleeding, calf swelling, severe HA / vision change, chest pain.",
    ],
    redFlags: ["New breast mass","Abnormal uterine bleeding","Unilateral leg swelling","Severe HA, vision loss","Chest pain / SOB"],
    evidence: [
      "NAMS 2022 Hormone Therapy Position Statement. Menopause 2022;29:767-794. PMID:35797481",
      "Endocrine Society Testosterone Therapy in Men. JCEM 2018;103:1715-1744. PMID:29562364",
    ],
  },
  peptide: {
    label: "Peptide Therapy",
    counseling: [
      "Reconstitute per pharmacy; store refrigerated.","SC injection; cycle on/off per protocol.",
      "Discontinue and call for injection-site reaction, palpitations, persistent HA, severe edema.",
    ],
    redFlags: ["Suspected malignancy","Active retinopathy","Severe edema","Carpal tunnel symptoms"],
    evidence: ["Sigalos JT, Pastuszak AW. GH Secretagogues Safety/Efficacy. Sex Med Rev 2018;6:45-53. PMID:28526632"],
  },
  other: { label: "Other", counseling: [], redFlags: [], evidence: [] },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization");
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth ?? "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: isNP }, { data: isAdmin }] = await Promise.all([
      svc.rpc("is_nurse_practitioner", { _user_id: user.id }),
      svc.rpc("is_admin", { _user_id: user.id }),
    ]);
    if (!isNP && !isAdmin) return json({ error: "Forbidden" }, 403);

    const { encounter_id } = await req.json();
    if (!encounter_id) return json({ error: "encounter_id required" }, 400);

    const { data: enc, error: eErr } = await svc.from("clinical_encounters").select("*").eq("id", encounter_id).maybeSingle();
    if (eErr || !enc) return json({ error: "Encounter not found" }, 404);

    const [{ data: labs }, { data: rx }, { data: fuArr }] = await Promise.all([
      svc.from("clinical_encounter_labs").select("*").eq("encounter_id", encounter_id),
      svc.from("clinical_encounter_prescriptions").select("*").eq("encounter_id", encounter_id),
      svc.from("clinical_encounter_followups").select("*").eq("encounter_id", encounter_id).limit(1),
    ]);
    const fu = (fuArr ?? [])[0] ?? null;

    const meta = PRESET_META[enc.category] ?? PRESET_META.other;
    const patientLine = `${enc.client_first_name} ${enc.client_last_name}${enc.client_dob ? ` · DOB ${enc.client_dob}` : ""} · ${enc.client_email}`;
    const visitLabel = enc.visit_type === "new" ? "New Visit" : "Follow-up Visit";
    const stamp = new Date(enc.signed_at ?? Date.now()).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) + " PT";

    const clinicalSections: Array<[string, string]> = [
      ["Visit", `${visitLabel} · ${meta.label}`],
      ["Patient", patientLine],
      ["Date / Signed", stamp],
      ["Chief complaint", enc.chief_complaint || "—"],
      ["Subjective (HPI/ROS)", enc.subjective || "—"],
      ["Objective", enc.objective || "—"],
      ["Labs", labsBlock(labs ?? [])],
      ["Assessment", enc.assessment || "—"],
      ["Plan / Prescriptions", rxBlock(rx ?? [], enc.plan)],
    ];
    if (fu) {
      clinicalSections.push(["Follow-up — Tolerability", fu.tolerability || "—"]);
      clinicalSections.push(["Follow-up — Adverse events", fu.adverse_events || "—"]);
      clinicalSections.push(["Follow-up — Objective deltas", fu.objective_deltas || "—"]);
      clinicalSections.push(["Decision", `${(fu.decision || "—").toString().toUpperCase()} — ${fu.rationale || ""}`.trim()]);
    }
    clinicalSections.push(["Counseling reviewed", meta.counseling.map(c => `• ${c}`).join("\n") || "—"]);
    clinicalSections.push(["Red flags reviewed", meta.redFlags.map(c => `• ${c}`).join("\n") || "—"]);
    clinicalSections.push(["503A / Medical necessity", enc.necessity_attestation || "—"]);
    clinicalSections.push(["Evidence", meta.evidence.map(c => `• ${c}`).join("\n") || "—"]);

    const clinicalBytes = await buildPdf({
      title: `Clinical Visit Note — ${meta.label}`,
      subtitle: `${visitLabel} · ${stamp}`,
      sections: clinicalSections,
      signaturePng: enc.signature_png ?? null,
      signedBy: enc.signed_by_name ?? "",
      signedLicense: enc.signed_by_license ?? "",
      signedAt: enc.signed_at ?? new Date().toISOString(),
    });

    const handoutSections: Array<[string, string]> = [
      ["Your visit", `${visitLabel} · ${meta.label} · ${stamp}`],
      ["Your prescriptions", rxBlockPlain(rx ?? [])],
      ["How to take it / Important counseling", meta.counseling.map(c => `• ${c}`).join("\n") || "—"],
      ["When to call us or seek emergency care", meta.redFlags.map(c => `• ${c}`).join("\n") || "—"],
      ["Plan", enc.plan || "Follow up as discussed."],
      ["Contact", "Radiantilyk Aesthetic — message us through your patient portal or call your provider with urgent questions."],
    ];
    const handoutBytes = await buildPdf({
      title: `${meta.label} — Patient Information`,
      subtitle: `Prepared for ${enc.client_first_name} ${enc.client_last_name}`,
      sections: handoutSections,
      signaturePng: null, signedBy: "", signedLicense: "", signedAt: "",
    });

    const ts = Date.now();
    const safeEmail = String(enc.client_email).toLowerCase().replace(/[^a-z0-9._-]/g, "_");
    const clinicalPath = `${safeEmail}/encounter-${encounter_id}-clinical-${ts}.pdf`;
    const handoutPath = `${safeEmail}/encounter-${encounter_id}-handout-${ts}.pdf`;

    const [u1, u2] = await Promise.all([
      svc.storage.from("clinical-protocols").upload(clinicalPath, clinicalBytes, { contentType: "application/pdf", upsert: true }),
      svc.storage.from("clinical-protocols").upload(handoutPath, handoutBytes, { contentType: "application/pdf", upsert: true }),
    ]);
    if (u1.error || u2.error) return json({ error: u1.error?.message ?? u2.error?.message ?? "upload failed" }, 500);
    const [s1, s2] = await Promise.all([
      svc.storage.from("clinical-protocols").createSignedUrl(clinicalPath, 60 * 60 * 24 * 30),
      svc.storage.from("clinical-protocols").createSignedUrl(handoutPath, 60 * 60 * 24 * 30),
    ]);
    const clinical_pdf_url = s1.data?.signedUrl ?? null;
    const handout_pdf_url = s2.data?.signedUrl ?? null;

    await svc.from("clinical_encounters").update({ clinical_pdf_url, handout_pdf_url }).eq("id", encounter_id);

    try {
      await svc.rpc("log_phi_access", {
        _resource_type: "clinical_encounter", _resource_id: encounter_id,
        _client_email: String(enc.client_email).toLowerCase(),
        _action: "sign", _route: "generate-encounter-pdf",
        _metadata: { category: enc.category, visit_type: enc.visit_type },
      });
    } catch {/**/}

    return json({ clinical_pdf_url, handout_pdf_url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function labsBlock(rows: any[]): string {
  if (!rows.length) return "—";
  return rows.map(l =>
    `• ${l.analyte}: ${l.value ?? "—"}${l.unit ? ` ${l.unit}` : ""} (${l.source === "ordered_today" ? "ordered today" : "prior"}${l.drawn_on ? `, ${l.drawn_on}` : ""})`
  ).join("\n");
}
function rxBlock(rows: any[], planText: string | null): string {
  const lines: string[] = [];
  for (const r of rows) {
    lines.push(`• ${r.drug}${r.strength ? ` ${r.strength}` : ""}: ${[r.frequency, r.route, r.duration].filter(Boolean).join(", ")}${r.dispense ? `; dispense ${r.dispense}` : ""}; refills × ${r.refills ?? 0}${r.notes ? `\n   Notes: ${r.notes}` : ""}`);
    if (Array.isArray(r.titration) && r.titration.length) {
      for (const t of r.titration) lines.push(`   - Week ${t.week}: ${t.dose}${t.notes ? ` — ${t.notes}` : ""}`);
    }
  }
  if (planText) lines.push("", planText);
  return lines.join("\n") || (planText || "—");
}
function rxBlockPlain(rows: any[]): string {
  if (!rows.length) return "See plan from your provider.";
  return rows.map(r => `• ${r.drug}${r.strength ? ` ${r.strength}` : ""} — ${[r.frequency, r.route].filter(Boolean).join(", ")}${r.duration ? `, for ${r.duration}` : ""}.`).join("\n");
}

async function buildPdf(opts: {
  title: string; subtitle: string; sections: Array<[string, string]>;
  signaturePng: string | null; signedBy: string; signedLicense: string; signedAt: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48, pageW = 612, pageH = 792, wrapWidth = pageW - margin * 2;

  function sanitize(s: string): string {
    if (!s) return "";
    return s.replace(/[\u2018\u2019\u201A\u2032]/g, "'").replace(/[\u201C\u201D\u201E\u2033]/g, '"')
      .replace(/[\u2013\u2014\u2212]/g, "-").replace(/\u2026/g, "...").replace(/\u00A0/g, " ")
      .replace(/[\u2022\u25A0\u25CF\u25AA\u25AB\u25E6]/g, "*")
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
  }
  let p = pdf.addPage([pageW, pageH]);
  let y = pageH - margin;
  function newPage() { p = pdf.addPage([pageW, pageH]); y = pageH - margin; header(false); }
  function wrap(text: string, size = 10) {
    const lines: string[] = [];
    for (const para of sanitize(text).split(/\n/)) {
      const words = para.split(/\s+/); let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (font.widthOfTextAtSize(test, size) > wrapWidth) { if (line) lines.push(line); line = w; } else line = test;
      }
      lines.push(line);
    }
    return lines;
  }
  function ensure(space: number) { if (y < margin + space) newPage(); }
  function header(showTitle = true) {
    p.drawText(sanitize("Radiantilyk Aesthetic — CONFIDENTIAL CLINICAL DOCUMENT"), { x: margin, y: pageH - margin + 12, size: 8, font: fontBold, color: rgb(0.45,0.45,0.45) });
    if (showTitle) {
      p.drawText(sanitize(opts.title), { x: margin, y: pageH - margin - 8, size: 16, font: fontBold });
      p.drawText(sanitize(opts.subtitle), { x: margin, y: pageH - margin - 24, size: 9, font, color: rgb(0.35,0.35,0.35) });
      p.drawLine({ start: { x: margin, y: pageH - margin - 32 }, end: { x: pageW - margin, y: pageH - margin - 32 }, thickness: 0.5, color: rgb(0.8,0.8,0.8) });
      y = pageH - margin - 48;
    }
  }
  header();
  for (const [label, value] of opts.sections) {
    ensure(40); y -= 4;
    p.drawText(sanitize(label.toUpperCase()), { x: margin, y, size: 10, font: fontBold, color: rgb(0.2,0.2,0.2) });
    y -= 4;
    p.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 0.4, color: rgb(0.85,0.85,0.85) });
    y -= 12;
    for (const ln of wrap(value || "—", 10)) { ensure(16); p.drawText(sanitize(ln), { x: margin, y, size: 10, font }); y -= 13; }
    y -= 4;
  }
  if (opts.signaturePng) {
    ensure(140); y -= 8;
    p.drawText(sanitize("PROVIDER SIGNATURE"), { x: margin, y, size: 10, font: fontBold, color: rgb(0.2,0.2,0.2) }); y -= 14;
    p.drawText(sanitize(`Signed by: ${opts.signedBy}${opts.signedLicense ? ` (${opts.signedLicense})` : ""}`), { x: margin, y, size: 10, font }); y -= 13;
    p.drawText(sanitize(`Signed at: ${new Date(opts.signedAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} PT`), { x: margin, y, size: 10, font }); y -= 13;
    if (opts.signaturePng.startsWith("data:image/png")) {
      try {
        const b64 = opts.signaturePng.split(",")[1];
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const img = await pdf.embedPng(bytes);
        const w = 200, h = 60; ensure(h + 10);
        p.drawImage(img, { x: margin, y: y - h, width: w, height: h }); y -= h + 6;
      } catch {/**/}
    }
  }
  return await pdf.save();
}
