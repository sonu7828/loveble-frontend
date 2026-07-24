SELECT net.http_post(
  url := 'https://moqxtvbdgfambpmmslrr.supabase.co/functions/v1/send-monthly-report',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
  ),
  body := jsonb_build_object('recipientEmail','kv@rkaglow.com','year',2026,'month',5)
) AS req_id;