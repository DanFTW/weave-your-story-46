
-- Calendar Event Sync Config
CREATE TABLE public.calendar_event_sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  events_created integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.calendar_event_sync_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own calendar sync config"
  ON public.calendar_event_sync_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar sync config"
  ON public.calendar_event_sync_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar sync config"
  ON public.calendar_event_sync_config FOR UPDATE
  USING (auth.uid() = user_id);

-- Pending Calendar Events
CREATE TABLE public.pending_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  memory_id text NOT NULL,
  memory_content text NOT NULL,
  event_title text,
  event_date text,
  event_time text,
  event_description text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, memory_id)
);

ALTER TABLE public.pending_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pending events"
  ON public.pending_calendar_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pending events"
  ON public.pending_calendar_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending events"
  ON public.pending_calendar_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pending events"
  ON public.pending_calendar_events FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at triggers
CREATE TRIGGER update_calendar_event_sync_config_updated_at
  BEFORE UPDATE ON public.calendar_event_sync_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pending_calendar_events_updated_at
  BEFORE UPDATE ON public.pending_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
