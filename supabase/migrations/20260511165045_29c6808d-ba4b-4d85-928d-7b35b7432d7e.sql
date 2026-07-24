DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  v_url := 'https://moqxtvbdgfambpmmslrr.supabase.co/functions/v1/process-marketing-campaigns';

  BEGIN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_key := NULL;
  END;

  BEGIN
    PERFORM cron.unschedule('process-marketing-campaigns');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  IF v_key IS NULL THEN
    RAISE NOTICE 'Vault secret email_queue_service_role_key not found — skipping cron schedule.';
  ELSE
    PERFORM cron.schedule(
      'process-marketing-campaigns',
      '0 17 * * *',
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