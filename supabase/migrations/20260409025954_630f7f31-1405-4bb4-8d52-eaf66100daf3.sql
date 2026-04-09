CREATE POLICY "Users can delete their own processed events"
ON public.weekly_event_finder_processed
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);