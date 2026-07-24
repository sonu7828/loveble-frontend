-- Remove all non-Kiem providers for Medical Wellness services
DELETE FROM public.service_providers sp
USING public.services s
WHERE sp.service_id = s.id
  AND s.category_id = 'c1000000-0000-0000-0000-000000000013'
  AND sp.staff_id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Ensure Kiem is assigned at both locations for every Medical Wellness service
INSERT INTO public.service_providers (service_id, staff_id, location_id)
SELECT s.id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, l.id
FROM public.services s
CROSS JOIN public.locations l
WHERE s.category_id = 'c1000000-0000-0000-0000-000000000013'
ON CONFLICT (service_id, staff_id, location_id) DO NOTHING;