
-- Create memory_shares table
CREATE TABLE public.memory_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid NOT NULL,
  memory_id text NOT NULL,
  share_scope text NOT NULL DEFAULT 'single' CHECK (share_scope IN ('single', 'thread', 'custom')),
  share_token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  custom_condition text NULL,
  thread_tag text NULL,
  expires_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create memory_share_recipients table
CREATE TABLE public.memory_share_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id uuid NOT NULL REFERENCES public.memory_shares(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_user_id uuid NULL,
  viewed_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.memory_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_share_recipients ENABLE ROW LEVEL SECURITY;

-- RLS policies for memory_shares
CREATE POLICY "Owners can select their own shares"
  ON public.memory_shares FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners can insert their own shares"
  ON public.memory_shares FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Owners can delete their own shares"
  ON public.memory_shares FOR DELETE
  USING (auth.uid() = owner_user_id);

-- RLS policies for memory_share_recipients
-- Owners can manage recipients via their share
CREATE POLICY "Owners can select recipients of their shares"
  ON public.memory_share_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memory_shares ms
      WHERE ms.id = share_id AND ms.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can insert recipients for their shares"
  ON public.memory_share_recipients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memory_shares ms
      WHERE ms.id = share_id AND ms.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete recipients of their shares"
  ON public.memory_share_recipients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.memory_shares ms
      WHERE ms.id = share_id AND ms.owner_user_id = auth.uid()
    )
  );

-- Index for fast token lookups
CREATE INDEX idx_memory_shares_token ON public.memory_shares(share_token);
-- Index for owner lookups
CREATE INDEX idx_memory_shares_owner ON public.memory_shares(owner_user_id);
-- Index for share_id on recipients
CREATE INDEX idx_memory_share_recipients_share_id ON public.memory_share_recipients(share_id);
