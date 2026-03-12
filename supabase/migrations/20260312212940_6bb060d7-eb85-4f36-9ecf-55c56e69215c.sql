
-- Slack messages config table
CREATE TABLE public.slack_messages_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  search_mode boolean NOT NULL DEFAULT false,
  selected_workspace_ids text[],
  selected_channel_ids text[],
  messages_imported integer NOT NULL DEFAULT 0,
  last_polled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.slack_messages_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own slack messages config"
  ON public.slack_messages_config FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own slack messages config"
  ON public.slack_messages_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own slack messages config"
  ON public.slack_messages_config FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_slack_messages_config_updated_at
  BEFORE UPDATE ON public.slack_messages_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Slack processed messages dedup table
CREATE TABLE public.slack_processed_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slack_message_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slack_message_id)
);

ALTER TABLE public.slack_processed_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own slack processed messages"
  ON public.slack_processed_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own slack processed messages"
  ON public.slack_processed_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
