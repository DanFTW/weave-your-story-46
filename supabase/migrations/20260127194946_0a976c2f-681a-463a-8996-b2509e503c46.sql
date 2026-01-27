-- Create HubSpot automation config table
CREATE TABLE public.hubspot_automation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  monitor_new_contacts BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT false,
  trigger_id TEXT,
  contacts_tracked INTEGER DEFAULT 0,
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.hubspot_automation_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own config"
  ON public.hubspot_automation_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own config"
  ON public.hubspot_automation_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own config"
  ON public.hubspot_automation_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own config"
  ON public.hubspot_automation_config FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_hubspot_automation_config_updated_at
  BEFORE UPDATE ON public.hubspot_automation_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Processed contacts table for deduplication
CREATE TABLE public.hubspot_processed_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  hubspot_contact_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, hubspot_contact_id)
);

-- Enable RLS
ALTER TABLE public.hubspot_processed_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own processed contacts"
  ON public.hubspot_processed_contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own processed contacts"
  ON public.hubspot_processed_contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own processed contacts"
  ON public.hubspot_processed_contacts FOR DELETE
  USING (auth.uid() = user_id);