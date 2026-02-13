
-- Create discord_automation_config table
CREATE TABLE public.discord_automation_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  server_id TEXT,
  server_name TEXT,
  channel_id TEXT,
  channel_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  trigger_instance_id TEXT,
  connected_account_id TEXT,
  messages_tracked INTEGER NOT NULL DEFAULT 0,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.discord_automation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own discord config"
  ON public.discord_automation_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own discord config"
  ON public.discord_automation_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own discord config"
  ON public.discord_automation_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_discord_automation_config_updated_at
  BEFORE UPDATE ON public.discord_automation_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create discord_processed_messages table
CREATE TABLE public.discord_processed_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  discord_message_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, discord_message_id)
);

ALTER TABLE public.discord_processed_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own processed messages"
  ON public.discord_processed_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own processed messages"
  ON public.discord_processed_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);
