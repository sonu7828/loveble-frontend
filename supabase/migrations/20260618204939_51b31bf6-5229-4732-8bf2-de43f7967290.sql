ALTER TABLE public.clinical_note_filler   ADD COLUMN IF NOT EXISTS site_map jsonb;
ALTER TABLE public.clinical_note_energy   ADD COLUMN IF NOT EXISTS site_map jsonb;
ALTER TABLE public.clinical_note_wellness ADD COLUMN IF NOT EXISTS site_map jsonb;