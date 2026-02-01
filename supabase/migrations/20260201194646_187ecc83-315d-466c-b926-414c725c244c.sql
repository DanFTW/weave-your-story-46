-- Create table to store full Instagram post content for reliable 1:1 display
-- (LIAM API tokenizes content into semantic fragments, so we need local storage)
CREATE TABLE public.instagram_synced_post_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram_post_id TEXT NOT NULL,
  caption TEXT,
  media_type TEXT,
  media_url TEXT,
  permalink_url TEXT,
  username TEXT,
  likes_count INTEGER,
  comments_count INTEGER,
  posted_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, instagram_post_id)
);

-- Index for efficient querying by user and ordering by sync time
CREATE INDEX idx_instagram_content_user_synced 
  ON public.instagram_synced_post_content(user_id, synced_at DESC);

-- Index for ordering by original post date
CREATE INDEX idx_instagram_content_user_posted 
  ON public.instagram_synced_post_content(user_id, posted_at DESC);

-- Enable Row Level Security
ALTER TABLE public.instagram_synced_post_content ENABLE ROW LEVEL SECURITY;

-- Users can read their own Instagram posts
CREATE POLICY "Users can read own Instagram post content"
  ON public.instagram_synced_post_content FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own posts (via edge function with service role)
CREATE POLICY "Users can insert own Instagram post content"
  ON public.instagram_synced_post_content FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own posts (for reset functionality)
CREATE POLICY "Users can delete own Instagram post content"
  ON public.instagram_synced_post_content FOR DELETE
  USING (auth.uid() = user_id);