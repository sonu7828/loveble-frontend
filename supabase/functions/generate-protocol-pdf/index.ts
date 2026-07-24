// Generates a clinical-protocol PDF + patient-handout PDF for a specific
// protocol version, stamps the patient on it, uploads both to storage, and
// records an immutable application row on the patient chart.
//
// Body: { version_id: string, client_email: string, client_first_name: string,
//         client_last_name: string, client_dob?: string, starting_week?: number,
//         prescriber_notes?: string, appointment_id?: string | null }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("authorization");
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader ?? "" } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: isNP }, { data: isAdmin }] = await Promise.all([
      svc.rpc("is_nurse_practitioner", { _user_id: user.id }),
      svc.rpc("is_admin", { _user_id: user.id }),
    ]);
    if (!isNP && !isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const { version_id, client_email, client_first_name, client_last_name,
            client_dob, starting_week, prescriber_notes, appointment_id } = body ?? {};
    if (!version_id || !client_email || !client_first_name || !client_last_name) {
      return json({ error: "Missing required fields" }, 400);
    }

    const { data: v, error: vErr } = await svc
      .from("clinical_protocol_versions").select("*, clinical_protocols(title, category, slug)")
      .eq("id", version_id).maybeSingle();
    if (vErr || !v) return json({ error: "Protocol version not found" }, 404);
    if (v.status !== "published") return json({ error: "Only published protocols can be applied" }, 400);

    const proto = (v as any).clinical_protocols;
    const stamp = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) + " PT";
    const patientLine = `${client_first_name} ${client_last_name}${client_dob ? ` · DOB ${client_dob}` : ""} · ${client_email}`;

    // Build clinical PDF
    const clinicalBytes = await buildPdf({
      title: `Clinical Protocol — ${proto.title}`,
      subtitle: `Version ${v.version_number} · Published ${v.signed_at ? new Date(v.signed_at).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" }) : "—"} · Signed by ${v.signed_by_name ?? "—"}`,
      patientLine,
      stampLine: `Applied to chart: ${stamp} · Starting week: ${starting_week ?? 1}`,
      sections: buildClinicalSections(v, prescriber_notes),
      signaturePng: v.signature_png ?? null,
      signedBy: v.signed_by_name ?? "",
      signedAt: v.signed_at ?? new Date().toISOString(),
    });

    // Build patient handout PDF
    const handoutBytes = await buildPdf({
      title: `${proto.title} — Patient Information`,
      subtitle: `Provided by Radiantilyk Aesthetic`,
      patientLine,
      stampLine: `Issued: ${stamp}`,
      sections: buildHandoutSections(v),
      signaturePng: null,
      signedBy: "",
      signedAt: "",
    });

    const ts = Date.now();
    const safeEmail = String(client_email).toLowerCase().replace(/[^a-z0-9._-]/g, "_");
    const clinicalPath = `${safeEmail}/${proto.slug}-v${v.version_number}-clinical-${ts}.pdf`;
    const handoutPath = `${safeEmail}/${proto.slug}-v${v.version_number}-handout-${ts}.pdf`;

    const [up1, up2] = await Promise.all([
      svc.storage.from("clinical-protocols").upload(clinicalPath, clinicalBytes, { contentType: "application/pdf", upsert: true }),
      svc.storage.from("clinical-protocols").upload(handoutPath, handoutBytes, { contentType: "application/pdf", upsert: true }),
    ]);
    if (up1.error || up2.error) return json({ error: up1.error?.message ?? up2.error?.message ?? "upload failed" }, 500);

    const [s1, s2] = await Promise.all([
      svc.storage.from("clinical-protocols").createSignedUrl(clinicalPath, 60 * 60 * 24 * 30),
      svc.storage.from("clinical-protocols").createSignedUrl(handoutPath, 60 * 60 * 24 * 30),
    ]);
    const clinicalUrl = s1.data?.signedUrl ?? null;
    const handoutUrl = s2.data?.signedUrl ?? null;

    const { data: app, error: appErr } = await svc.from("clinical_protocol_applications").insert({
      protocol_version_id: version_id,
      client_email: String(client_email).toLowerCase(),
      client_first_name,
      client_last_name,
      client_dob: client_dob ?? null,
      appointment_id: appointment_id ?? null,
      starting_week: starting_week ?? null,
      prescriber_notes: prescriber_notes ?? null,
      clinical_pdf_url: clinicalUrl,
      handout_pdf_url: handoutUrl,
      applied_by: user.id,
    }).select("id").maybeSingle();
    if (appErr) return json({ error: appErr.message }, 500);

    // PHI audit
    try {
      await svc.rpc("log_phi_access", {
        _resource_type: "clinical_protocol_application",
        _resource_id: app?.id,
        _client_email: String(client_email).toLowerCase(),
        _action: "apply",
        _route: "generate-protocol-pdf",
        _metadata: { version_id, protocol_slug: proto.slug, version_number: v.version_number },
      });
    } catch {/**/}

    return json({ application_id: app?.id, clinical_pdf_url: clinicalUrl, handout_pdf_url: handoutUrl });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function buildClinicalSections(v: any, prescriberNotes: string | null | undefined): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  out.push(["Indication", v.indication || "—"]);
  out.push(["Regulatory basis", v.regulatory_basis || "—"]);

  const c = v.contraindications || {};
  out.push(["Absolute contraindications", listLines(c.absolute)]);
  out.push(["Relative contraindications", listLines(c.relative)]);

  out.push(["Required baseline labs", listLines(v.baseline_labs)]);
  out.push(["Required follow-up labs", listLines(v.followup_labs)]);

  out.push(["Titration schedule", titrationLines(v.titration)]);
  out.push(["Maximum dose", v.max_dose || "—"]);
  out.push(["Dose-hold criteria", v.hold_criteria || "—"]);
  out.push(["Taper / discontinuation rules", v.taper_rules || "—"]);

  out.push(["Monitoring checkpoints", listLines(v.monitoring)]);
  out.push(["Red flags / stop criteria", listLines(v.red_flags)]);
  out.push(["Patient counseling points", listLines(v.counseling)]);

  out.push(["Evidence citations", citationLines(v.evidence)]);
  out.push(["503A / medical necessity attestation", v.necessity_template || "—"]);

  if (prescriberNotes) out.push(["Prescriber notes for this patient", prescriberNotes]);
  return out;
}

