-- Promo slots: limited, pre-fixed bookable times for promo services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS promo_group text;
CREATE INDEX IF NOT EXISTS idx_services_promo_group ON public.services(promo_group) WHERE promo_group IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.promo_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_group text NOT NULL,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  slot_at timestamptz NOT NULL,
  claimed_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promo_group, slot_at)
);

CREATE INDEX IF NOT EXISTS idx_promo_slots_group ON public.promo_slots(promo_group);
CREATE INDEX IF NOT EXISTS idx_promo_slots_open ON public.promo_slots(promo_group, slot_at) WHERE claimed_appointment_id IS NULL;

ALTER TABLE public.promo_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read open promo slots"
  ON public.promo_slots FOR SELECT
  USING (true);

CREATE POLICY "Staff manage promo slots"
  ON public.promo_slots FOR ALL
  TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));

CREATE POLICY "Service role manages promo slots"
  ON public.promo_slots FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- When an appointment becomes cancelled/denied/no_show, free its promo slot
CREATE OR REPLACE FUNCTION public.free_promo_slot_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled','denied','no_show') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.promo_slots
       SET claimed_appointment_id = NULL, claimed_at = NULL
     WHERE claimed_appointment_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_free_promo_slot ON public.appointments;
CREATE TRIGGER trg_free_promo_slot
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.free_promo_slot_on_cancel();