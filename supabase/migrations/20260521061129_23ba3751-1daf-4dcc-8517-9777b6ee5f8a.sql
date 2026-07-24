-- Delete standalone Body Contouring service
DELETE FROM public.services WHERE id = '58000000-0000-0000-0000-000000000001';

-- Move Exosomes Add-On to Microneedling category
UPDATE public.services
SET category_id = 'c1000000-0000-0000-0000-000000000005'
WHERE id = '58000000-0000-0000-0000-000000000004';

-- Reschedule Everesse activation: July 18, 2026 at 00:00 PT (07:00 UTC)
SELECT cron.unschedule('reactivate-everesse-promo-2026');
SELECT cron.schedule(
  'reactivate-everesse-promo-2026',
  '0 7 18 7 *',
  $$UPDATE public.services SET is_active = true WHERE promo_group = 'everesse-launch-2026';$$
);
-- Ensure they remain inactive now
UPDATE public.services SET is_active = false WHERE promo_group = 'everesse-launch-2026';