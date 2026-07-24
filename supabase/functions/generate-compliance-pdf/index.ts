// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: any, s = 200) => new Response(JSON.stringify(b), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: s });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supaUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supaUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { signatureId } = await req.json();
    if (!signatureId) return json({ error: "signatureId required" }, 400);

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: sig, error: sigErr } = await supa
      .from("compliance_signatures")
      .select("*")
      .eq("id", signatureId)
      .maybeSingle();
    if (sigErr || !sig) return json({ error: "Signature not found" }, 404);
    if (sig.staff_user_id !== user.id) {
      const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
    }

    const { data: protocol } = await supa
      .from("compliance_protocols")
      .select("*")
      .eq("id", sig.protocol_id)
      .maybeSingle();
    if (!protocol) return json({ error: "Protocol not found" }, 404);

    const { data: staff } = await supa
      .from("staff_profiles")
      .select("full_name, license_number, title")
      .eq("id", sig.staff_id)
      .maybeSingle();

    // ---------- PDF ----------
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

    const PAGE_W = 612, PAGE_H = 792;
    const MARGIN = 54;
    const MAX_W = PAGE_W - MARGIN * 2;
    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    const newPage = () => { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; };
    const ensure = (h: number) => { if (y - h < MARGIN + 40) { drawFooter(); newPage(); } };

    const wrap = (text: string, f: any, size: number, maxW: number) => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (f.widthOfTextAtSize(test, size) > maxW) {
          if (cur) lines.push(cur);
          cur = w;
        } else cur = test;
      }
      if (cur) lines.push(cur);
      return lines;
    };

    const drawText = (text: string, opts: { f?: any; size?: number; color?: any; indent?: number } = {}) => {
      const f = opts.f ?? font;
      const size = opts.size ?? 10;
      const color = opts.color ?? rgb(0.1, 0.1, 0.12);
      const indent = opts.indent ?? 0;
      for (const para of text.split("\n")) {
        const lines = wrap(para, f, size, MAX_W - indent);
        for (const line of lines) {
          ensure(size + 4);
          page.drawText(line, { x: MARGIN + indent, y: y - size, size, font: f, color });
          y -= size + 4;
        }
      }
    };

    const drawFooter = () => {
      const footerY = MARGIN - 20;
      page.drawText(
        `${protocol.title} v${protocol.version} · Signed ${new Date(sig.signed_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} PT · Signature ID ${sig.id.slice(0, 8)}`,
        { x: MARGIN, y: footerY, size: 7, font, color: rgb(0.4, 0.4, 0.45) },
      );
    };

    // Header
    page.drawText("RADIANTILYK AESTHETIC", { x: MARGIN, y, size: 11, font: bold, color: rgb(0.15, 0.15, 0.18) });
    y -= 14;
    page.drawText("Staff Compliance & Protocol Acknowledgment", { x: MARGIN, y, size: 9, font: italic, color: rgb(0.4, 0.4, 0.45) });
    y -= 24;
    drawText(protocol.title, { f: bold, size: 16 });
    y -= 4;
    drawText(`Version ${protocol.version}  ·  ${protocol.category.toUpperCase()}  ·  Renewal: ${protocol.renewal_months} months`, { f: italic, size: 9, color: rgb(0.4, 0.4, 0.45) });
    y -= 12;
    if (protocol.summary) { drawText(protocol.summary, { f: italic, size: 10, color: rgb(0.3, 0.3, 0.35) }); y -= 6; }

    // Signer block at top
    drawText("Signed by", { f: bold, size: 10 }); y -= 2;
    drawText(`Name:          ${sig.signed_full_name}`);
    drawText(`Role:          ${staff?.title ?? "—"}`);
    drawText(`License #:     ${sig.license_number || "—"}${sig.license_state ? `  (${sig.license_state})` : ""}`);
    drawText(`Signed at:     ${new Date(sig.signed_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} America/Los_Angeles`);
    if (sig.expires_at) drawText(`Valid through: ${new Date(sig.expires_at).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })}`);
    drawText(`IP address:    ${sig.ip_address || "—"}`);
    drawText(`Signature ID:  ${sig.id}`);
    y -= 10;

    // Body sections
    const sections = (protocol.sections || []) as { id: string; title: string; body: string }[];
    sections.forEach((s, i) => {
      ensure(40);
      y -= 4;
      drawText(`Section ${i + 1}. ${s.title}`, { f: bold, size: 12 });
      y -= 2;
      drawText(s.body, { size: 10 });
      const initial = (sig.section_initials || {})[s.id] || "";
      ensure(20);
      drawText(`Initialed: ${initial}`, { f: bold, size: 9, color: rgb(0.05, 0.45, 0.25) });
      y -= 6;
    });

    // Final attestation + signature image
    ensure(180);
    y -= 8;
    drawText("Final Attestation", { f: bold, size: 12 });
    y -= 2;
    drawText(
      "I have read, understood, and agree to follow this protocol in its entirety. I understand that deviation may result in disciplinary action up to and including termination and reporting to the appropriate licensing board. My typed name, drawn signature, license number, IP address, and timestamp constitute my legal electronic signature under E-SIGN and UETA.",
      { size: 10 },
    );
    y -= 14;

    // Signature image
    if (sig.signature_png && sig.signature_png.startsWith("data:image/png;base64,")) {
      try {
        const b64 = sig.signature_png.split(",")[1];
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const img = await pdf.embedPng(bytes);
        const targetW = 260;
        const scale = targetW / img.width;
        const targetH = img.height * scale;
        ensure(targetH + 30);
        page.drawText("Signature:", { x: MARGIN, y: y - 10, size: 9, font: bold });
        page.drawImage(img, { x: MARGIN + 70, y: y - targetH - 4, width: targetW, height: targetH });
        page.drawLine({
          start: { x: MARGIN + 70, y: y - targetH - 6 },
          end: { x: MARGIN + 70 + targetW, y: y - targetH - 6 },
          thickness: 0.5, color: rgb(0.3, 0.3, 0.35),
        });
        y -= targetH + 20;
      } catch (_e) { /* skip */ }
    }
    drawText(`x  ${sig.signed_full_name}`, { f: bold, size: 11 });
    drawText(`License #: ${sig.license_number || "—"}    Date: ${new Date(sig.signed_at).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })}`, { size: 10 });

    drawFooter();

    const pdfBytes = await pdf.save();
    const path = `${sig.staff_user_id}/${sig.id}.pdf`;
    const { error: upErr } = await supa.storage
      .from("compliance-signatures")
      .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) return json({ error: upErr.message }, 500);

    // Hash
    const hashBuf = await crypto.subtle.digest("SHA-256", pdfBytes);
    const hashHex = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

    await supa.from("compliance_signatures").update({ pdf_path: path, pdf_sha256: hashHex }).eq("id", sig.id);

    const { data: signed } = await supa.storage.from("compliance-signatures").createSignedUrl(path, 3600);

    return json({ ok: true, path, signedUrl: signed?.signedUrl, sha256: hashHex });
  } catch (e: any) {
    console.error("generate-compliance-pdf", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
