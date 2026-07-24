
-- Re-add appointments to realtime publication. RLS on the appointments table filters
-- postgres_changes payloads per subscriber, so clients only receive their own appointments
-- and staff only receive appointments their RLS policies grant them.
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
