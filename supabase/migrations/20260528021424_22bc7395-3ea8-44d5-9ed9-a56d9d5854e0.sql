
-- 1) Drop public read on consent-pdfs and calendar-invites buckets (signed URLs used in code).
DROP POLICY IF EXISTS "Public can read consent pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Public read calendar invites" ON storage.objects;

-- Add staff fallback SELECT (signed URLs are primary; staff may need direct access)
CREATE POLICY "Staff read consent pdfs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'consent-pdfs' AND public.is_staff_or_admin(auth.uid()));

CREATE POLICY "Staff read calendar invites"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'calendar-invites' AND (public.is_staff_or_admin(auth.uid()) OR public.is_scheduler_or_admin(auth.uid())));

-- 2) marketing-assets bucket: restrict listing (objects vs reading single files via path is still possible for public bucket via CDN).
-- Replace broad SELECT with path-specific read so public can fetch by key but cannot list arbitrary objects.
-- (Public buckets serve via storage URL regardless of policy; tighten the listing policy.)
DROP POLICY IF EXISTS "Public read marketing assets" ON storage.objects;
CREATE POLICY "Public read marketing assets"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'marketing-assets' AND name IS NOT NULL AND position('/' in name) > 0);

-- 3) staff_profiles: create safe public directory view; drop broad public select; replace with authenticated-only.
DROP POLICY IF EXISTS "Public can view active staff via directory" ON public.staff_profiles;

CREATE POLICY "Authenticated can view active staff (limited)"
  ON public.staff_profiles FOR SELECT TO authenticated
  USING (is_active = true);

CREATE OR REPLACE VIEW public.staff_directory
WITH (security_invoker = true) AS
  SELECT id, full_name, title, color, bio, is_owner, is_active
  FROM public.staff_profiles
  WHERE is_active = true;

GRANT SELECT ON public.staff_directory TO anon, authenticated;

-- 4) promo_slots: restrict public select to unclaimed rows (so claimed_appointment_id never exposed).
DROP POLICY IF EXISTS "Public read open promo slots" ON public.promo_slots;
CREATE POLICY "Public read open promo slots"
  ON public.promo_slots FOR SELECT TO anon, authenticated
  USING (claimed_at IS NULL AND claimed_appointment_id IS NULL);

-- 5) Realtime leak on appointments: drop from realtime publication (only staff dashboard uses it; we'll fall back to polling).
ALTER PUBLICATION supabase_realtime DROP TABLE public.appointments;

-- 6) Revoke EXECUTE on internal SECURITY DEFINER helpers from anon/authenticated.
-- These are invoked internally by RLS policies (definer rights apply automatically); they don't need direct EXECUTE.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff_or_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_scheduler_or_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_nurse_practitioner(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_clinical_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_client_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.client_has_card_on_file() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_appointment_consent_signed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.free_promo_slot_on_cancel() FROM PUBLIC, anon, authenticated;

-- Keep callable for authenticated users that legitimately invoke via RPC:
GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_staff_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(uuid, uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_voucher_redemption(uuid) TO authenticated;
