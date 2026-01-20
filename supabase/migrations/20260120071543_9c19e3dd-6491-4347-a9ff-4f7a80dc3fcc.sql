-- Create youtube_sync_config table
CREATE TABLE public.youtube_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  sync_liked_videos BOOLEAN NOT NULL DEFAULT true,
  sync_watch_history BOOLEAN NOT NULL DEFAULT true,
  sync_subscriptions BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  last_synced_video_id TEXT,
  videos_synced_count INTEGER NOT NULL DEFAULT 0,
  memories_created_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.youtube_sync_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for youtube_sync_config
CREATE POLICY "Users can view their own youtube sync config" 
ON public.youtube_sync_config 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own youtube sync config" 
ON public.youtube_sync_config 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own youtube sync config" 
ON public.youtube_sync_config 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own youtube sync config" 
ON public.youtube_sync_config 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_youtube_sync_config_updated_at
BEFORE UPDATE ON public.youtube_sync_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create youtube_synced_posts table for deduplication
CREATE TABLE public.youtube_synced_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  youtube_video_id TEXT NOT NULL,
  memory_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, youtube_video_id)
);

-- Enable RLS
ALTER TABLE public.youtube_synced_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for youtube_synced_posts
CREATE POLICY "Users can view their own synced videos" 
ON public.youtube_synced_posts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own synced videos" 
ON public.youtube_synced_posts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own synced videos" 
ON public.youtube_synced_posts 
FOR DELETE 
USING (auth.uid() = user_id);