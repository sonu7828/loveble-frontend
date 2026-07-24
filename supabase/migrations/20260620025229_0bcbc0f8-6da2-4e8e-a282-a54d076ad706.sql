UPDATE public.appointments SET staff_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' WHERE staff_id='dddddddd-dddd-dddd-dddd-dddddddddddd';
DELETE FROM public.staff_invitations WHERE lower(email) = 'djsooshi@gmail.com';
DELETE FROM public.staff_profiles WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';