-- Create table for LinkedIn automation configuration
CREATE TABLE public.linkedin_automation_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  monitor_new_connections BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT false,
  last_polled_at TIMESTAMP WITH TIME ZONE,
  connections_tracked INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.linkedin_automation_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own linkedin automation config" 
ON public.linkedin_automation_config 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own linkedin automation config" 
ON public.linkedin_automation_config 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own linkedin automation config" 
ON public.linkedin_automation_config 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own linkedin automation config" 
ON public.linkedin_automation_config 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create table for tracking processed LinkedIn connections (deduplication)
CREATE TABLE public.linkedin_processed_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  linkedin_connection_id TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.linkedin_processed_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own processed connections" 
ON public.linkedin_processed_connections 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own processed connections" 
ON public.linkedin_processed_connections 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own processed connections" 
ON public.linkedin_processed_connections 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create unique index for deduplication
CREATE UNIQUE INDEX idx_linkedin_processed_connections_unique 
ON public.linkedin_processed_connections (user_id, linkedin_connection_id);