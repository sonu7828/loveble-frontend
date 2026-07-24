
CREATE OR REPLACE FUNCTION public.is_kiem(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
      AND user_id = _user_id
  );
$$;

UPDATE public.services SET is_active = false WHERE name ILIKE '%retatru%';
UPDATE public.products SET is_active = false WHERE name ILIKE '%retatru%';
UPDATE public.consent_forms SET is_active = false WHERE slug ILIKE '%retatru%' OR title ILIKE '%retatru%';
UPDATE public.chart_note_templates SET is_active = false
 WHERE name ILIKE '%retatru%' OR (body::text) ILIKE '%retatru%';
UPDATE public.compliance_protocols SET is_active = false
 WHERE title ILIKE '%retatru%' OR slug ILIKE '%retatru%' OR body_markdown ILIKE '%retatru%';
UPDATE public.product_lots SET is_active = false WHERE product_name ILIKE '%retatru%';

DELETE FROM public.clinical_protocol_versions
 WHERE protocol_id IN (SELECT id FROM public.clinical_protocols WHERE title ILIKE '%retatru%' OR slug ILIKE '%retatru%' OR category::text = 'retatrutide');
DELETE FROM public.clinical_protocols
 WHERE title ILIKE '%retatru%' OR slug ILIKE '%retatru%' OR category::text = 'retatrutide';

CREATE POLICY "hide_retatrutide_clinical_notes"
ON public.clinical_notes AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.is_kiem(auth.uid())
  OR NOT (
    COALESCE(service_name,'') ILIKE '%retatru%'
    OR COALESCE(category::text,'') ILIKE '%retatru%'
    OR COALESCE(provider_notes,'') ILIKE '%retatru%'
    OR COALESCE(array_to_string(post_assessment,' '),'') ILIKE '%retatru%'
  )
)
WITH CHECK (
  public.is_kiem(auth.uid())
  OR NOT (
    COALESCE(service_name,'') ILIKE '%retatru%'
    OR COALESCE(category::text,'') ILIKE '%retatru%'
    OR COALESCE(provider_notes,'') ILIKE '%retatru%'
    OR COALESCE(array_to_string(post_assessment,' '),'') ILIKE '%retatru%'
  )
);

CREATE POLICY "hide_retatrutide_clinical_note_wellness"
ON public.clinical_note_wellness AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.is_kiem(auth.uid())
  OR (
    NOT (
      COALESCE(product,'') ILIKE '%retatru%'
      OR COALESCE(service_type,'') ILIKE '%retatru%'
      OR COALESCE(dose,'') ILIKE '%retatru%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.clinical_notes n
      WHERE n.id = clinical_note_id
        AND (
          COALESCE(n.service_name,'') ILIKE '%retatru%'
          OR COALESCE(n.category::text,'') ILIKE '%retatru%'
          OR COALESCE(n.provider_notes,'') ILIKE '%retatru%'
          OR COALESCE(array_to_string(n.post_assessment,' '),'') ILIKE '%retatru%'
        )
    )
  )
)
WITH CHECK (
  public.is_kiem(auth.uid())
  OR NOT (
    COALESCE(product,'') ILIKE '%retatru%'
    OR COALESCE(service_type,'') ILIKE '%retatru%'
    OR COALESCE(dose,'') ILIKE '%retatru%'
  )
);

CREATE POLICY "hide_retatrutide_clinical_encounters"
ON public.clinical_encounters AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.is_kiem(auth.uid())
  OR NOT (
    COALESCE(category::text,'') ILIKE '%retatru%'
    OR COALESCE(subjective,'') ILIKE '%retatru%'
    OR COALESCE(objective,'') ILIKE '%retatru%'
    OR COALESCE(assessment,'') ILIKE '%retatru%'
    OR COALESCE(plan,'') ILIKE '%retatru%'
  )
)
WITH CHECK (
  public.is_kiem(auth.uid())
  OR NOT (
    COALESCE(category::text,'') ILIKE '%retatru%'
    OR COALESCE(subjective,'') ILIKE '%retatru%'
    OR COALESCE(objective,'') ILIKE '%retatru%'
    OR COALESCE(assessment,'') ILIKE '%retatru%'
    OR COALESCE(plan,'') ILIKE '%retatru%'
  )
);

CREATE POLICY "hide_retatrutide_gfe_records"
ON public.gfe_records AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.is_kiem(auth.uid())
  OR NOT (
    COALESCE(np_assessment_plan,'') ILIKE '%retatru%'
    OR COALESCE(authorized_treatments::text,'') ILIKE '%retatru%'
  )
)
WITH CHECK (
  public.is_kiem(auth.uid())
  OR NOT (
    COALESCE(np_assessment_plan,'') ILIKE '%retatru%'
    OR COALESCE(authorized_treatments::text,'') ILIKE '%retatru%'
  )
);
