ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS internal_staff_note text,
  ADD COLUMN IF NOT EXISTS internal_note_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_note_updated_by uuid;