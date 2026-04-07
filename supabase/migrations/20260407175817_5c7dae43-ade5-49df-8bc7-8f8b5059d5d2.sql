
-- Weekly Event Finder config table
CREATE TABLE public.weekly_event_finder_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  interests text,
  location text,
  frequency text NOT NULL DEFAULT 'weekly',
  delivery_method text NOT NULL DEFAULT 'email',
  email text,
  events_found integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_event_finder_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own weekly event finder config"
  ON public.weekly_event_finder_config FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weekly event finder config"
  ON public.weekly_event_finder_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weekly event finder config"
  ON public.weekly_event_finder_config FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_weekly_event_finder_config_updated_at
  BEFORE UPDATE ON public.weekly_event_finder_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Weekly Event Finder processed events table
CREATE TABLE public.weekly_event_finder_processed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id text NOT NULL,
  event_title text,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);

ALTER TABLE public.weekly_event_finder_processed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own processed events"
  ON public.weekly_event_finder_processed FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own processed events"
  ON public.weekly_event_finder_processed FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
