// Generates a single PDF receipt for all consents signed on an appointment.
// Uploads to Storage, updates appointments.consent_pdf_url, returns the URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseJwtRole(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const payload = authHeader.slice(7).split(".")[1];
    const j = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(j).role ?? null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("authorization");
    const isServiceRole = parseJwtRole(authHeader) === "service_role";
    if (!isServiceRole) {
      // Allow authenticated staff/admin to generate as well
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader ?? "" } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: ok } = await svc.rpc("is_staff_or_admin", { _user_id: user.id });
      if (!ok) return json({ error: "Forbidden" }, 403);
    }
    const { appointmentId } = await req.json();
    if (!appointmentId) return json({ error: "appointmentId required" }, 400);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: appt, error: aErr } = await supa
      .from("appointments")
      .select("id, client_first_name, client_last_name, client_email, start_at, service_id, staff_id, location_id")
      .eq("id", appointmentId).single();
    if (aErr || !appt) return json({ error: "Appointment not found" }, 404);

    const [{ data: svc }, { data: staff }, { data: loc }, { data: sigs }] = await Promise.all([
      supa.from("services").select("name").eq("id", appt.service_id).single(),
      supa.from("staff_profiles").select("full_name").eq("id", appt.staff_id).single(),
      supa.from("locations").select("name, address, city, state, zip").eq("id", appt.location_id).single(),
      supa.from("consent_signatures")
        .select("signed_full_name, signature_png, signed_at, decision, form_version, consent_form_id, consent_forms!inner(title, body_markdown, slug)")
        .eq("appointment_id", appointmentId)
        .order("signed_at", { ascending: true }),
    ]);

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const margin = 48;
    const pageW = 612, pageH = 792;
    const wrapWidth = pageW - margin * 2;

    function newPage() {
      const p = pdf.addPage([pageW, pageH]);
      const orig = p.drawText.bind(p);
      (p as any).drawText = (text: string, opts: any) => orig(sanitize(text ?? ""), opts);
      return { p, y: pageH - margin };
    }

    function drawHeader(p: any, title: string) {
      p.drawText("Radiantilyk Aesthetic", { x: margin, y: pageH - margin + 12, size: 9, font: fontBold, color: rgb(0.5,0.5,0.5) });
      p.drawText(title, { x: margin, y: pageH - margin - 8, size: 16, font: fontBold });
      p.drawLine({ start:{x: margin,y: pageH - margin - 18}, end:{x: pageW - margin, y: pageH - margin - 18}, thickness: 0.5, color: rgb(0.8,0.8,0.8)});
    }

    function sanitize(s: string): string {
      if (!s) return "";
      return s
        .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
        .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
        .replace(/[\u2013\u2014\u2212]/g, "-")
        .replace(/\u2026/g, "...")
        .replace(/\u00A0/g, " ")
        .replace(/[\u2022\u25A0\u25CF\u25AA\u25AB\u25E6]/g, "*")
        .replace(/\u2192/g, "->")
        .replace(/[\u2190\u2191\u2193]/g, "-")
        // Strip any remaining non-WinAnsi / non-printable chars
        .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
    }

    function wrapText(text: string, size: number, f = font): string[] {
      const lines: string[] = [];
      for (const para of sanitize(text).split(/\n/)) {
        const words = para.split(/\s+/);
        let line = "";
        for (const w of words) {
          const test = line ? line + " " + w : w;
          if (f.widthOfTextAtSize(test, size) > wrapWidth) {
            if (line) lines.push(line);
            line = w;
          } else line = test;
        }
        lines.push(line);
      }
      return lines;
    }

    function safeDraw(p: any, text: string, opts: any) {
      p.drawText(sanitize(text), opts);
    }

    async function drawConsent(formTitle: string, body: string, sig: any) {
      let { p, y } = newPage();
      drawHeader(p, formTitle);
      y -= 38;

      const lines = wrapText(body, 9);
      for (const line of lines) {
        if (y < margin + 100) { ({ p, y } = newPage()); drawHeader(p, formTitle + " (cont.)"); y -= 38; }
        p.drawText(line, { x: margin, y, size: 9, font, color: rgb(0.15,0.15,0.15) });
        y -= 12;
      }

      // Signature block
      if (y < margin + 140) { ({ p, y } = newPage()); drawHeader(p, formTitle + " — Signature"); y -= 38; }
      y -= 12;
      p.drawLine({ start:{x: margin, y}, end:{x: pageW - margin, y}, thickness: 0.5, color: rgb(0.8,0.8,0.8) });
      y -= 18;

      const decision = sig.decision === "decline" ? "DO NOT CONSENT" : "CONSENT";
      p.drawText(`Decision: ${decision}`, { x: margin, y, size: 10, font: fontBold });
      y -= 14;
      p.drawText(`Signed by: ${sig.signed_full_name}`, { x: margin, y, size: 10, font });
      y -= 14;
      p.drawText(`Signed at: ${new Date(sig.signed_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} PT`, { x: margin, y, size: 10, font });
      y -= 14;
      p.drawText(`Form version: ${sig.form_version}`, { x: margin, y, size: 9, font, color: rgb(0.5,0.5,0.5) });
      y -= 24;

      if (sig.signature_png && sig.signature_png.startsWith("data:image/png")) {
        try {
          const b64 = sig.signature_png.split(",")[1];
          const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const img = await pdf.embedPng(bytes);
          const w = 220, h = 70;
          p.drawText("Signature:", { x: margin, y, size: 9, font, color: rgb(0.4,0.4,0.4) });
          y -= 10;
          p.drawImage(img, { x: margin, y: y - h, width: w, height: h });
          y -= h + 6;
          p.drawLine({ start:{x: margin, y}, end:{x: margin + w, y}, thickness: 0.5, color: rgb(0.6,0.6,0.6) });
        } catch (_) { /* skip bad image */ }
      }
    }

    // Cover page
    const cover = newPage();
    drawHeader(cover.p, "Signed Consent Receipt");
    let cy = cover.y - 60;
    const coverLines = [
      `Patient: ${appt.client_first_name} ${appt.client_last_name}`,
      `Email: ${appt.client_email}`,
      `Service: ${svc?.name ?? "—"}`,
      `Provider: ${staff?.full_name ?? "—"}`,
      `Location: ${loc?.name ?? "—"}`,
      loc ? `${loc.address}, ${loc.city}, ${loc.state} ${loc.zip}` : "",
      `Appointment: ${new Date(appt.start_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} PT`,
      `Generated: ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} PT`,
    ].filter(Boolean);
    for (const line of coverLines) {
      cover.p.drawText(line, { x: margin, y: cy, size: 11, font });
      cy -= 18;
    }
    cy -= 12;
    cover.p.drawText(`Documents signed (${(sigs ?? []).length}):`, { x: margin, y: cy, size: 11, font: fontBold });
    cy -= 16;
    for (const s of (sigs ?? []) as any[]) {
      const dec = s.decision === "decline" ? " — DECLINED" : "";
      cover.p.drawText(`• ${s.consent_forms.title} (v${s.form_version})${dec}`, { x: margin + 6, y: cy, size: 10, font });
      cy -= 14;
    }

    for (const s of (sigs ?? []) as any[]) {
      await drawConsent(s.consent_forms.title, s.consent_forms.body_markdown, s);
    }

    const bytes = await pdf.save();

    // SHA-256 tamper-evidence hash of the PDF bytes (Cal. Evid. §1552 foundation)
    const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0")).join("");

    const path = `${appointmentId}/consents-${Date.now()}.pdf`;
    const { error: upErr } = await supa.storage.from("consent-pdfs").upload(path, bytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (upErr) return json({ error: `Upload failed: ${upErr.message}` }, 500);

    // Bucket is private; issue a long-lived signed URL (1 year).
    const { data: signed, error: signErr } = await supa.storage
      .from("consent-pdfs").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signErr || !signed?.signedUrl) return json({ error: `Sign failed: ${signErr?.message ?? "unknown"}` }, 500);
    const url = signed.signedUrl;

    await supa.from("appointments").update({ consent_pdf_url: url }).eq("id", appointmentId);

    // Write tamper-evidence audit row (separate table; original rows are never overwritten)
    await supa.from("consent_pdf_audit").insert({
      appointment_id: appointmentId,
      pdf_path: path,
      sha256,
      trigger_source: isServiceRole ? "system" : "staff_regenerate",
      signed_url: url,
    });

    return json({ url, sha256 });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
