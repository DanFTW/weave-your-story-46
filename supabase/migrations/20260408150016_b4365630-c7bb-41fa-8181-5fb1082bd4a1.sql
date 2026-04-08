-- Add DELETE policies to 16 config tables missing them

CREATE POLICY "Users can delete own birthday config"
ON public.birthday_reminder_config FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar sync config"
ON public.calendar_event_sync_config FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own coinbase config"
ON public.coinbase_trades_config FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email receipt sheet config"
ON public.email_receipt_sheet_config FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email text alert config"
ON public.email_text_alert_config FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own facebook page posts config"
ON public.facebook_page_posts_config FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fireflies config"
ON public.fireflies_automation_config FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own googledrive config"
ON public.googledrive_automation_config FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own grocery config"
ON public.grocery_sheet_config FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own instagram analytics config"
ON public.instagram_analytics_config FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
ON public.profiles FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own restaurant bookmark config"
ON public.restaurant_bookmark_config FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own spotify config"
ON public.spotify_music_finder_config FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own todoist config"
ON public.todoist_automation_config FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own api keys"
ON public.user_api_keys FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weekly event finder config"
ON public.weekly_event_finder_config FOR DELETE
TO authenticated USING (auth.uid() = user_id);