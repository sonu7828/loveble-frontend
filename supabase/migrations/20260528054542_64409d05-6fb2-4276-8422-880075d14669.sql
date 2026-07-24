INSERT INTO public.service_providers (service_id, staff_id, location_id)
SELECT s.id, p.staff_id, p.location_id
FROM (VALUES ('a8259a85-ac20-4335-80a3-7f4fa2c9624c'::uuid), ('d39d457c-82e6-449e-8148-cef95fb61ef0'::uuid)) AS s(id)
CROSS JOIN (SELECT staff_id, location_id FROM public.service_providers WHERE service_id='56000000-0000-0000-0000-000000000001') p
ON CONFLICT DO NOTHING;