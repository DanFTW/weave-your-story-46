SELECT cron.schedule(
  'discord-tracker-auto-poll',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yatadupadielakuenxui.supabase.co/functions/v1/discord-automation-triggers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-trigger', 'supabase-internal',
      'x-cron-secret', COALESCE((SELECT value FROM public.app_settings WHERE key = 'cron_secret'), '')
    ),
    body := jsonb_build_object('action', 'cron-poll')
  );
  $$
);