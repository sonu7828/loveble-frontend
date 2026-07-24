DELETE FROM public.service_providers
WHERE staff_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  AND location_id IN (SELECT id FROM public.locations WHERE name ILIKE '%mateo%');

UPDATE public.weekly_schedules SET is_active = false
WHERE staff_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  AND location_id IN (SELECT id FROM public.locations WHERE name ILIKE '%mateo%');