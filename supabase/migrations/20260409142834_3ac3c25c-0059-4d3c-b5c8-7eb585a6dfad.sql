ALTER TABLE public.bill_due_reminder_processed
  ADD COLUMN reminder_7d_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN reminder_1d_sent boolean NOT NULL DEFAULT false;

-- Allow service role (edge functions) to update reminder flags
CREATE POLICY "Users can update their own processed bills"
ON public.bill_due_reminder_processed
FOR UPDATE
USING (auth.uid() = user_id);