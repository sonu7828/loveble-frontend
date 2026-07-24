// Sends a sale receipt email to the client after a sale is marked "paid".
// Also generates a PDF copy of the receipt, stores it in storage, and saves
// a signed URL on the sale so it shows up in the client's profile.
// Idempotent: skips email if no client_email, already sent, or unpaid.
export async function sendSaleReceiptIfNeeded(supa: any, saleId: string, opts: { keySuffix?: string } = {}) {
  try {
    const { data: sale } = await supa.from("sales").select("*").eq("id", saleId).maybeSingle();
    if (!sale) return;
    if (sale.status !== "paid" && sale.status !== "partially_refunded") return;

    // Always try to generate a PDF for paid sales (even if no email on file).
    if (!sale.receipt_url) {
      try {
        const { data: pdfRes, error: pdfErr } = await supa.functions.invoke(
          "generate-sale-receipt-pdf",
          { body: { saleId } },
        );
        if (pdfErr) console.error("[send-sale-receipt] pdf gen error", pdfErr);
        if (pdfRes?.url) sale.receipt_url = pdfRes.url;
      } catch (e) {
        console.error("[send-sale-receipt] pdf gen invoke threw", e);
      }
    }

    if (!sale.client_email) return;
    if (sale.receipt_email_sent_at) return;

    const [{ data: items }, { data: loc }, { data: ledger }, { data: pointsSettings }, { data: balance }] = await Promise.all([
      supa.from("sale_items").select("label, quantity, line_total_cents").eq("sale_id", saleId).order("display_order"),
      supa.from("locations").select("name").eq("id", sale.location_id).maybeSingle(),
      supa.from("client_points_ledger").select("delta, reason").eq("sale_id", saleId),
      supa.from("client_points_settings").select("point_value_cents").eq("id", true).maybeSingle(),
      supa.rpc("get_points_balance", { _client_email: sale.client_email }),
    ]);
    const pointsEarned = (ledger ?? []).filter((r: any) => r.reason === "earned").reduce((s: number, r: any) => s + (r.delta ?? 0), 0);
    const pointsRedeemed = -(ledger ?? []).filter((r: any) => r.reason === "redeemed").reduce((s: number, r: any) => s + (r.delta ?? 0), 0);
    const pointValueCents = pointsSettings?.point_value_cents ?? 10;

    const fmt = (c: number) => `$${(Math.abs(c) / 100).toFixed(2)}`;
    const paymentLabelMap: Record<string, string> = {
      terminal: "Card (Terminal)",
      card_on_file: "Card on file",
      manual_card: "Card",
      cash: "Cash",
      voucher_only: "Gift card / voucher",
    };

    const payload = {
      recipientName: [sale.client_first_name, sale.client_last_name].filter(Boolean).join(" ").trim() || undefined,
      saleNumber: String(saleId).slice(0, 8).toUpperCase(),
      paidOnFormatted: sale.paid_at ? new Date(sale.paid_at).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        month: "long", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit",
      }) : undefined,
      locationName: loc?.name,
      paymentMethodLabel: paymentLabelMap[sale.payment_method ?? ""] ?? sale.payment_method,
      items: (items ?? []).map((it: any) => ({
        label: it.label,
        quantity: Number(it.quantity),
        amountFormatted: fmt(it.line_total_cents ?? 0),
      })),
      subtotalFormatted: fmt(sale.subtotal_cents ?? 0),
      discountFormatted: (sale.discount_cents ?? 0) > 0 ? fmt(sale.discount_cents) : undefined,
      voucherFormatted: (sale.voucher_applied_cents ?? 0) > 0 ? fmt(sale.voucher_applied_cents) : undefined,
      taxFormatted: (sale.tax_cents ?? 0) > 0 ? fmt(sale.tax_cents) : undefined,
      tipFormatted: (sale.tip_cents ?? 0) > 0 ? fmt(sale.tip_cents) : undefined,
      processingFeeFormatted: (sale.processing_fee_cents ?? 0) > 0 ? fmt(sale.processing_fee_cents) : undefined,
      totalFormatted: fmt(sale.total_cents ?? 0),
      refundedFormatted: (sale.refunded_amount_cents ?? 0) > 0 ? fmt(sale.refunded_amount_cents) : undefined,
      netPaidFormatted: (sale.refunded_amount_cents ?? 0) > 0
        ? fmt((sale.total_cents ?? 0) - (sale.refunded_amount_cents ?? 0))
        : undefined,
      receiptPdfUrl: sale.receipt_url ?? undefined,
      pointsEarned: pointsEarned > 0 ? pointsEarned : undefined,
      pointsRedeemed: pointsRedeemed > 0 ? pointsRedeemed : undefined,
      pointsRedeemedValueFormatted: pointsRedeemed > 0 ? fmt(pointsRedeemed * pointValueCents) : undefined,
      pointsBalance: (balance as number | null) ?? undefined,
      pointsBalanceValueFormatted: (balance as number | null) != null ? fmt((balance as number) * pointValueCents) : undefined,
    };

    const { error } = await supa.functions.invoke("send-transactional-email", {
      body: {
        templateName: "sale-receipt",
        recipientEmail: sale.client_email,
        idempotencyKey: `sale-receipt-${saleId}${opts.keySuffix ? `-${opts.keySuffix}` : ""}`,
        templateData: payload,
      },
    });
    if (error) {
      console.error("[send-sale-receipt] invoke error", error);
      return;
    }
    await supa.from("sales").update({ receipt_email_sent_at: new Date().toISOString() }).eq("id", saleId);
  } catch (e) {
    console.error("[send-sale-receipt] error", e);
  }
}
