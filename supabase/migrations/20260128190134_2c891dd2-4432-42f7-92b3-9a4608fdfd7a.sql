-- Create table for Twitter Alpha Tracker configuration
CREATE TABLE public.twitter_alpha_tracker_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tracked_username TEXT,
  tracked_user_id TEXT,
  tracked_display_name TEXT,
  tracked_avatar_url TEXT,
  is_active BOOLEAN DEFAULT false,
  posts_tracked INTEGER DEFAULT 0,
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.twitter_alpha_tracker_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for twitter_alpha_tracker_config
CREATE POLICY "Users can view their own twitter alpha tracker config"
ON public.twitter_alpha_tracker_config
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own twitter alpha tracker config"
ON public.twitter_alpha_tracker_config
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own twitter alpha tracker config"
ON public.twitter_alpha_tracker_config
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own twitter alpha tracker config"
ON public.twitter_alpha_tracker_config
FOR DELETE
USING (auth.uid() = user_id);

-- Create table for processed posts (deduplication)
CREATE TABLE public.twitter_alpha_processed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tweet_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tweet_id)
);

-- Enable RLS
ALTER TABLE public.twitter_alpha_processed_posts ENABLE ROW LEVEL SECURITY;

-- RLS policies for twitter_alpha_processed_posts
CREATE POLICY "Users can view their own processed posts"
ON public.twitter_alpha_processed_posts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own processed posts"
ON public.twitter_alpha_processed_posts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own processed posts"
ON public.twitter_alpha_processed_posts
FOR DELETE
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_twitter_alpha_tracker_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_twitter_alpha_tracker_config_updated_at
BEFORE UPDATE ON public.twitter_alpha_tracker_config
FOR EACH ROW
EXECUTE FUNCTION public.update_twitter_alpha_tracker_updated_at();