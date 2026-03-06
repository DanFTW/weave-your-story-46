
-- Instagram Analytics Config table
CREATE TABLE public.instagram_analytics_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  insights_collected integer NOT NULL DEFAULT 0,
  last_polled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_analytics_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own instagram analytics config"
  ON public.instagram_analytics_config FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own instagram analytics config"
  ON public.instagram_analytics_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own instagram analytics config"
  ON public.instagram_analytics_config FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Instagram Analytics Processed (dedup) table
CREATE TABLE public.instagram_analytics_processed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_analytics_processed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own instagram analytics processed"
  ON public.instagram_analytics_processed FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own instagram analytics processed"
  ON public.instagram_analytics_processed FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Unique constraint for deduplication
CREATE UNIQUE INDEX idx_instagram_analytics_processed_dedupe
  ON public.instagram_analytics_processed (user_id, dedupe_key);