function buildHandoutSections(v: any): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (v.patient_handout_md && String(v.patient_handout_md).trim()) {
    out.push(["About your treatment", v.patient_handout_md]);
  }
  if (Array.isArray(v.counseling) && v.counseling.length) {
    out.push(["Important counseling points", listLines(v.counseling)]);
  }
  if (Array.isArray(v.red_flags) && v.red_flags.length) {
    out.push(["When to call us or seek emergency care", listLines(v.red_flags)]);
  }
  out.push(["Contact", "Radiantilyk Aesthetic — message us through your patient portal or call your provider for any urgent questions."]);
  return out;
}

function listLines(arr: any): string {
  if (!Array.isArray(arr) || arr.length === 0) return "—";
  return arr.map((x: any) => `• ${typeof x === "string" ? x : JSON.stringify(x)}`).join("\n");
}
function titrationLines(arr: any): string {
  if (!Array.isArray(arr) || arr.length === 0) return "—";
  return arr.map((t: any) =>
    `• Week ${t.week ?? "?"}: ${t.dose ?? "—"}${t.route ? `, ${t.route}` : ""}${t.frequency ? `, ${t.frequency}` : ""}${t.notes ? ` — ${t.notes}` : ""}`
  ).join("\n");
}
function citationLines(arr: any): string {
  if (!Array.isArray(arr) || arr.length === 0) return "—";
  return arr.map((e: any) => {
    const tag = [e.pmid ? `PMID:${e.pmid}` : null, e.doi ? `DOI:${e.doi}` : null].filter(Boolean).join(" · ");
    return `• ${e.citation || e.url || ""}${tag ? `  (${tag})` : ""}`;
  }).join("\n");
}

