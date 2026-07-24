ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'arrived' BEFORE 'completed';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS checked_in_by uuid;