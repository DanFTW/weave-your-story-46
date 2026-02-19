
-- Allow recipients to see share recipients rows where their email or user_id matches
CREATE POLICY "Recipients can view shares addressed to them"
ON public.memory_share_recipients
FOR SELECT
USING (
  recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR recipient_user_id = auth.uid()
);

-- Allow recipients to see the parent memory_shares row
CREATE POLICY "Recipients can view shares shared with them"
ON public.memory_shares
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.memory_share_recipients msr
    WHERE msr.share_id = memory_shares.id
    AND (
      msr.recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      OR msr.recipient_user_id = auth.uid()
    )
  )
);

-- Allow authenticated users to read other profiles (for sharer name display)
CREATE POLICY "Authenticated users can view any profile"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);
