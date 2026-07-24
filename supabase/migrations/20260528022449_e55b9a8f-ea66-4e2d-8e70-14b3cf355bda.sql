DO $$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', tbl.table_name);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tbl.table_name);
  END LOOP;
END;
$$;

-- Public-read tables used by the booking/catalog experience. RLS still restricts rows.
GRANT SELECT ON TABLE public.locations TO anon;
GRANT SELECT ON TABLE public.service_categories TO anon;
GRANT SELECT ON TABLE public.services TO anon;
GRANT SELECT ON TABLE public.service_consents TO anon;
GRANT SELECT ON TABLE public.service_pre_op_instructions TO anon;
GRANT SELECT ON TABLE public.service_post_op_instructions TO anon;
GRANT SELECT ON TABLE public.service_providers TO anon;
GRANT SELECT ON TABLE public.unit_services TO anon;
GRANT SELECT ON TABLE public.weekly_schedules TO anon;
GRANT SELECT ON TABLE public.schedule_overrides TO anon;
GRANT SELECT ON TABLE public.promo_codes TO anon;
GRANT SELECT ON TABLE public.promo_slots TO anon;
GRANT SELECT ON TABLE public.consent_forms TO anon;

-- Staff directory public fields only; sensitive columns remain unavailable to anonymous visitors.
REVOKE SELECT ON TABLE public.staff_profiles FROM anon;
GRANT SELECT (id, full_name, title, color, bio, is_owner, is_active) ON TABLE public.staff_profiles TO anon;

-- Helper functions used by RLS policies must be executable by authenticated users.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_scheduler_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clinical_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_nurse_practitioner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_client_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_has_card_on_file() TO authenticated;

-- Keep intended authenticated RPCs reachable.
GRANT EXECUTE ON FUNCTION public.get_my_staff_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(uuid, uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_voucher_redemption(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';