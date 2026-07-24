DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  v_url := 'https://moqxtvbdgfambpmmslrr.supabase.co/functions/v1/send-birthday-greetings';

  BEGIN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_key := NULL;
  END;

  BEGIN
    PERFORM cron.unschedule('send-birthday-greetings');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  IF v_key IS NULL THEN
    RAISE NOTICE 'Vault secret email_queue_service_role_key not found — skipping cron schedule.';
  ELSE
    -- 16:00 UTC = ~8-9am Pacific (after the digest at 15:00 UTC).
    PERFORM cron.schedule(
      'send-birthday-greetings',
      '0 16 * * *',
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