CREATE TABLE IF NOT EXISTS public.quick_phrases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('neurotoxin','filler','energy','wellness')),
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
  phrase text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.quick_phrases TO authenticated;
GRANT ALL ON public.quick_phrases TO service_role;

ALTER TABLE public.quick_phrases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinical staff read phrases" ON public.quick_phrases
  FOR SELECT TO authenticated
  USING (public.is_clinical_staff(auth.uid()));

CREATE POLICY "Admins manage phrases" ON public.quick_phrases
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER quick_phrases_touch
  BEFORE UPDATE ON public.quick_phrases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_quick_phrases_cat ON public.quick_phrases(category, is_active);
CREATE INDEX IF NOT EXISTS idx_quick_phrases_svc ON public.quick_phrases(service_id, is_active);
