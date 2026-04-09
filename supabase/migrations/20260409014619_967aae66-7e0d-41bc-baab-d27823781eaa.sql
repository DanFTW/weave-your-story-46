ALTER TABLE public.weekly_event_finder_config
  ADD COLUMN IF NOT EXISTS blocked_interests text;