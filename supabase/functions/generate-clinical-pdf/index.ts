// Generates PDFs for clinical documentation (GFE or chart note).
// Body: { kind: "gfe" | "note", id: string }
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
    const { data: isStaff } = await svc.rpc("is_clinical_staff", { _user_id: user.id });
    if (!isStaff) return json({ error: "Forbidden" }, 403);

    const { kind, id } = await req.json();
    if (!kind || !id) return json({ error: "kind and id required" }, 400);

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
      const orig = p.drawText.bind(p);
      (p as any).drawText = (text: string, opts: any) => orig(sanitize(text ?? ""), opts);
      return { p, y: pageH - margin };
    }
    function header(p: any, title: string) {
      p.drawText("Radiantilyk Aesthetic", { x: margin, y: pageH - margin + 12, size: 9, font: fontBold, color: rgb(0.5,0.5,0.5) });
      p.drawText(title, { x: margin, y: pageH - margin - 8, size: 16, font: fontBold });
      p.drawLine({ start:{x: margin,y: pageH - margin - 18}, end:{x: pageW - margin, y: pageH - margin - 18}, thickness: 0.5, color: rgb(0.8,0.8,0.8)});
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
    function ensure(space: number, title: string) {
      if (ctx.y < margin + space) { ctx = newPage(); header(ctx.p, title); ctx.y -= 38; }
    }
    function row(label: string, value: string) {
      ensure(30, "Continued");
      ctx.p.drawText(label, { x: margin, y: ctx.y, size: 9, font: fontBold, color: rgb(0.4,0.4,0.4) });
      ctx.y -= 12;
      for (const ln of wrap(value || "—", 10)) {
        ensure(16, "Continued");
        ctx.p.drawText(ln, { x: margin, y: ctx.y, size: 10, font });
        ctx.y -= 13;
      }
      ctx.y -= 4;
    }
    function sectionTitle(title: string) {
      ensure(40, "Continued"); ctx.y -= 6;
      ctx.p.drawText(title.toUpperCase(), { x: margin, y: ctx.y, size: 10, font: fontBold, color: rgb(0.2,0.2,0.2) });
      ctx.y -= 4;
      ctx.p.drawLine({ start:{x: margin, y: ctx.y}, end:{x: pageW - margin, y: ctx.y}, thickness: 0.4, color: rgb(0.8,0.8,0.8) });
      ctx.y -= 12;
    }
    async function drawSig(label: string, name: string, sig: string | null, when: string) {
      ensure(120, "Continued");
      sectionTitle(label);
      row("Signed by", name);
      row("Signed at", new Date(when).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) + " PT");
      if (sig && sig.startsWith("data:image/png")) {
        try {
          const b64 = sig.split(",")[1];
          const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const img = await pdf.embedPng(bytes);
          const w = 200, h = 60; ensure(h + 10, "Continued");
          ctx.p.drawImage(img, { x: margin, y: ctx.y - h, width: w, height: h });
          ctx.y -= h + 6;
        } catch {/**/}
      }
    }

    async function appendClinicalPhotos(label: string, paths: string[] | null | undefined, fallbackUrl?: string | null) {
      const fetchImage = async (url: string) => {
        try {
          const r = await fetch(url);
          if (!r.ok) return null;
          const mime = r.headers.get("content-type") ?? "image/jpeg";
          return { bytes: new Uint8Array(await r.arrayBuffer()), mime };
        } catch { return null; }
      };

      const entries: { bytes: Uint8Array; mime: string }[] = [];
      for (const p of paths ?? []) {
        const signed = await svc.storage.from("clinical-photos").createSignedUrl(p, 60 * 60);
        if (!signed.data?.signedUrl) continue;
        const got = await fetchImage(signed.data.signedUrl);
        if (got) entries.push(got);
      }
      if (!entries.length && fallbackUrl) {
        const got = await fetchImage(fallbackUrl);
        if (got) entries.push(got);
      }

      for (let i = 0; i < entries.length; i++) {
        try {
          const e = entries[i];
          const img = e.mime.includes("png") ? await pdf.embedPng(e.bytes) : await pdf.embedJpg(e.bytes);
          ctx = newPage();
          header(ctx.p, `${label} Photo ${i + 1}`);
          const maxW = pageW - margin * 2;
          const maxH = pageH - margin * 2 - 50;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.p.drawImage(img, { x: (pageW - w) / 2, y: (pageH - h) / 2 - 10, width: w, height: h });
          ctx.y = margin;
        } catch (err) { console.error("Clinical photo embed failed", err); }
      }
    }

    let storagePath = "";
    if (kind === "gfe") {
      const { data: g, error } = await svc.from("gfe_records").select("*").eq("id", id).maybeSingle();
      if (error || !g) return json({ error: "GFE not found" }, 404);
      header(ctx.p, "California Good Faith Exam"); ctx.y -= 38;
      row("Patient", `${g.client_first_name} ${g.client_last_name}`);
      row("Email", g.client_email);
      if (g.client_dob) row("DOB", g.client_dob);
      row("Performed by (NP)", `${g.np_name}${g.np_license ? " • Lic. " + g.np_license : ""}`);
      row("Signed", new Date(g.signed_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) + " PT");
      row("Valid until", new Date(g.expires_at).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" }));
      sectionTitle("Chief concerns"); row("Selected", (g.chief_concerns ?? []).join(", "));
      if (g.chief_concerns_notes) row("Notes", g.chief_concerns_notes);
      sectionTitle("Treatment goals"); row("Selected", (g.treatment_goals ?? []).join(", "));
      sectionTitle("Medical history"); row("Selected", (g.medical_history ?? []).join(", "));
      if (g.medical_history_other) row("Other", g.medical_history_other);
      sectionTitle("Current medications"); row("Selected", (g.current_medications ?? []).join(", "));
      if (g.current_medications_other) row("Other", g.current_medications_other);
      sectionTitle("Allergies"); row("Selected", (g.allergies ?? []).join(", "));
      if (g.allergies_other) row("Other", g.allergies_other);
      sectionTitle("Prior aesthetic treatments"); row("Selected", (g.prior_treatments ?? []).join(", "));
      if (g.prior_treatments_last_date) row("Last", g.prior_treatments_last_date);
      sectionTitle("Skin assessment");
      if (g.fitzpatrick) row("Fitzpatrick", g.fitzpatrick);
      row("Findings", (g.skin_assessment ?? []).join(", "));
      sectionTitle("Vitals");
      row("BP", g.bp_systolic ? `${g.bp_systolic}/${g.bp_diastolic ?? "—"}` : "—");
      row("HR", g.heart_rate ? `${g.heart_rate}` : "—");
      row("Height / Weight", `${g.height_in ?? "—"} in / ${g.weight_lb ?? "—"} lb`);
      sectionTitle("Pregnancy / lactation"); row("Status", g.pregnancy_status ?? "—");
      sectionTitle("Photo consent"); row("Consent", g.photo_consent ? "Granted" : "Declined");
      sectionTitle("NP assessment & plan"); row("", g.np_assessment_plan);
      await drawSig("NP Attestation & Signature", g.np_name, g.signature_png, g.signed_at);

      const { data: gAudit } = await svc.from("clinical_audit_log")
        .select("action, actor_name, created_at, ip_address")
        .eq("resource_type", "gfe").eq("resource_id", id)
        .order("created_at", { ascending: true });
      if (gAudit && gAudit.length) {
        sectionTitle("Audit trail");
        for (const e of gAudit) {
          const when = new Date((e as any).created_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) + " PT";
          const ip = (e as any).ip_address ? ` · ${(e as any).ip_address}` : "";
          row(String((e as any).action).toUpperCase(), `${when} — ${(e as any).actor_name ?? "system"}${ip}`);
        }
      }

      storagePath = `gfe/${id}-${Date.now()}.pdf`;
    } else if (kind === "note") {
      const { data: n, error } = await svc.from("clinical_notes").select("*").eq("id", id).maybeSingle();
      if (error || !n) return json({ error: "Note not found" }, 404);
      const tableMap: Record<string, string> = {
        neurotoxin: "clinical_note_neurotoxin", filler: "clinical_note_filler",
        energy: "clinical_note_energy", wellness: "clinical_note_wellness",
      };
      const [{ data: d }, { data: sigs }, { data: addends }] = await Promise.all([
        svc.from(tableMap[n.category]).select("*").eq("clinical_note_id", id).maybeSingle(),
        svc.from("clinical_note_signatures").select("*").eq("clinical_note_id", id).order("signed_at"),
        svc.from("clinical_note_addendums").select("*").eq("clinical_note_id", id).order("created_at"),
      ]);
      header(ctx.p, "Procedure Chart Note"); ctx.y -= 38;
      row("Patient", `${n.client_first_name} ${n.client_last_name}`);
      row("Email", n.client_email);
      if (n.client_dob) row("DOB", n.client_dob);
      row("Service", n.service_name ?? "—");
      // Also pull every service tied to the linked appointment so the chart
      // reflects the FULL visit, not just the primary service on the note.
      if (n.appointment_id) {
        const { data: apptSvcs } = await svc
          .from("appointment_services")
          .select("duration_minutes, services:service_id ( name )")
          .eq("appointment_id", n.appointment_id)
          .order("display_order", { ascending: true });
        if (apptSvcs && apptSvcs.length) {
          row(
            "All services on visit",
            apptSvcs.map((s: any) => {
              const nm = s.services?.name ?? "service";
              return s.duration_minutes ? `${nm} (${s.duration_minutes} min)` : nm;
            }).join("; "),
          );
        }
      }
      row("Category", String(n.category).toUpperCase());
      row("Provider", `${n.provider_name} (${n.provider_role ?? "—"})`);
      row("Status", String(n.status).toUpperCase());
      row("Created", new Date(n.created_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) + " PT");
      row("GFE on file", n.gfe_record_id ? "Yes" : "No");
      row("Consents verified", n.consents_verified ? "Yes" : "No");

      sectionTitle("Pre-procedure reconciliation & safety");
      row("Indication", n.indication ?? "—");
      row("Allergies re-confirmed today", (n.allergies_confirmed_today ?? []).join(", ") || "NKDA / none on file");
      row("New meds since GFE", n.new_medications_since_gfe ?? "None reported");
      row("BP", n.bp_systolic ? `${n.bp_systolic}/${n.bp_diastolic ?? "—"}` : "—");
      row("HR", n.heart_rate ? String(n.heart_rate) : "—");
      row("Pain pre / post", `${n.pain_score_pre ?? "—"} / ${n.pain_score_post ?? "—"}`);
      row("Time-out completed", n.time_out_completed ? "Yes" : "No");
      row("Site marked", n.site_marked ? "Yes" : "N/A");
      row("Emergency equipment available", n.emergency_equipment_available ? "Yes" : "No");
      row("Patient verbalized understanding", n.patient_verbalized_understanding ? "Yes" : "No");
      row("Pre-procedure photos", `${(n.photo_pre_paths ?? []).length} on file`);
      row("Post-procedure photos", `${(n.photo_post_paths ?? []).length} on file`);
      await appendClinicalPhotos("Pre-procedure", n.photo_pre_paths, n.photo_pre_url);
      await appendClinicalPhotos("Post-procedure", n.photo_post_paths, n.photo_post_url);

      sectionTitle("Treatment details");
      const collectedPoints: any[] = [];
      const collectedZones: any[] = [];
      if (d) {
        for (const [k, v] of Object.entries(d).filter(([kk]) => kk !== "clinical_note_id")) {
          if (k === "injection_map") {
            // Handle injection_map specially — render structured zones + points.
            const im: any = v;
            let zones: any[] = [];
            let points: any[] = [];
            if (Array.isArray(im)) zones = im;
            else if (im && typeof im === "object") {
              zones = Array.isArray(im.zones) ? im.zones : [];
              points = Array.isArray(im.points) ? im.points : [];
            }
            if (zones.length) {
              row("Zones (legacy)", zones.map((z: any) =>
                typeof z === "string" ? z :
                `${z.label ?? z.zone ?? "zone"}${z.units != null ? ` — ${z.units}u` : ""}`
              ).join("; "));
              collectedZones.push(...zones);
            }
            if (points.length) {
              row("Marked sites", `${points.length} pin(s) — see Markings section`);
              collectedPoints.push(...points);
            }
            if (!zones.length && !points.length) row("Injection map", "—");
            continue;
          }
          let val: string;
          if (Array.isArray(v)) {
            if (v.length && typeof v[0] === "object") {
              val = (v as any[]).map(o =>
                Object.entries(o).filter(([, vv]) => vv != null && vv !== "")
                  .map(([kk, vv]) => `${kk}: ${vv}`).join(", ")
              ).join(" | ");
            } else {
              val = (v as any[]).join(", ");
            }
          }
          else if (v && typeof v === "object") {
            val = Object.entries(v as any).filter(([, vv]) => vv != null && vv !== "")
              .map(([kk, vv]) => `${kk}: ${vv}`).join(", ");
          }
          else val = String(v ?? "—");
          row(k.replace(/_/g, " "), val);
        }
      }

      // ===== MARKINGS — render face/body silhouettes with marked points =====
      if (collectedPoints.length) {
        const faceP = collectedPoints.filter((p: any) => p.view !== "body");
        const bodyP = collectedPoints.filter((p: any) => p.view === "body");
        function drawDiagram(title: string, pts: any[], kind: "face" | "body") {
          if (!pts.length) return;
          ctx = newPage();
          header(ctx.p, title);
          ctx.y -= 38;
          const boxX = margin, boxY = margin + 260, boxW = pageW - margin * 2, boxH = 360;
          // viewBox 0..100 -> map to box
          const sx = (x: number) => boxX + (x / 100) * boxW;
          const sy = (y: number) => boxY + boxH - (y / 100) * boxH;
          const stroke = rgb(0.55, 0.55, 0.6);
          if (kind === "face") {
            ctx.p.drawEllipse({ x: sx(50), y: sy(55), xScale: (28/100)*boxW, yScale: (38/100)*boxH, borderColor: stroke, borderWidth: 0.8 });
            ctx.p.drawEllipse({ x: sx(38), y: sy(55), xScale: (4/100)*boxW, yScale: (2/100)*boxH, borderColor: stroke, borderWidth: 0.8 });
            ctx.p.drawEllipse({ x: sx(62), y: sy(55), xScale: (4/100)*boxW, yScale: (2/100)*boxH, borderColor: stroke, borderWidth: 0.8 });
          } else {
            ctx.p.drawEllipse({ x: sx(50), y: sy(10), xScale: (6/100)*boxW, yScale: (6/100)*boxH, borderColor: stroke, borderWidth: 0.8 });
            // torso outline as a rectangle approximation
            ctx.p.drawRectangle({ x: sx(26), y: sy(78), width: (48/100)*boxW, height: (56/100)*boxH, borderColor: stroke, borderWidth: 0.8 });
          }
          // Draw pins
          pts.forEach((p: any, i: number) => {
            const cx = sx(Number(p.x) || 0), cy = sy(Number(p.y) || 0);
            ctx.p.drawCircle({ x: cx, y: cy, size: 3.5, color: rgb(0.85, 0.15, 0.25) });
            ctx.p.drawText(String(i + 1), { x: cx + 4, y: cy + 2, size: 7, font: fontBold, color: rgb(0.1,0.1,0.1) });
          });
          // Legend below the diagram
          ctx.y = boxY - 10;
          sectionTitle(`${title} — pin details`);
          pts.forEach((p: any, i: number) => {
            const parts: string[] = [];
            if (p.label) parts.push(String(p.label));
            if (p.units != null) parts.push(`${p.units}${typeof p.units === "number" ? "" : ""}`);
            if (p.product) parts.push(`product: ${p.product}`);
            if (p.lot) parts.push(`lot: ${p.lot}`);
            if (p.expiration) parts.push(`exp: ${p.expiration}`);
            parts.push(`(${Math.round(Number(p.x)||0)}, ${Math.round(Number(p.y)||0)})`);
            row(`#${i + 1}`, parts.join(" • "));
          });
        }
        drawDiagram("Markings — Face", faceP, "face");
        drawDiagram("Markings — Body", bodyP, "body");
      }

      sectionTitle("Post-procedure");
      row("Assessment", (n.post_assessment ?? []).join(", "));
      row("Post-op reviewed", n.post_op_reviewed ? "Yes" : "No");
      row("Follow-up (weeks)", n.followup_weeks ? String(n.followup_weeks) : "—");
      if (n.provider_notes) row("Provider notes", n.provider_notes);

      for (const s of sigs ?? []) {
        await drawSig(`${(s as any).signer_role === "cosigner" ? "Co-signer" : "Provider"} signature`, (s as any).signer_name, (s as any).signature_png, (s as any).signed_at);
      }

      for (const a of addends ?? []) {
        sectionTitle("Addendum");
        row("Author", (a as any).author_name);
        row("When", new Date((a as any).created_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) + " PT");
        row("Reason", (a as any).reason);
        row("Note", (a as any).body);
        if ((a as any).signature_png && String((a as any).signature_png).startsWith("data:image/png")) {
          try {
            const b64 = String((a as any).signature_png).split(",")[1];
            const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            const img = await pdf.embedPng(bytes);
            const w = 180, h = 50; ensure(h + 10, "Continued");
            ctx.p.drawImage(img, { x: margin, y: ctx.y - h, width: w, height: h });
            ctx.y -= h + 6;
          } catch {/**/}
        }
      }

      const { data: audit } = await svc.from("clinical_audit_log")
        .select("action, actor_name, created_at, ip_address")
        .eq("resource_type", "clinical_note").eq("resource_id", id)
        .order("created_at", { ascending: true });
      if (audit && audit.length) {
        sectionTitle("Audit trail");
        for (const e of audit) {
          const when = new Date((e as any).created_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) + " PT";
          const ip = (e as any).ip_address ? ` · ${(e as any).ip_address}` : "";
          row(String((e as any).action).toUpperCase(), `${when} — ${(e as any).actor_name ?? "system"}${ip}`);
        }
      }

      storagePath = `note/${id}-${Date.now()}.pdf`;
    } else {
      return json({ error: "Unknown kind" }, 400);
    }

    const bytes = await pdf.save();
    const { error: upErr } = await svc.storage.from("clinical-notes").upload(storagePath, bytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (upErr) return json({ error: upErr.message }, 500);
    const { data: signed, error: signErr } = await svc.storage.from("clinical-notes")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 30);
    if (signErr || !signed?.signedUrl) return json({ error: signErr?.message ?? "sign failed" }, 500);

    if (kind === "gfe") await svc.from("gfe_records").update({ pdf_url: signed.signedUrl }).eq("id", id);
    else await svc.from("clinical_notes").update({ pdf_url: signed.signedUrl }).eq("id", id);

    await svc.from("clinical_audit_log").insert({
      actor_user_id: user.id, actor_name: user.email,
      resource_type: kind === "gfe" ? "gfe" : "clinical_note",
      resource_id: id, action: "download",
    });

    return json({ url: signed.signedUrl });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
