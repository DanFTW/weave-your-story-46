-- Create junction table for tracking multiple Twitter accounts per user
CREATE TABLE public.twitter_alpha_tracked_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  user_id_twitter TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  posts_tracked INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_tracked_account UNIQUE (user_id, username)
);

-- Enable RLS
ALTER TABLE public.twitter_alpha_tracked_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own tracked accounts"
  ON public.twitter_alpha_tracked_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tracked accounts"
  ON public.twitter_alpha_tracked_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tracked accounts"
  ON public.twitter_alpha_tracked_accounts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tracked accounts"
  ON public.twitter_alpha_tracked_accounts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updating updated_at
CREATE TRIGGER update_twitter_alpha_tracked_accounts_updated_at
  BEFORE UPDATE ON public.twitter_alpha_tracked_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing single-account data to new table
INSERT INTO public.twitter_alpha_tracked_accounts (user_id, username, user_id_twitter, display_name, avatar_url, posts_tracked, created_at)
SELECT 
  user_id,
  tracked_username,
  tracked_user_id,
  tracked_display_name,
  tracked_avatar_url,
  posts_tracked,
  created_at
FROM public.twitter_alpha_tracker_config
WHERE tracked_username IS NOT NULL AND tracked_user_id IS NOT NULL;