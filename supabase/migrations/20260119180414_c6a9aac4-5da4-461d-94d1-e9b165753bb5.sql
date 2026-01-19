-- Create table to track synced Instagram posts (prevents duplicates)
CREATE TABLE instagram_synced_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instagram_post_id TEXT NOT NULL,
  memory_id TEXT,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(user_id, instagram_post_id)
);

-- Enable RLS
ALTER TABLE instagram_synced_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own synced posts"
  ON instagram_synced_posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own synced posts"
  ON instagram_synced_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own synced posts"
  ON instagram_synced_posts FOR DELETE
  USING (auth.uid() = user_id);