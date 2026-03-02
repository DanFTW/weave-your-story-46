
-- Step 1: Drop the broken cron job
SELECT cron.unschedule('birthday-reminder-daily');

-- Step 2: Recreate with correct headers matching other working cron jobs
SELECT cron.schedule(
  'birthday-reminder-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yatadupadielakuenxui.supabase.co/functions/v1/birthday-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'cron_secret'),
      'x-cron-trigger', 'supabase-internal'
    ),
    body := '{"action": "cron-poll"}'::jsonb
  ) AS request_id;
  $$
);
