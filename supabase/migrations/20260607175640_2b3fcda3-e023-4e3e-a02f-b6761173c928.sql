
-- 1) Server-side signed_at enforcement (overwrite client-supplied values on sign)
CREATE OR REPLACE FUNCTION public.enforce_server_signed_at_notes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- On transition into signed/cosigned/locked, force server timestamp
  IF NEW.status IN ('signed','cosigned','locked')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('signed','cosigned','locked')) THEN
    NEW.signed_at := now();
  END IF;
  IF NEW.status = 'cosigned' AND (OLD.status IS NULL OR OLD.status <> 'cosigned') THEN
    NEW.cosigned_at := now();
  END IF;
  IF NEW.status = 'locked' AND (OLD.status IS NULL OR OLD.status <> 'locked') THEN
    NEW.locked_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_server_signed_at_notes ON public.clinical_notes;
CREATE TRIGGER trg_enforce_server_signed_at_notes
BEFORE INSERT OR UPDATE ON public.clinical_notes
FOR EACH ROW EXECUTE FUNCTION public.enforce_server_signed_at_notes();

CREATE OR REPLACE FUNCTION public.enforce_server_signed_at_encounters()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'signed'
     AND (OLD.status IS NULL OR OLD.status <> 'signed') THEN
    NEW.signed_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_server_signed_at_encounters ON public.clinical_encounters;
CREATE TRIGGER trg_enforce_server_signed_at_encounters
BEFORE INSERT OR UPDATE ON public.clinical_encounters
FOR EACH ROW EXECUTE FUNCTION public.enforce_server_signed_at_encounters();

CREATE OR REPLACE FUNCTION public.enforce_server_signed_at_gfe()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- On transition into is_locked=true, force server timestamp
  IF NEW.is_locked = true AND (OLD.is_locked IS DISTINCT FROM true) THEN
    NEW.signed_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_server_signed_at_gfe ON public.gfe_records;
CREATE TRIGGER trg_enforce_server_signed_at_gfe
BEFORE INSERT OR UPDATE ON public.gfe_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_server_signed_at_gfe();

-- 2) GFE required-field validation on sign
CREATE OR REPLACE FUNCTION public.validate_gfe_required_on_sign()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_locked = true AND (OLD.is_locked IS DISTINCT FROM true) THEN
    IF coalesce(array_length(NEW.chief_concerns, 1), 0) = 0 THEN
      RAISE EXCEPTION 'GFE cannot be signed without at least one chief concern';
    END IF;
    IF coalesce(array_length(NEW.treatment_goals, 1), 0) = 0 THEN
      RAISE EXCEPTION 'GFE cannot be signed without at least one treatment goal';
    END IF;
    IF coalesce(length(trim(NEW.np_assessment_plan)), 0) = 0 THEN
      RAISE EXCEPTION 'GFE cannot be signed without an NP assessment & plan';
    END IF;
    IF coalesce(length(trim(NEW.np_name)), 0) = 0
       OR NEW.signature_png IS NULL
       OR length(NEW.signature_png) < 100 THEN
      RAISE EXCEPTION 'GFE cannot be signed without a provider signature';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_gfe_required_on_sign ON public.gfe_records;
CREATE TRIGGER trg_validate_gfe_required_on_sign
BEFORE INSERT OR UPDATE ON public.gfe_records
FOR EACH ROW EXECUTE FUNCTION public.validate_gfe_required_on_sign();

-- 3) Atomic booking — prevent overlapping appointments for the same staff
-- Uses BEFORE INSERT/UPDATE trigger with row-level lock for race-free check.
CREATE OR REPLACE FUNCTION public.prevent_appointment_overlap()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_conflict_id uuid;
BEGIN
  -- Only enforce for live statuses
  IF NEW.status NOT IN ('pending','approved') THEN
    RETURN NEW;
  END IF;
  IF NEW.start_at IS NULL OR NEW.end_at IS NULL OR NEW.end_at <= NEW.start_at THEN
    RETURN NEW;
  END IF;

  -- Advisory lock per staff so concurrent inserts serialize
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.staff_id::text, 42));

  SELECT id INTO v_conflict_id
    FROM public.appointments
   WHERE staff_id = NEW.staff_id
     AND id IS DISTINCT FROM NEW.id
     AND status IN ('pending','approved')
     AND start_at < NEW.end_at
     AND end_at   > NEW.start_at
   LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Provider already has an overlapping appointment (%)', v_conflict_id
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_appointment_overlap ON public.appointments;
CREATE TRIGGER trg_prevent_appointment_overlap
BEFORE INSERT OR UPDATE OF start_at, end_at, status, staff_id
ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.prevent_appointment_overlap();

-- Helpful index for the overlap query
CREATE INDEX IF NOT EXISTS appointments_staff_live_range_idx
  ON public.appointments (staff_id, start_at, end_at)
  WHERE status IN ('pending','approved');
