
CREATE TABLE public.facebook_page_posts_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  posts_synced integer NOT NULL DEFAULT 0,
  last_polled_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.facebook_page_posts_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own facebook page posts config"
  ON public.facebook_page_posts_config FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own facebook page posts config"
  ON public.facebook_page_posts_config FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own facebook page posts config"
  ON public.facebook_page_posts_config FOR UPDATE
  TO public
  USING (auth.uid() = user_id);

CREATE TRIGGER update_facebook_page_posts_config_updated_at
  BEFORE UPDATE ON public.facebook_page_posts_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
