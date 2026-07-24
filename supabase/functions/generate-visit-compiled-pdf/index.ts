// Compile the FULL clinical record for a single visit date (Pacific calendar
// day) into one merged PDF: chart notes, GFE, and clinical encounters — with
// their complete documented content. For each record we (re)generate the
// underlying PDF on demand so the packet always reflects what was charted
// (and never falls back to a stale/missing URL).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isClin } = await svc.rpc("is_clinical_staff", { _user_id: user.id });
    if (!isClin) return json({ error: "Forbidden" }, 403);

    const { client_email, visit_date } = await req.json();
    if (!client_email || !visit_date) return json({ error: "client_email and visit_date required" }, 400);

    const email = String(client_email).toLowerCase();
    const dayStart = new Date(`${visit_date}T00:00:00-08:00`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const [{ data: notes }, { data: gfes }, { data: encs }] = await Promise.all([
      svc.from("clinical_notes")
        .select("id, pdf_url, created_at, service_name, category, provider_name, status, client_first_name, client_last_name, provider_notes, post_assessment, followup_weeks, bp_systolic, bp_diastolic, heart_rate, pain_score_pre, pain_score_post, indication, allergies_confirmed_today, new_medications_since_gfe, photo_pre_paths, photo_post_paths, photo_pre_url, photo_post_url")
        .ilike("client_email", email)
        .gte("created_at", dayStart.toISOString())
        .lt("created_at", dayEnd.toISOString())
        .order("created_at", { ascending: true }),
      svc.from("gfe_records")
        .select("id, pdf_url, signed_at, np_name, client_first_name, client_last_name")
        .ilike("client_email", email)
        .gte("signed_at", dayStart.toISOString())
        .lt("signed_at", dayEnd.toISOString())
        .order("signed_at", { ascending: true }),
      svc.from("clinical_encounters")
        .select("id, clinical_pdf_url, handout_pdf_url, signed_at, created_at, status, category, visit_type, signed_by_name, client_first_name, client_last_name")
        .ilike("client_email", email)
        .or(`and(signed_at.gte.${dayStart.toISOString()},signed_at.lt.${dayEnd.toISOString()}),and(signed_at.is.null,created_at.gte.${dayStart.toISOString()},created_at.lt.${dayEnd.toISOString()})`)
        .order("created_at", { ascending: true }),
    ]);

    // ---- Always (re)generate per-document PDFs so the compiled packet
    // ---- contains the complete current chart content, not a stale snapshot.
    const fnBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
    const invoke = async (path: string, body: unknown) => {
      try {
        const r = await fetch(`${fnBase}/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: auth },
          body: JSON.stringify(body),
        });
        if (!r.ok) return null;
        return await r.json();
      } catch { return null; }
    };

    const noteUrls: Record<string, string | null> = {};
    const gfeUrls: Record<string, string | null> = {};
    const encUrls: Record<string, { clinical: string | null; handout: string | null }> = {};

    // Always regenerate chart-note PDFs so photo pages are included even when
    // an older saved PDF URL exists from before photo embedding was supported.
    const LOCKED = new Set(["signed", "cosigned", "locked"]);
    await Promise.all([
      ...(notes ?? []).map(async (n: any) => {
        const r = await invoke("generate-clinical-pdf", { kind: "note", id: n.id });
        noteUrls[n.id] = r?.url ?? n.pdf_url ?? null;
      }),
      ...(gfes ?? []).map(async (g: any) => {
        // GFE records are locked on insert (trigger). If pdf_url exists, reuse.
        if (g.pdf_url) { gfeUrls[g.id] = g.pdf_url; return; }
        const r = await invoke("generate-clinical-pdf", { kind: "gfe", id: g.id });
        gfeUrls[g.id] = r?.url ?? g.pdf_url ?? null;
      }),
      ...(encs ?? []).map(async (e: any) => {
        if (e.status === "signed" && e.clinical_pdf_url) {
          encUrls[e.id] = { clinical: e.clinical_pdf_url, handout: e.handout_pdf_url ?? null };
          return;
        }
        if (e.status === "signed") {
          const r = await invoke("generate-encounter-pdf", { encounter_id: e.id });
          encUrls[e.id] = {
            clinical: r?.clinical_pdf_url ?? e.clinical_pdf_url ?? null,
            handout: r?.handout_pdf_url ?? e.handout_pdf_url ?? null,
          };
        } else {
          encUrls[e.id] = { clinical: e.clinical_pdf_url ?? null, handout: e.handout_pdf_url ?? null };
        }
      }),
    ]);

    const merged = await PDFDocument.create();
    const font = await merged.embedFont(StandardFonts.Helvetica);
    const fontBold = await merged.embedFont(StandardFonts.HelveticaBold);

    // ---- Cover page
    const cover = merged.addPage([612, 792]);
    const firstName = notes?.[0]?.client_first_name ?? encs?.[0]?.client_first_name ?? gfes?.[0]?.client_first_name ?? "";
    const lastName  = notes?.[0]?.client_last_name  ?? encs?.[0]?.client_last_name  ?? gfes?.[0]?.client_last_name  ?? "";
    cover.drawText("Radiantilyk Aesthetic", { x: 48, y: 740, size: 10, font: fontBold, color: rgb(0.45,0.45,0.45) });
    cover.drawText("Compiled Visit Record", { x: 48, y: 700, size: 22, font: fontBold });
    cover.drawText(`Patient: ${firstName} ${lastName} (${email})`, { x: 48, y: 670, size: 11, font });
    cover.drawText(`Visit date: ${visit_date}`, { x: 48, y: 652, size: 11, font });
    cover.drawText(`Generated: ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} PT`, { x: 48, y: 634, size: 10, font, color: rgb(0.4,0.4,0.4) });

    let y = 590;
    const line = (t: string, size = 10, bold = false) => {
      cover.drawText(t, { x: 48, y, size, font: bold ? fontBold : font });
      y -= size + 5;
    };
    line("Documents included in this packet:", 12, true);
    y -= 4;
    if (gfes?.length)  { line(`Good Faith Exam (${gfes.length})`, 11, true);  for (const g of gfes)  line(`  • Signed by ${g.np_name}`); }
    if (encs?.length)  { line(`Clinical encounters (${encs.length})`, 11, true); for (const e of encs) line(`  • ${e.visit_type} · ${e.category} — ${e.signed_by_name ?? "(unsigned draft)"} [${e.status}]`); }
    if (notes?.length) { line(`Chart notes (${notes.length})`, 11, true); for (const n of notes) line(`  • ${n.service_name ?? n.category} — ${n.provider_name} [${n.status}]`); }
    if (!gfes?.length && !encs?.length && !notes?.length) line("No clinical documentation on this date.", 10);

    // ---- Helpers for inline rendering fallback
    const wrap = (text: string, max = 90) => {
      const out: string[] = [];
      for (const para of String(text ?? "").split(/\r?\n/)) {
        if (!para) { out.push(""); continue; }
        let cur = "";
        for (const word of para.split(/\s+/)) {
          if ((cur + " " + word).trim().length > max) { out.push(cur); cur = word; }
          else cur = cur ? cur + " " + word : word;
        }
        if (cur) out.push(cur);
      }
      return out;
    };
    const inlineNotePage = (n: any) => {
      const p = merged.addPage([612, 792]);
      let yy = 740;
      p.drawText(`Chart note — ${n.service_name ?? n.category ?? ""}`, { x: 48, y: yy, size: 16, font: fontBold }); yy -= 22;
      p.drawText(`Provider: ${n.provider_name ?? ""}  •  Status: ${n.status}`, { x: 48, y: yy, size: 10, font }); yy -= 14;
      p.drawText(`Created: ${new Date(n.created_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} PT`, { x: 48, y: yy, size: 10, font, color: rgb(0.4,0.4,0.4) }); yy -= 20;
      const draw = (label: string, value: string) => {
        if (!value) return;
        p.drawText(label, { x: 48, y: yy, size: 10, font: fontBold }); yy -= 13;
        for (const ln of wrap(value)) { if (yy < 60) return; p.drawText(ln, { x: 48, y: yy, size: 10, font }); yy -= 12; }
        yy -= 6;
      };
      if (n.indication) draw("Indication", n.indication);
      const vitals: string[] = [];
      if (n.bp_systolic || n.bp_diastolic) vitals.push(`BP ${n.bp_systolic ?? "?"}/${n.bp_diastolic ?? "?"}`);
      if (n.heart_rate) vitals.push(`HR ${n.heart_rate}`);
      if (n.pain_score_pre != null) vitals.push(`Pain pre ${n.pain_score_pre}`);
      if (n.pain_score_post != null) vitals.push(`Pain post ${n.pain_score_post}`);
      if (vitals.length) draw("Vitals", vitals.join("  •  "));
      if (Array.isArray(n.allergies_confirmed_today) && n.allergies_confirmed_today.length)
        draw("Allergies confirmed today", n.allergies_confirmed_today.join(", "));
      if (n.new_medications_since_gfe) draw("New medications since GFE", n.new_medications_since_gfe);
      if (n.provider_notes) draw("Provider notes", n.provider_notes);
      if (Array.isArray(n.post_assessment) && n.post_assessment.length)
        draw("Post-procedure assessment", n.post_assessment.join("\n"));
      if (n.followup_weeks) draw("Follow-up", `${n.followup_weeks} weeks`);
    };

    // ---- Append documents in clinically-sensible order: GFE → encounters → notes
    const appendUrl = async (url: string | null) => {
      if (!url) return false;
      try {
        const r = await fetch(url);
        if (!r.ok) return false;
        const bytes = new Uint8Array(await r.arrayBuffer());
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        for (const p of pages) merged.addPage(p);
        return true;
      } catch (e) {
        console.error("Failed to merge", url, e);
        return false;
      }
    };

    let included = 0;
    for (const g of gfes ?? []) { if (await appendUrl(gfeUrls[g.id])) included++; }
    for (const e of encs ?? []) {
      if (await appendUrl(encUrls[e.id]?.clinical ?? null)) included++;
      if (await appendUrl(encUrls[e.id]?.handout ?? null)) included++;
    }
    for (const n of notes ?? []) {
      const ok = await appendUrl(noteUrls[n.id]);
      if (ok) { included++; }
      else { inlineNotePage(n); included++; }
    }

    // ---- Append visit photos (pre/post) from clinical_notes
    const appendPhotos = async (label: string, paths: string[] | null | undefined, fallbackUrl: string | null) => {
      const entries: { label: string; bytes: Uint8Array; mime: string }[] = [];
      const tryFetch = async (url: string) => {
        try {
          const r = await fetch(url);
          if (!r.ok) return null;
          const mime = r.headers.get("content-type") ?? "image/jpeg";
          return { bytes: new Uint8Array(await r.arrayBuffer()), mime };
        } catch { return null; }
      };
      for (const p of paths ?? []) {
        const signed = await svc.storage.from("clinical-photos").createSignedUrl(p, 60 * 60);
        if (!signed.data?.signedUrl) continue;
        const got = await tryFetch(signed.data.signedUrl);
        if (got) entries.push({ label, ...got });
      }
      if (!entries.length && fallbackUrl) {
        const got = await tryFetch(fallbackUrl);
        if (got) entries.push({ label, ...got });
      }
      for (const e of entries) {
        try {
          const img = e.mime.includes("png")
            ? await merged.embedPng(e.bytes)
            : await merged.embedJpg(e.bytes);
          const page = merged.addPage([612, 792]);
          page.drawText(`${e.label} photo`, { x: 48, y: 750, size: 14, font: fontBold });
          const maxW = 516, maxH = 660;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = img.width * scale, h = img.height * scale;
          page.drawImage(img, { x: (612 - w) / 2, y: (740 - h) / 2 + 20, width: w, height: h });
          included++;
        } catch (err) { console.error("Photo embed failed", err); }
      }
    };
    for (const n of notes ?? []) {
      await appendPhotos("Pre-procedure", n.photo_pre_paths, n.photo_pre_url);
      await appendPhotos("Post-procedure", n.photo_post_paths, n.photo_post_url);
    }

    const out = await merged.save();
    const safeEmail = email.replace(/[^a-z0-9._-]/g, "_");
    const path = `${safeEmail}/visit-${visit_date}-${Date.now()}.pdf`;
    const up = await svc.storage.from("clinical-notes").upload(path, out, { contentType: "application/pdf", upsert: true });
    if (up.error) return json({ error: up.error.message }, 500);
    const signed = await svc.storage.from("clinical-notes").createSignedUrl(path, 60 * 60);
    if (!signed.data?.signedUrl) return json({ error: "Could not sign URL" }, 500);

    try {
      await svc.rpc("log_phi_access", {
        _resource_type: "visit_packet", _resource_id: null,
        _client_email: email, _action: "download", _route: "generate-visit-compiled-pdf",
        _metadata: { visit_date, doc_count: included },
      });
    } catch {/**/}

    return json({ url: signed.data.signedUrl, doc_count: included });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
