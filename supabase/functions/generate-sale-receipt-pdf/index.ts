// Generates a PDF receipt for a paid sale, uploads to storage,
// stores a signed URL in sales.receipt_url, and returns the URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const LOGO_URL = "https://bookrka.com/receipt-logo.png";
async function fetchLogoBytes(): Promise<Uint8Array | null> {
  try {
    const r = await fetch(LOGO_URL);
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch { return null; }
}

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

function sanitize(s: string): string {
  if (!s) return "";
  return s
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2022\u25A0\u25CF\u25AA\u25AB\u25E6]/g, "*")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

function fmt(c: number | null | undefined): string {
  const v = Math.abs(Number(c ?? 0));
  return `$${(v / 100).toFixed(2)}`;
}

const PAYMENT_LABEL: Record<string, string> = {
  terminal: "Card (Terminal)",
  card_on_file: "Card on file",
  manual_card: "Card",
  cash: "Cash",
  voucher_only: "Gift card / voucher",
  account_credit: "Account credit",
  unit_bank: "Banked units",
  mixed_non_card: "Account credit / banked units",
  affirm: "Affirm",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("authorization");
    const isServiceRole = parseJwtRole(authHeader) === "service_role";
    if (!isServiceRole) {
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

    const { saleId } = await req.json();
    if (!saleId) return json({ error: "saleId required" }, 400);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sale, error: sErr } = await supa
      .from("sales").select("*").eq("id", saleId).maybeSingle();
    if (sErr || !sale) return json({ error: "Sale not found" }, 404);

    const [{ data: items }, { data: loc }, { data: ledger }, { data: pointsSettings }, balanceRes] = await Promise.all([
      supa.from("sale_items").select("label, quantity, line_total_cents")
        .eq("sale_id", saleId).order("display_order"),
      supa.from("locations").select("name, address, city, state, zip")
        .eq("id", sale.location_id).maybeSingle(),
      supa.from("client_points_ledger").select("delta, reason").eq("sale_id", saleId),
      supa.from("client_points_settings").select("point_value_cents").eq("id", true).maybeSingle(),
      sale.client_email
        ? supa.rpc("get_points_balance", { _client_email: sale.client_email })
        : Promise.resolve({ data: null }),
    ]);
    const pointsEarned = (ledger ?? []).filter((r: any) => r.reason === "earned").reduce((s: number, r: any) => s + (r.delta ?? 0), 0);
    const pointsRedeemed = -(ledger ?? []).filter((r: any) => r.reason === "redeemed").reduce((s: number, r: any) => s + (r.delta ?? 0), 0);
    const pointValueCents = pointsSettings?.point_value_cents ?? 10;
    const pointsBalance = (balanceRes?.data as number | null) ?? null;

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);

    const margin = 48;
    const pageW = 612, pageH = 792;
    const wrapW = pageW - margin * 2;

    let page = pdf.addPage([pageW, pageH]);
    let y = pageH - margin;

    const draw = (t: string, opts: any) => page.drawText(sanitize(t), opts);

    // Header — logo + brand
    const logoBytes = await fetchLogoBytes();
    if (logoBytes) {
      try {
        const img = await pdf.embedPng(logoBytes);
        const lw = 56, lh = 56;
        page.drawImage(img, { x: margin, y: y - lh + 6, width: lw, height: lh });
        draw("Radiantilyk Aesthetic", { x: margin + lw + 12, y: y - 14, size: 13, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
        draw("Receipt", { x: margin + lw + 12, y: y - 32, size: 18, font: fontBold });
        y -= 64;
      } catch {
        draw("Radiantilyk Aesthetic", { x: margin, y, size: 10, font: fontBold, color: rgb(0.45, 0.45, 0.45) });
        y -= 22;
        draw("Receipt", { x: margin, y, size: 22, font: fontBold });
        y -= 30;
      }
    } else {
      draw("Radiantilyk Aesthetic", { x: margin, y, size: 10, font: fontBold, color: rgb(0.45, 0.45, 0.45) });
      y -= 22;
      draw("Receipt", { x: margin, y, size: 22, font: fontBold });
      y -= 30;
    }
    page.drawLine({
      start: { x: margin, y: y - 4 }, end: { x: pageW - margin, y: y - 4 },
      thickness: 0.5, color: rgb(0.8, 0.8, 0.8),
    });
    y -= 22;

    // Meta block
    const clientName = [sale.client_first_name, sale.client_last_name].filter(Boolean).join(" ").trim();
    const paidOn = sale.paid_at
      ? new Date(sale.paid_at).toLocaleString("en-US", {
          timeZone: "America/Los_Angeles",
          month: "long", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit",
        }) + " PT"
      : "—";
    const metaLines = [
      `Receipt #: ${String(saleId).slice(0, 8).toUpperCase()}`,
      `Paid on: ${paidOn}`,
      loc?.name ? `Location: ${loc.name}` : null,
      loc?.address ? `${loc.address}, ${loc.city}, ${loc.state} ${loc.zip}` : null,
      clientName ? `Client: ${clientName}` : null,
      sale.client_email ? `Email: ${sale.client_email}` : null,
      sale.payment_method ? `Payment: ${PAYMENT_LABEL[sale.payment_method] ?? sale.payment_method}` : null,
    ].filter(Boolean) as string[];
    for (const line of metaLines) {
      draw(line, { x: margin, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 14;
    }

    y -= 10;
    page.drawLine({
      start: { x: margin, y }, end: { x: pageW - margin, y },
      thickness: 0.5, color: rgb(0.85, 0.85, 0.85),
    });
    y -= 18;

    // Items header
    draw("Description", { x: margin, y, size: 10, font: fontBold });
    draw("Qty", { x: pageW - margin - 140, y, size: 10, font: fontBold });
    draw("Amount", { x: pageW - margin - 60, y, size: 10, font: fontBold });
    y -= 14;

    const drawRow = (label: string, qty: string, amount: string, bold = false) => {
      const f = bold ? fontBold : font;
      // wrap long labels
      const safeLabel = sanitize(label);
      const maxW = wrapW - 200;
      let chunk = safeLabel;
      while (font.widthOfTextAtSize(chunk, 10) > maxW && chunk.length > 3) {
        chunk = chunk.slice(0, chunk.length - 4) + "...";
        if (chunk.length <= 5) break;
      }
      draw(chunk, { x: margin, y, size: 10, font: f });
      draw(qty, { x: pageW - margin - 140, y, size: 10, font: f });
      draw(amount, { x: pageW - margin - 60, y, size: 10, font: f });
      y -= 14;
      if (y < margin + 80) {
        page = pdf.addPage([pageW, pageH]);
        y = pageH - margin;
      }
    };

    for (const it of (items ?? []) as any[]) {
      const q = Number(it.quantity ?? 1);
      drawRow(it.label ?? "Item", q === 1 ? "1" : String(q), fmt(it.line_total_cents));
    }

    y -= 6;
    page.drawLine({
      start: { x: margin, y }, end: { x: pageW - margin, y },
      thickness: 0.5, color: rgb(0.85, 0.85, 0.85),
    });
    y -= 16;

    if (sale.subtotal_cents) drawRow("Subtotal", "", fmt(sale.subtotal_cents));
    if (sale.discount_cents) drawRow("Discount", "", "-" + fmt(sale.discount_cents));
    if (sale.voucher_applied_cents) drawRow("Gift card / voucher", "", "-" + fmt(sale.voucher_applied_cents));
    if (sale.unit_bank_applied_cents) drawRow("Banked units applied", "", "-" + fmt(sale.unit_bank_applied_cents));
    if (sale.credit_applied_cents) drawRow("Account credit applied", "", "-" + fmt(sale.credit_applied_cents));
    if (sale.tax_cents) drawRow("Tax", "", fmt(sale.tax_cents));
    if (sale.tip_cents) drawRow("Tip", "", fmt(sale.tip_cents));
    if (sale.processing_fee_cents) drawRow("Processing fee", "", fmt(sale.processing_fee_cents));
    if (pointsRedeemed > 0) drawRow(`Points redeemed (${pointsRedeemed} pts)`, "", "-" + fmt(pointsRedeemed * pointValueCents));

    y -= 4;
    page.drawLine({
      start: { x: margin, y }, end: { x: pageW - margin, y },
      thickness: 1, color: rgb(0.2, 0.2, 0.2),
    });
    y -= 18;
    const grandTotal = (sale.total_cents ?? 0);
    drawRow("Total", "", fmt(grandTotal), true);
    const netPaid = Math.max(0, grandTotal
      - (sale.voucher_applied_cents ?? 0)
      - (sale.unit_bank_applied_cents ?? 0)
      - (sale.credit_applied_cents ?? 0));
    drawRow("Amount charged", "", fmt(netPaid), true);

    if (pointsEarned > 0 || pointsRedeemed > 0 || (pointsBalance ?? 0) > 0) {
      y -= 18;
      page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
      y -= 16;
      draw("Rewards", { x: margin, y, size: 11, font: fontBold });
      y -= 14;
      if (pointsEarned > 0) drawRow("Points earned this visit", "", `+${pointsEarned} pts`);
      if (pointsRedeemed > 0) drawRow("Points redeemed", "", `-${pointsRedeemed} pts (${fmt(pointsRedeemed * pointValueCents)})`);
      if (pointsBalance != null) drawRow("New balance", "", `${pointsBalance} pts (${fmt(pointsBalance * pointValueCents)})`, true);
    }

    y -= 28;
    draw("Thank you for choosing Radiantilyk Aesthetic.",
      { x: margin, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 22;

    // Legal / policy block — tightened to prevent misuse of this receipt
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
    y -= 14;
    draw("Payment & Refund Policy", { x: margin, y, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    y -= 14;

    const wrapLines = (txt: string, maxW: number, size = 8.5): string[] => {
      const words = sanitize(txt).split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (font.widthOfTextAtSize(test, size) > maxW) {
          if (cur) lines.push(cur);
          cur = w;
        } else cur = test;
      }
      if (cur) lines.push(cur);
      return lines;
    };

    const legalParagraphs = [
      "ALL SALES FINAL. No refunds are given for services that have been rendered, in whole or in part. Payment confirms the client received and consented to the listed services.",
      "Prepaid services, packages, gift cards, vouchers, and account credits are non-refundable, non-transferable, and have no cash value. Unused balances may be applied toward future services at Radiantilyk Aesthetic only.",
      "Cancellation policy: 48 hours' notice is required to reschedule or cancel. Late cancellations and no-shows are subject to a $200 fee charged to the card on file, per the policy acknowledged at booking.",
      "Results from aesthetic and medical services vary by individual and are not guaranteed. Dissatisfaction with results does not entitle the client to a refund of fees paid for rendered services.",
      "This document is a proof-of-payment receipt only. It is NOT a refund authorization, store credit, gift card, voucher, promise to pay, or transferable instrument, and may not be presented for cash, exchange, or credit at any location.",
      "Any disputed charge must be submitted in writing to kv@rkaglow.com within 7 calendar days of the paid-on date above. Initiating a chargeback without first contacting the clinic constitutes a breach of these terms and may be referred for collection.",
    ];
    for (const p of legalParagraphs) {
      const lines = wrapLines(p, wrapW, 8.5);
      for (const ln of lines) {
        if (y < margin + 40) { page = pdf.addPage([pageW, pageH]); y = pageH - margin; }
        draw(ln, { x: margin, y, size: 8.5, font, color: rgb(0.35, 0.35, 0.35) });
        y -= 11;
      }
      y -= 4;
    }

    y -= 6;
    if (y < margin + 24) { page = pdf.addPage([pageW, pageH]); y = pageH - margin; }
    draw("Questions about this charge? Email kv@rkaglow.com or reply to your receipt email.",
      { x: margin, y, size: 8.5, font: fontItalic, color: rgb(0.45, 0.45, 0.45) });

    const bytes = await pdf.save();
    const emailKey = (sale.client_email ?? "no-email").toLowerCase();
    const path = `${emailKey}/${saleId}-${Date.now()}.pdf`;
    const { error: upErr } = await supa.storage.from("sale-receipts").upload(path, bytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (upErr) return json({ error: `Upload failed: ${upErr.message}` }, 500);

    const { data: signed, error: signErr } = await supa.storage
      .from("sale-receipts").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signErr || !signed?.signedUrl) {
      return json({ error: `Sign failed: ${signErr?.message ?? "unknown"}` }, 500);
    }

    await supa.from("sales").update({ receipt_url: signed.signedUrl }).eq("id", saleId);

    return json({ url: signed.signedUrl, path });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
