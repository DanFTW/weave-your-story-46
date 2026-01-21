-- Create twitter_automation_config table
CREATE TABLE public.twitter_automation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  monitor_new_posts BOOLEAN DEFAULT true,
  monitor_replies BOOLEAN DEFAULT true,
  monitor_retweets BOOLEAN DEFAULT true,
  monitor_likes BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT false,
  last_polled_at TIMESTAMP WITH TIME ZONE,
  posts_tracked INTEGER DEFAULT 0,
  replies_tracked INTEGER DEFAULT 0,
  retweets_tracked INTEGER DEFAULT 0,
  likes_tracked INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.twitter_automation_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own twitter automation config" 
  ON public.twitter_automation_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own twitter automation config" 
  ON public.twitter_automation_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own twitter automation config" 
  ON public.twitter_automation_config FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own twitter automation config" 
  ON public.twitter_automation_config FOR DELETE USING (auth.uid() = user_id);

-- Create twitter_processed_engagement table for deduplication
CREATE TABLE public.twitter_processed_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  twitter_item_id TEXT NOT NULL,
  engagement_type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, twitter_item_id, engagement_type)
);

-- Enable RLS
ALTER TABLE public.twitter_processed_engagement ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own twitter processed engagement" 
  ON public.twitter_processed_engagement FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own twitter processed engagement" 
  ON public.twitter_processed_engagement FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own twitter processed engagement" 
  ON public.twitter_processed_engagement FOR DELETE USING (auth.uid() = user_id);

-- Add updated_at trigger to twitter_automation_config
CREATE TRIGGER update_twitter_automation_config_updated_at
  BEFORE UPDATE ON public.twitter_automation_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();