async function buildPdf(opts: {
  title: string; subtitle: string; patientLine: string; stampLine: string;
  sections: Array<[string, string]>; signaturePng: string | null; signedBy: string; signedAt: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48, pageW = 612, pageH = 792, wrapWidth = pageW - margin * 2;

  function sanitize(s: string): string {
    if (!s) return "";
    return s
      .replace(/[\u2018\u2019\u201A\u2032]/g, "'").replace(/[\u201C\u201D\u201E\u2033]/g, '"')
      .replace(/[\u2013\u2014\u2212]/g, "-").replace(/\u2026/g, "...").replace(/\u00A0/g, " ")
      .replace(/[\u2022\u25A0\u25CF\u25AA\u25AB\u25E6]/g, "*")
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
  }
  function newPage() {
    const p = pdf.addPage([pageW, pageH]);
    return { p, y: pageH - margin };
  }
  function wrap(text: string, size = 10) {
    const lines: string[] = [];
    for (const para of sanitize(text).split(/\n/)) {
      const words = para.split(/\s+/); let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (font.widthOfTextAtSize(test, size) > wrapWidth) { if (line) lines.push(line); line = w; }
        else line = test;
      }
      lines.push(line);
    }
    return lines;
  }
  let ctx = newPage();
  function ensure(space: number) {
    if (ctx.y < margin + space) { ctx = newPage(); }
  }
  function header() {
    ctx.p.drawText(sanitize("Radiantilyk Aesthetic — CONFIDENTIAL CLINICAL DOCUMENT"), {
      x: margin, y: pageH - margin + 12, size: 8, font: fontBold, color: rgb(0.45,0.45,0.45),
    });
    ctx.p.drawText(sanitize(opts.title), { x: margin, y: pageH - margin - 8, size: 16, font: fontBold });
    ctx.p.drawText(sanitize(opts.subtitle), { x: margin, y: pageH - margin - 24, size: 9, font, color: rgb(0.35,0.35,0.35) });
    ctx.p.drawLine({ start: { x: margin, y: pageH - margin - 32 }, end: { x: pageW - margin, y: pageH - margin - 32 }, thickness: 0.5, color: rgb(0.8,0.8,0.8) });
    ctx.y = pageH - margin - 48;
  }
  function row(label: string, value: string) {
    ensure(30);
    ctx.p.drawText(sanitize(label), { x: margin, y: ctx.y, size: 9, font: fontBold, color: rgb(0.4,0.4,0.4) });
    ctx.y -= 12;
    for (const ln of wrap(value || "—", 10)) {
      ensure(16);
      ctx.p.drawText(sanitize(ln), { x: margin, y: ctx.y, size: 10, font });
      ctx.y -= 13;
    }
    ctx.y -= 6;
  }
  header();
  row("Patient", opts.patientLine);
  row("", opts.stampLine);

  for (const [label, value] of opts.sections) {
    ensure(40); ctx.y -= 4;
    ctx.p.drawText(sanitize(label.toUpperCase()), { x: margin, y: ctx.y, size: 10, font: fontBold, color: rgb(0.2,0.2,0.2) });
    ctx.y -= 4;
    ctx.p.drawLine({ start: { x: margin, y: ctx.y }, end: { x: pageW - margin, y: ctx.y }, thickness: 0.4, color: rgb(0.85,0.85,0.85) });
    ctx.y -= 12;
    for (const ln of wrap(value || "—", 10)) {
      ensure(16);
      ctx.p.drawText(sanitize(ln), { x: margin, y: ctx.y, size: 10, font });
      ctx.y -= 13;
    }
    ctx.y -= 4;
  }

  if (opts.signaturePng) {
    ensure(140); ctx.y -= 8;
    ctx.p.drawText(sanitize("PROVIDER SIGNATURE — PROTOCOL ATTESTATION"), { x: margin, y: ctx.y, size: 10, font: fontBold, color: rgb(0.2,0.2,0.2) });
    ctx.y -= 14;
    row("Signed by", opts.signedBy);
    row("Signed at", opts.signedAt ? new Date(opts.signedAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) + " PT" : "—");
    if (opts.signaturePng.startsWith("data:image/png")) {
      try {
        const b64 = opts.signaturePng.split(",")[1];
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const img = await pdf.embedPng(bytes);
        const w = 200, h = 60; ensure(h + 10);
        ctx.p.drawImage(img, { x: margin, y: ctx.y - h, width: w, height: h });
        ctx.y -= h + 6;
      } catch {/**/}
    }
  }

  return await pdf.save();
}
