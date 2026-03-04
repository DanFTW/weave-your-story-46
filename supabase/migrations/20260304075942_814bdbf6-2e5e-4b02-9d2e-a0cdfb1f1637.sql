
-- Restaurant bookmark config table (mirrors calendar_event_sync_config)
CREATE TABLE public.restaurant_bookmark_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  restaurants_bookmarked integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_bookmark_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own restaurant config"
  ON public.restaurant_bookmark_config FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own restaurant config"
  ON public.restaurant_bookmark_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own restaurant config"
  ON public.restaurant_bookmark_config FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Pending restaurant bookmarks table (mirrors pending_calendar_events)
CREATE TABLE public.pending_restaurant_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  memory_id text NOT NULL,
  memory_content text NOT NULL,
  restaurant_name text,
  restaurant_address text,
  restaurant_cuisine text,
  restaurant_notes text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, memory_id)
);

ALTER TABLE public.pending_restaurant_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pending bookmarks"
  ON public.pending_restaurant_bookmarks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pending bookmarks"
  ON public.pending_restaurant_bookmarks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending bookmarks"
  ON public.pending_restaurant_bookmarks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pending bookmarks"
  ON public.pending_restaurant_bookmarks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add updated_at triggers
CREATE TRIGGER update_restaurant_bookmark_config_updated_at
  BEFORE UPDATE ON public.restaurant_bookmark_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pending_restaurant_bookmarks_updated_at
  BEFORE UPDATE ON public.pending_restaurant_bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
