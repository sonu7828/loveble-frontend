-- Complete sale 9ef8ec80 for Ritu Vohra: $960 fully covered by two service credits.
UPDATE public.sales
SET status = 'paid',
    payment_method = 'voucher_only',
    discount_cents = 96000,
    discount_amount_cents = 96000,
    discount_reason = 'Service credit: Free RF Microneedling + 30 units Neurotoxins',
    total_cents = 0,
    amount_due_cents = 0,
    paid_at = now(),
    updated_at = now()
WHERE id = '9ef8ec80-d146-459e-a6c9-00232dc93ba8'
  AND status = 'draft';

-- Mark both service credits redeemed against this sale.
UPDATE public.client_credits
SET redeemed_at = now(),
    redeemed_sale_id = '9ef8ec80-d146-459e-a6c9-00232dc93ba8',
    redeemed_amount_cents = amount_cents
WHERE id IN ('9e5ed1cc-da50-485d-8347-f4baabf456ee','73946ac7-654a-4c31-a54f-e72c6d34ef68')
  AND redeemed_at IS NULL;