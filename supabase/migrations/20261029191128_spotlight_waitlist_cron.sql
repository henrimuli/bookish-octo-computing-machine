-- Supabase Cron (pg_cron + pg_net) calls our cron routes more often than
-- Vercel Hobby allows: the Spotlight waitlist every 5 minutes, so makers hear
-- about an open spot within minutes, and the hourly catch-up job every hour.
--
-- The site URL and CRON_SECRET are read from Supabase Vault at run time, so
-- nothing secret lives in this file. Add them once per project (SQL editor):
--   select vault.create_secret('https://debutyard.com', 'site_url');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
--
-- Plain Postgres (CI, local tests) has no pg_cron or Vault, so this is a no-op there.
DO $$
DECLARE
  call text := $call$
    select net.http_get(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'site_url') || '%s',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      timeout_milliseconds := 60000
    )
  $call$;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
    OR NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net')
    OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'vault') THEN
    RAISE NOTICE 'pg_cron, pg_net or Vault not available; skipping cron schedules';
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

  -- Re-running replaces the jobs instead of duplicating them.
  PERFORM cron.unschedule(jobname) FROM cron.job
    WHERE jobname IN ('debutyard-spotlight-waitlist', 'debutyard-hourly');
  PERFORM cron.schedule('debutyard-spotlight-waitlist', '*/5 * * * *', format(call, '/api/cron/waitlist'));
  PERFORM cron.schedule('debutyard-hourly', '5 * * * *', format(call, '/api/cron/hourly'));
END
$$;
