
-- Fix infinite recursion in memory_shares RLS policies.
-- The recursion occurs when a policy on memory_share_recipients tries to
-- JOIN back to memory_shares, which itself has a policy referencing
-- memory_share_recipients — creating a cycle.
-- 
-- Strategy: drop all existing policies on both tables and rewrite them
-- using security-definer functions where needed to break the cycle.

-- ── 1. Drop all existing policies ────────────────────────────────────────────

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('memory_shares', 'memory_share_recipients')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ── 2. memory_shares policies ─────────────────────────────────────────────────
-- Owners can do everything on their own shares.
-- No cross-table reference here — keeps it cycle-free.

ALTER TABLE public.memory_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memory_shares_owner_all"
ON public.memory_shares
FOR ALL
USING (auth.uid() = owner_user_id)
WITH CHECK (auth.uid() = owner_user_id);

-- ── 3. memory_share_recipients policies ──────────────────────────────────────
-- Recipients can view rows where their email or user_id matches.
-- Owners can view/insert/delete all recipients for their own shares
-- — resolved via a security-definer helper to avoid the recursion cycle.

ALTER TABLE public.memory_share_recipients ENABLE ROW LEVEL SECURITY;

-- Helper function: returns true if the current user owns the given share_id.
-- SECURITY DEFINER breaks the RLS cycle by running as the function owner.
CREATE OR REPLACE FUNCTION public.user_owns_share(p_share_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memory_shares
    WHERE id = p_share_id
      AND owner_user_id = auth.uid()
  );
$$;

-- Recipients can see their own recipient rows
CREATE POLICY "msr_recipient_select"
ON public.memory_share_recipients
FOR SELECT
USING (
  recipient_user_id = auth.uid()
  OR recipient_email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
  OR public.user_owns_share(share_id)
);

-- Only the share owner can insert recipients
CREATE POLICY "msr_owner_insert"
ON public.memory_share_recipients
FOR INSERT
WITH CHECK (public.user_owns_share(share_id));

-- Only the share owner can delete recipients
CREATE POLICY "msr_owner_delete"
ON public.memory_share_recipients
FOR DELETE
USING (public.user_owns_share(share_id));

-- Allow update (e.g. marking viewed_at) for recipient or owner
CREATE POLICY "msr_update"
ON public.memory_share_recipients
FOR UPDATE
USING (
  recipient_user_id = auth.uid()
  OR public.user_owns_share(share_id)
);
