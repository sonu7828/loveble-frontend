
ALTER TABLE public.clinical_notes
  ADD COLUMN IF NOT EXISTS bp_systolic integer,
  ADD COLUMN IF NOT EXISTS bp_diastolic integer,
  ADD COLUMN IF NOT EXISTS heart_rate integer,
  ADD COLUMN IF NOT EXISTS pain_score_pre integer,
  ADD COLUMN IF NOT EXISTS pain_score_post integer,
  ADD COLUMN IF NOT EXISTS time_out_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS site_marked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_equipment_available boolean NOT NULL DEFAULT false;

ALTER TABLE public.clinical_note_energy
  ADD COLUMN IF NOT EXISTS device_serial text;

ALTER TABLE public.clinical_note_neurotoxin
  ADD COLUMN IF NOT EXISTS reconstitution_agent text;
