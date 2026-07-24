-- Deactivate Everesse promo services for now
UPDATE public.services SET is_active = false WHERE promo_group = 'everesse-launch-2026';

-- Schedule automatic reactivation on July 1, 2026 at 00:00 PT (07:00 UTC)
SELECT cron.schedule(
  'reactivate-everesse-promo-2026',
  '0 7 1 7 *',
  $$UPDATE public.services SET is_active = true WHERE promo_group = 'everesse-launch-2026';$$
);