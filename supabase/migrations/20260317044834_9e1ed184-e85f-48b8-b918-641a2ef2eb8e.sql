
CREATE TABLE public.email_automation_processed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_email TEXT NOT NULL,
  sender TEXT,
  subject TEXT,
  snippet TEXT,
  direction TEXT NOT NULL,
  email_message_id TEXT,
  processed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_automation_processed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own processed emails"
ON public.email_automation_processed_emails
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own processed emails"
ON public.email_automation_processed_emails
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_email_processed_user_date ON public.email_automation_processed_emails (user_id, processed_at DESC);
