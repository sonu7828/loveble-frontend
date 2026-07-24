ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS license_number text;
UPDATE public.staff_profiles SET license_number = '95021080' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';