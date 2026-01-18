-- Create email_automation_contacts table for storing monitored contacts
CREATE TABLE public.email_automation_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email_address TEXT NOT NULL,
  contact_name TEXT,
  monitor_incoming BOOLEAN DEFAULT true,
  monitor_outgoing BOOLEAN DEFAULT true,
  incoming_trigger_id TEXT,
  outgoing_trigger_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create unique constraint for user + email combination
CREATE UNIQUE INDEX email_automation_contacts_user_email_idx 
ON public.email_automation_contacts(user_id, email_address);

-- Enable Row Level Security
ALTER TABLE public.email_automation_contacts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own monitored contacts"
ON public.email_automation_contacts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monitored contacts"
ON public.email_automation_contacts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monitored contacts"
ON public.email_automation_contacts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own monitored contacts"
ON public.email_automation_contacts
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_email_automation_contacts_updated_at
BEFORE UPDATE ON public.email_automation_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();