-- Create linkedin_extension_events table for audit trail
CREATE TABLE public.linkedin_extension_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_url TEXT NOT NULL,
  public_identifier TEXT,
  full_name TEXT,
  headline TEXT,
  company TEXT,
  location TEXT,
  avatar_url TEXT,
  occurred_at TIMESTAMPTZ,
  status TEXT DEFAULT 'received',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_linkedin_ext_events_user ON public.linkedin_extension_events(user_id);
CREATE INDEX idx_linkedin_ext_events_profile ON public.linkedin_extension_events(user_id, profile_url);
CREATE INDEX idx_linkedin_ext_events_created ON public.linkedin_extension_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.linkedin_extension_events ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only see their own events
CREATE POLICY "Users can view their own extension events"
ON public.linkedin_extension_events
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own extension events"
ON public.linkedin_extension_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add new columns to linkedin_automation_config for extension tracking
ALTER TABLE public.linkedin_automation_config 
ADD COLUMN IF NOT EXISTS extension_last_event_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS extension_enabled BOOLEAN DEFAULT false;