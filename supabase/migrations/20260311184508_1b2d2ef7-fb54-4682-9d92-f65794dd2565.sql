ALTER TABLE public.facebook_synced_posts 
ADD COLUMN IF NOT EXISTS permalink_url text,
ADD COLUMN IF NOT EXISTS post_message text;