-- Create table to store user integration connections
CREATE TABLE public.user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id TEXT NOT NULL,
  composio_connection_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  account_name TEXT,
  account_email TEXT,
  account_avatar_url TEXT,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, integration_id)
);

-- Enable RLS
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- Users can only view their own integrations
CREATE POLICY "Users can view own integrations"
  ON public.user_integrations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own integrations
CREATE POLICY "Users can insert own integrations"
  ON public.user_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own integrations
CREATE POLICY "Users can update own integrations"
  ON public.user_integrations FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own integrations
CREATE POLICY "Users can delete own integrations"
  ON public.user_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_integrations_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();