
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS stack_numbing_minutes integer NOT NULL DEFAULT 0;

UPDATE public.services SET stack_numbing_minutes = 45
WHERE id IN (
  '55000000-0000-0000-0000-000000000001', -- Pen Microneedling
  '55000000-0000-0000-0000-000000000002', -- RF Microneedling
  '5a000006-0000-0000-0000-000000000a02', -- June Special — Pen Microneedling
  '57000000-0000-0000-0000-000000000004', -- CO2 Laser
  '57000000-0000-0000-0000-000000000107'  -- CO2 Laser — Package of 3
);

CREATE OR REPLACE FUNCTION public.prevent_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_conflict_count int;
  v_conflict record;
  v_new_numb int;
  v_allow text;
BEGIN
  IF NEW.status NOT IN ('pending','approved') THEN RETURN NEW; END IF;
  IF NEW.start_at IS NULL OR NEW.end_at IS NULL OR NEW.end_at <= NEW.start_at THEN RETURN NEW; END IF;

  BEGIN v_allow := current_setting('app.allow_appt_overlap', true); EXCEPTION WHEN OTHERS THEN v_allow := NULL; END;
  IF v_allow = 'on' THEN RETURN NEW; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.staff_id::text, 42));

  SELECT count(*) INTO v_conflict_count
  FROM public.appointments a
  WHERE a.staff_id = NEW.staff_id
    AND a.id IS DISTINCT FROM NEW.id
    AND a.status IN ('pending','approved')
    AND a.start_at < NEW.end_at AND a.end_at > NEW.start_at;

  IF v_conflict_count = 0 THEN RETURN NEW; END IF;

  IF v_conflict_count > 1 THEN
    RAISE EXCEPTION 'Provider already has overlapping appointments' USING ERRCODE = '23P01';
  END IF;

  SELECT COALESCE(s.stack_numbing_minutes, 0) INTO v_new_numb
  FROM public.services s WHERE s.id = NEW.service_id;

  SELECT a.id, a.start_at, a.end_at, COALESCE(s.stack_numbing_minutes, 0) AS other_numb
    INTO v_conflict
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  WHERE a.staff_id = NEW.staff_id
    AND a.id IS DISTINCT FROM NEW.id
    AND a.status IN ('pending','approved')
    AND a.start_at < NEW.end_at AND a.end_at > NEW.start_at
  LIMIT 1;

  IF COALESCE(v_new_numb, 0) = 0 OR COALESCE(v_conflict.other_numb, 0) = 0 THEN
    RAISE EXCEPTION 'Provider already has an overlapping appointment (%)', v_conflict.id USING ERRCODE = '23P01';
  END IF;

  -- The later appt must start within the earlier appt's numbing window
  IF NEW.start_at >= v_conflict.start_at THEN
    IF NEW.start_at > v_conflict.start_at + (v_conflict.other_numb || ' minutes')::interval THEN
      RAISE EXCEPTION 'Stacked appointment must start within the numbing window of appointment %', v_conflict.id USING ERRCODE = '23P01';
    END IF;
  ELSE
    IF v_conflict.start_at > NEW.start_at + (v_new_numb || ' minutes')::interval THEN
      RAISE EXCEPTION 'Stacked appointment must start within the numbing window of appointment %', v_conflict.id USING ERRCODE = '23P01';
    END IF;
  END IF;

  RETURN NEW;
END $$;
