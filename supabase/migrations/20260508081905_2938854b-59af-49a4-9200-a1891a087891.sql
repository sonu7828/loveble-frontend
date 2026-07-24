ALTER TABLE public.services ADD COLUMN IF NOT EXISTS price_note text;
ALTER TABLE public.services ALTER COLUMN deposit_cents SET DEFAULT 0;
UPDATE public.services SET deposit_cents = 0 WHERE deposit_cents <> 0;