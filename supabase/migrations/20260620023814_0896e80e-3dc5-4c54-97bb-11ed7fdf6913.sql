ALTER TYPE public.sale_payment_method ADD VALUE IF NOT EXISTS 'account_credit';
ALTER TYPE public.sale_payment_method ADD VALUE IF NOT EXISTS 'unit_bank';
ALTER TYPE public.sale_payment_method ADD VALUE IF NOT EXISTS 'mixed_non_card';