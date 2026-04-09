CREATE POLICY "Users can delete their own processed receipts"
ON public.email_receipt_sheet_processed
FOR DELETE TO authenticated
USING (auth.uid() = user_id);