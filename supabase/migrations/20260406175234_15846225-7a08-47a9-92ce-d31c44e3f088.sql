
CREATE TABLE public.spotify_music_finder_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  playlist_id TEXT,
  playlist_name TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily',
  is_active BOOLEAN NOT NULL DEFAULT false,
  songs_added INTEGER NOT NULL DEFAULT 0,
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.spotify_music_finder_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spotify config"
  ON public.spotify_music_finder_config FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own spotify config"
  ON public.spotify_music_finder_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own spotify config"
  ON public.spotify_music_finder_config FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_spotify_music_finder_config_updated_at
  BEFORE UPDATE ON public.spotify_music_finder_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
