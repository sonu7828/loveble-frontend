-- Allow marking consent forms as optional (patient may decline)
ALTER TABLE public.consent_forms
  ADD COLUMN IF NOT EXISTS is_optional boolean NOT NULL DEFAULT false;

-- Track whether a signature is a consent or a decline
ALTER TABLE public.consent_signatures
  ADD COLUMN IF NOT EXISTS decision text NOT NULL DEFAULT 'consent'
  CHECK (decision IN ('consent', 'decline'));

-- Allow blank signature_png when the patient declines
ALTER TABLE public.consent_signatures
  ALTER COLUMN signature_png DROP NOT NULL;
