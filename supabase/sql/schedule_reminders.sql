-- Run once in the Supabase SQL editor AFTER deploying the edge function.
-- Not a migration on purpose: it contains your project ref and a secret.
--
-- 1) Dashboard → Database → Extensions: enable pg_cron and pg_net.
-- 2) Store the cron secret in Vault (same value you gave `supabase secrets set CRON_SECRET=...`):
select vault.create_secret('REPLACE_WITH_CRON_SECRET', 'cron_secret');

-- 3) Call the function every hour at :05. Each person still gets at most one reminder per day,
--    at the first run after their chosen reminder time.
select cron.schedule(
  'watering-reminders',
  '5 * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-watering-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Useful later:
-- select * from cron.job_run_details order by start_time desc limit 20;
-- select cron.unschedule('watering-reminders');
