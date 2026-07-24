
CREATE TABLE IF NOT EXISTS public.webhook_events_processed (
  id text PRIMARY KEY,
  source text NOT NULL,
  event_type text,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.webhook_events_processed TO service_role;
ALTER TABLE public.webhook_events_processed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.webhook_events_processed FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS webhook_events_processed_at_idx ON public.webhook_events_processed(processed_at DESC);
