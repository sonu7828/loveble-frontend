
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS price_cents integer,
  ADD COLUMN IF NOT EXISTS deposit_cents integer NOT NULL DEFAULT 0;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS deposit_amount_cents integer,
  ADD COLUMN IF NOT EXISTS deposit_charge_id text,
  ADD COLUMN IF NOT EXISTS deposit_charged_at timestamptz;

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS google_review_url text;

UPDATE public.locations SET google_review_url = 'https://g.page/r/CSd3Q5ZmyEyKEBM/review'
  WHERE google_review_url IS NULL AND (lower(city) LIKE 'san jose%' OR lower(slug) LIKE '%san-jose%' OR lower(name) LIKE '%san jose%');

UPDATE public.locations SET google_review_url = 'https://g.page/r/Cbxq-lFBRgAJEBM/review'
  WHERE google_review_url IS NULL AND (lower(city) LIKE 'san mateo%' OR lower(slug) LIKE '%san-mateo%' OR lower(name) LIKE '%san mateo%');
