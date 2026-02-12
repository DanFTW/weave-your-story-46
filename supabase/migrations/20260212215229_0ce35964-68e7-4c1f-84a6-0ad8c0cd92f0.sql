
-- Google Drive Document Tracker tables

CREATE TABLE public.googledrive_automation_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  trigger_instance_id TEXT,
  documents_saved INTEGER NOT NULL DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_webhook_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.googledrive_automation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own googledrive config"
  ON public.googledrive_automation_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own googledrive config"
  ON public.googledrive_automation_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own googledrive config"
  ON public.googledrive_automation_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_googledrive_automation_config_updated_at
  BEFORE UPDATE ON public.googledrive_automation_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Processed documents deduplication table

CREATE TABLE public.googledrive_processed_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  googledrive_file_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, googledrive_file_id)
);

ALTER TABLE public.googledrive_processed_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own processed documents"
  ON public.googledrive_processed_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own processed documents"
  ON public.googledrive_processed_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);
