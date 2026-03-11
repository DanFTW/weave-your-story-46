
-- Facebook sync config table
CREATE TABLE public.facebook_sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  sync_posts boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  last_synced_post_id text,
  posts_synced_count integer NOT NULL DEFAULT 0,
  memories_created_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facebook_sync_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own facebook sync config" ON public.facebook_sync_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own facebook sync config" ON public.facebook_sync_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own facebook sync config" ON public.facebook_sync_config FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own facebook sync config" ON public.facebook_sync_config FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_facebook_sync_config_updated_at
  BEFORE UPDATE ON public.facebook_sync_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Facebook synced posts dedup table
CREATE TABLE public.facebook_synced_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  facebook_post_id text NOT NULL,
  memory_id text,
  synced_at timestamptz DEFAULT now(),
  UNIQUE (user_id, facebook_post_id)
);

ALTER TABLE public.facebook_synced_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own facebook synced posts" ON public.facebook_synced_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own facebook synced posts" ON public.facebook_synced_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own facebook synced posts" ON public.facebook_synced_posts FOR DELETE USING (auth.uid() = user_id);
