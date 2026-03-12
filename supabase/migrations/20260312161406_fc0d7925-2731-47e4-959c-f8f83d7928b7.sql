CREATE POLICY "Users can update their own synced posts"
ON public.instagram_synced_posts
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);