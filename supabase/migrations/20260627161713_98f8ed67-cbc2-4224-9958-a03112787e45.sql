
ALTER TABLE public.client_intake_submissions
  ADD COLUMN IF NOT EXISTS skin_type text,
  ADD COLUMN IF NOT EXISTS skin_concerns text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sun_exposure text,
  ADD COLUMN IF NOT EXISTS smoking_status text,
  ADD COLUMN IF NOT EXISTS alcohol_use text,
  ADD COLUMN IF NOT EXISTS exercise_frequency text,
  ADD COLUMN IF NOT EXISTS skincare_products text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS prior_cosmetic_procedures text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS family_history text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS social_history text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS primary_care_physician text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation text,
  ADD COLUMN IF NOT EXISTS hipaa_acknowledged boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS truthful_acknowledged boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS signature_full_name text,
  ADD COLUMN IF NOT EXISTS signature_date date;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS intake_last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS intake_send_count integer DEFAULT 0;
