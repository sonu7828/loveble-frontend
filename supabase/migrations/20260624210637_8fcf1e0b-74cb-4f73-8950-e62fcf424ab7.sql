ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS day7_tox_sms_sent_at TIMESTAMPTZ;

SELECT cron.schedule(
  'send-day7-tox-checkins-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://moqxtvbdgfambpmmslrr.supabase.co/functions/v1/send-day7-tox-checkins',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vcXh0dmJkZ2ZhbWJwbW1zbHJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2Njg5NjAsImV4cCI6MjA5MzI0NDk2MH0.nvWJtcHPPVNnDOThhi3XVgEHXXhJjnpe1NnbBp62F28'
    ),
    body := '{}'::jsonb
  );
  $$
);