-- Schedule Instagram automation polling every 5 minutes
-- First try to unschedule if exists
DO $$
BEGIN
  PERFORM cron.unschedule('instagram-automation-poll');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Schedule the cron job to run every 5 minutes
SELECT cron.schedule(
  'instagram-automation-poll',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yatadupadielakuenxui.supabase.co/functions/v1/instagram-automation-poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', COALESCE((SELECT value FROM public.app_settings WHERE key = 'cron_secret'), ''),
      'x-cron-trigger', 'supabase-internal'
    ),
    body := '{"action": "cron-poll"}'::jsonb
  ) AS request_id;
  $$
);