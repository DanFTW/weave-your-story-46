-- Create email_automation_contacts table for storing monitored contacts
CREATE TABLE public.email_automation_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email_address TEXT NOT NULL,
  contact_name TEXT,
  monitor_incoming BOOLEAN DEFAULT TRUE,
  monitor_outgoing BOOLEAN DEFAULT TRUE,
  incoming_trigger_id TEXT,
  outgoing_trigger_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, email_address)
);

-- Enable RLS
ALTER TABLE public.email_automation_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own contacts"
  ON public.email_automation_contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contacts"
  ON public.email_automation_contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
  ON public.email_automation_contacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON public.email_automation_contacts FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_email_automation_contacts_updated_at
  BEFORE UPDATE ON public.email_automation_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();