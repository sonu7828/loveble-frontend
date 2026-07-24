
CREATE TABLE public.service_pre_op_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL UNIQUE REFERENCES public.services(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Pre-Treatment Instructions',
  body_markdown text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  last_edited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_pre_op_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pre-op instructions"
  ON public.service_pre_op_instructions
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Public can read pre-op instructions"
  ON public.service_pre_op_instructions
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.bump_pre_op_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.body_markdown IS DISTINCT FROM OLD.body_markdown THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_pre_op_touch BEFORE UPDATE ON public.service_pre_op_instructions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_pre_op_version BEFORE UPDATE ON public.service_pre_op_instructions
  FOR EACH ROW EXECUTE FUNCTION public.bump_pre_op_version();

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS pre_op_sent_at timestamptz;
