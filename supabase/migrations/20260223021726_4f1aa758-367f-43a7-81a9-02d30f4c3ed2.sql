ALTER TABLE public.memory_shares
  ADD COLUMN visibility text NOT NULL DEFAULT 'anyone';