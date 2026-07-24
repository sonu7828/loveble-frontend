ALTER TABLE public.clinical_note_energy
  ADD COLUMN IF NOT EXISTS lot_number text,
  ADD COLUMN IF NOT EXISTS expiration_date date;