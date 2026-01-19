-- Create twitter_sync_config table
CREATE TABLE public.twitter_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  sync_tweets BOOLEAN NOT NULL DEFAULT true,
  sync_retweets BOOLEAN NOT NULL DEFAULT true,
  sync_replies BOOLEAN NOT NULL DEFAULT true,
  sync_likes BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_synced_tweet_id TEXT,
  tweets_synced_count INTEGER NOT NULL DEFAULT 0,
  memories_created_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.twitter_sync_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for twitter_sync_config
CREATE POLICY "Users can view their own twitter sync config"
ON public.twitter_sync_config FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own twitter sync config"
ON public.twitter_sync_config FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own twitter sync config"
ON public.twitter_sync_config FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own twitter sync config"
ON public.twitter_sync_config FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_twitter_sync_config_updated_at
BEFORE UPDATE ON public.twitter_sync_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create twitter_synced_posts table for deduplication
CREATE TABLE public.twitter_synced_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  twitter_post_id TEXT NOT NULL,
  memory_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, twitter_post_id)
);

-- Enable RLS
ALTER TABLE public.twitter_synced_posts ENABLE ROW LEVEL SECURITY;

-- RLS policies for twitter_synced_posts
CREATE POLICY "Users can view their own synced tweets"
ON public.twitter_synced_posts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own synced tweets"
ON public.twitter_synced_posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own synced tweets"
ON public.twitter_synced_posts FOR DELETE
USING (auth.uid() = user_id);