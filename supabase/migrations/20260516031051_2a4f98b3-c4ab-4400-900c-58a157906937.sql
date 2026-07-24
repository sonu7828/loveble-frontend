-- Schedule consent reminders to run every 30 minutes
SELECT cron.schedule(
  'send-consent-reminders',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://moqxtvbdgfambpmmslrr.supabase.co/functions/v1/send-consent-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)
    ),
    body := jsonb_build_object('triggered_at', now())
  );
  $$
);