-- Schedule daily admin digest email at 15:00 UTC (~7-8am Pacific).
-- Reuses the vault-stored service-role key from the email infra setup.

DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- Build function URL from project ref baked into supabase URL.
  v_url := 'https://moqxtvbdgfambpmmslrr.supabase.co/functions/v1/send-daily-digest';

  -- Fetch service-role key from vault (set up by email infra).
  BEGIN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_key := NULL;
  END;

  -- Unschedule prior version if it exists (idempotent).
  BEGIN
    PERFORM cron.unschedule('send-daily-digest');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  IF v_key IS NULL THEN
    RAISE NOTICE 'Vault secret email_queue_service_role_key not found — skipping cron schedule. Run email infra setup first.';
  ELSE
    PERFORM cron.schedule(
      'send-daily-digest',
      '0 15 * * *',
      format(
        $job$
          SELECT net.http_post(
            url := %L,
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer %s'
            ),
            body := '{}'::jsonb
          );
        $job$,
        v_url, v_key
      )
    );
  END IF;
END $$;
