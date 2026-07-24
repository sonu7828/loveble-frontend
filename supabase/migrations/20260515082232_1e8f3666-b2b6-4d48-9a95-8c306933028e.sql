CREATE TABLE IF NOT EXISTS public.service_post_op_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL UNIQUE REFERENCES public.services(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'After-Care Instructions',
  body_markdown text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  last_edited_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_post_op_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read post-op instructions"
  ON public.service_post_op_instructions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage post-op instructions"
  ON public.service_post_op_instructions FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_post_op_touch
  BEFORE UPDATE ON public.service_post_op_instructions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Bump version when body changes
CREATE OR REPLACE FUNCTION public.bump_post_op_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.body_markdown IS DISTINCT FROM OLD.body_markdown THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END
$fn$;

CREATE TRIGGER trg_post_op_version
  BEFORE UPDATE ON public.service_post_op_instructions
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_post_op_version();

-- Track when post-op was emailed for an appointment (idempotency / audit)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS post_op_sent_at timestamptz;