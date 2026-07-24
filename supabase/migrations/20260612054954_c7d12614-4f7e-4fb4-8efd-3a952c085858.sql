ALTER VIEW public.public_testimonials SET (security_invoker = off);
DROP POLICY IF EXISTS "Public can read featured testimonials" ON public.client_feedback;
REVOKE SELECT ON public.client_feedback FROM anon;
GRANT SELECT ON public.public_testimonials TO anon, authenticated;