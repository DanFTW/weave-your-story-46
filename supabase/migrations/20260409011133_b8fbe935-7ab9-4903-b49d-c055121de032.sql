ALTER TABLE public.weekly_event_finder_processed
  ADD COLUMN IF NOT EXISTS event_date text,
  ADD COLUMN IF NOT EXISTS event_description text,
  ADD COLUMN IF NOT EXISTS event_reason text,
  ADD COLUMN IF NOT EXISTS event_link text;