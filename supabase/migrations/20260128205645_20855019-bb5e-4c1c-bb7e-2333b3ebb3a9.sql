-- Create settings table for storing secrets accessible to pg_cron
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Secure the table - no public access
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only service role can access (no policies = no public access)
COMMENT ON TABLE public.app_settings IS 'Internal app settings for background jobs';

-- First try to unschedule if exists (ignore errors if doesn't exist)
DO $$
BEGIN
  PERFORM cron.unschedule('twitter-alpha-tracker-poll');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist, ignore
END;
$$;

-- Schedule the cron job to run every minute
SELECT cron.schedule(
  'twitter-alpha-tracker-poll',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yatadupadielakuenxui.supabase.co/functions/v1/twitter-alpha-tracker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', COALESCE((SELECT value FROM public.app_settings WHERE key = 'cron_secret'), '')
    ),
    body := '{"action": "cron-poll"}'::jsonb
  ) AS request_id;
  $$
);