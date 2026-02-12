
-- Fireflies Automation Config
CREATE TABLE public.fireflies_automation_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  webhook_token TEXT UNIQUE,
  webhook_secret TEXT,
  transcripts_saved INTEGER NOT NULL DEFAULT 0,
  last_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fireflies_automation_config_user_id_key UNIQUE (user_id)
);

-- Fireflies Processed Transcripts (idempotency)
CREATE TABLE public.fireflies_processed_transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fireflies_transcript_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fireflies_processed_unique UNIQUE (user_id, fireflies_transcript_id)
);

-- RLS
ALTER TABLE public.fireflies_automation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fireflies_processed_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fireflies config"
  ON public.fireflies_automation_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fireflies config"
  ON public.fireflies_automation_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fireflies config"
  ON public.fireflies_automation_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own processed transcripts"
  ON public.fireflies_processed_transcripts FOR SELECT
  USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_fireflies_automation_config_updated_at
  BEFORE UPDATE ON public.fireflies_automation_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
