ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER TABLE public.sales REPLICA IDENTITY FULL;