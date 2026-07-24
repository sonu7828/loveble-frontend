
CREATE TABLE public.client_review_promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email text NOT NULL UNIQUE,
  promo_code_id uuid REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  code text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL
);
CREATE INDEX client_review_promos_email_idx ON public.client_review_promos (lower(client_email));

GRANT SELECT ON public.client_review_promos TO authenticated;
GRANT ALL ON public.client_review_promos TO service_role;

ALTER TABLE public.client_review_promos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view review promos"
  ON public.client_review_promos FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid()));
