-- Create table to store Twitter posts locally for reliable 1:1 retrieval
CREATE TABLE twitter_alpha_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tweet_id TEXT NOT NULL,
  author_username TEXT NOT NULL,
  author_display_name TEXT,
  tweet_text TEXT NOT NULL,
  tweet_created_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tweet_id)
);

-- Enable RLS
ALTER TABLE twitter_alpha_posts ENABLE ROW LEVEL SECURITY;

-- Users can read their own posts
CREATE POLICY "Users can read own twitter posts" ON twitter_alpha_posts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own posts (for edge function with service role, but also direct client)
CREATE POLICY "Users can insert own twitter posts" ON twitter_alpha_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own posts (for reset functionality)
CREATE POLICY "Users can delete own twitter posts" ON twitter_alpha_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for efficient user-based queries
CREATE INDEX idx_twitter_alpha_posts_user_id ON twitter_alpha_posts(user_id);
CREATE INDEX idx_twitter_alpha_posts_created_at ON twitter_alpha_posts(tweet_created_at DESC);