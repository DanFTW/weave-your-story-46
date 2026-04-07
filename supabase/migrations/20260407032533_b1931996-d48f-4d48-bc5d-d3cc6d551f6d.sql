
-- email_text_alert_config
CREATE TABLE public.email_text_alert_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  sender_filter text,
  keyword_filter text,
  phone_number text,
  alerts_sent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_text_alert_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email text alert config" ON public.email_text_alert_config FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own email text alert config" ON public.email_text_alert_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own email text alert config" ON public.email_text_alert_config FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_email_text_alert_config_updated_at BEFORE UPDATE ON public.email_text_alert_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- email_text_alert_processed
CREATE TABLE public.email_text_alert_processed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_message_id text NOT NULL,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email_message_id)
);

ALTER TABLE public.email_text_alert_processed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own processed text alerts" ON public.email_text_alert_processed FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own processed text alerts" ON public.email_text_alert_processed FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
