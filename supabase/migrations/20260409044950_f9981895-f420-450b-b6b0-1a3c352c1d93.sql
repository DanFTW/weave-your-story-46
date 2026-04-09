
-- Add metadata columns to email_text_alert_processed
ALTER TABLE public.email_text_alert_processed
ADD COLUMN sender_email text,
ADD COLUMN subject text;

-- Add DELETE policy for authenticated users
CREATE POLICY "Users can delete their own processed text alerts"
ON public.email_text_alert_processed
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
