
-- Drop old circular policies on memory_share_recipients
DROP POLICY IF EXISTS "Owners can delete recipients of their shares" ON public.memory_share_recipients;
DROP POLICY IF EXISTS "Owners can insert recipients for their shares" ON public.memory_share_recipients;
DROP POLICY IF EXISTS "Owners can select recipients of their shares" ON public.memory_share_recipients;
DROP POLICY IF EXISTS "Recipients can view shares addressed to them" ON public.memory_share_recipients;

-- Drop old policies on memory_shares (the new migration already added memory_shares_owner_all)
DROP POLICY IF EXISTS "Recipients can view shares shared with them" ON public.memory_shares;
DROP POLICY IF EXISTS "Owners can delete their own shares" ON public.memory_shares;
DROP POLICY IF EXISTS "Owners can insert their own shares" ON public.memory_shares;
DROP POLICY IF EXISTS "Owners can select their own shares" ON public.memory_shares;
