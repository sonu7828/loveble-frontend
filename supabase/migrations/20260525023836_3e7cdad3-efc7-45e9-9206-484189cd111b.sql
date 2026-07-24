DELETE FROM public.service_providers
WHERE location_id = '22222222-2222-2222-2222-222222222222'
  AND service_id IN (
    SELECT s.id FROM public.services s
    JOIN public.service_categories c ON c.id = s.category_id
    WHERE c.name IN ('Laser Hair Reduction','Lasers','Skin Tightening')
  );