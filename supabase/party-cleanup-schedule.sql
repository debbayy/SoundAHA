-- Runs the "party-cleanup" Edge Function every hour (removes party files older than 6 hours).
--
-- Before running this:
--   1. Dashboard → Database → Extensions: enable "pg_cron" and "pg_net".
--   2. Deploy supabase/functions/party-cleanup (Dashboard → Edge Functions), with "Verify JWT" OFF.
--   3. Dashboard → Edge Functions → Secrets: add CLEANUP_SECRET with a long random value.
--   4. Put the SAME value below in place of <CLEANUP_SECRET>, then run this file in the SQL Editor.

select vault.create_secret('<CLEANUP_SECRET>', 'party_cleanup_secret');

select cron.schedule(
  'party-cleanup',
  '15 * * * *', -- every hour at :15
  $$
  select net.http_post(
    url := 'https://mxadbwiltxqzngtwvvxl.supabase.co/functions/v1/party-cleanup',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cleanup-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'party_cleanup_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To check it ran:  select * from cron.job_run_details order by start_time desc limit 5;
-- To stop it:       select cron.unschedule('party-cleanup');
