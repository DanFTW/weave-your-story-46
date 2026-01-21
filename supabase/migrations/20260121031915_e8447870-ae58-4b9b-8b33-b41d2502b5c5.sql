-- Store Instagram automation configuration per user
CREATE TABLE IF NOT EXISTS public.instagram_automation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  monitor_new_posts BOOLEAN DEFAULT true,
  monitor_comments BOOLEAN DEFAULT true,
  monitor_likes BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT false,
  poll_interval_minutes INTEGER DEFAULT 15,
  last_polled_at TIMESTAMPTZ,
  posts_tracked INTEGER DEFAULT 0,
  comments_tracked INTEGER DEFAULT 0,
  likes_tracked INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Track processed engagement to avoid duplicates
CREATE TABLE IF NOT EXISTS public.instagram_processed_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  engagement_type TEXT NOT NULL,
  instagram_item_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, engagement_type, instagram_item_id)
);

-- Enable RLS
ALTER TABLE public.instagram_automation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_processed_engagement ENABLE ROW LEVEL SECURITY;

-- Policies for automation config
CREATE POLICY "Users can view their own automation config"
  ON public.instagram_automation_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own automation config"
  ON public.instagram_automation_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own automation config"
  ON public.instagram_automation_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own automation config"
  ON public.instagram_automation_config FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for processed engagement
CREATE POLICY "Users can view their own processed engagement"
  ON public.instagram_processed_engagement FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own processed engagement"
  ON public.instagram_processed_engagement FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own processed engagement"
  ON public.instagram_processed_engagement FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_instagram_automation_config_updated_at
  BEFORE UPDATE ON public.instagram_automation_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();