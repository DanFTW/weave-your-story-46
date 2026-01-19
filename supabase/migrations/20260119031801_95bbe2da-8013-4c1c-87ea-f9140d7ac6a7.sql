-- Create Instagram sync configuration table
CREATE TABLE public.instagram_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  sync_posts BOOLEAN NOT NULL DEFAULT true,
  sync_comments BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_synced_post_id TEXT,
  posts_synced_count INTEGER NOT NULL DEFAULT 0,
  memories_created_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint on user_id
ALTER TABLE public.instagram_sync_config ADD CONSTRAINT instagram_sync_config_user_id_key UNIQUE (user_id);

-- Enable RLS
ALTER TABLE public.instagram_sync_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own instagram sync config"
ON public.instagram_sync_config
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own instagram sync config"
ON public.instagram_sync_config
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own instagram sync config"
ON public.instagram_sync_config
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own instagram sync config"
ON public.instagram_sync_config
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_instagram_sync_config_updated_at
BEFORE UPDATE ON public.instagram_sync_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();