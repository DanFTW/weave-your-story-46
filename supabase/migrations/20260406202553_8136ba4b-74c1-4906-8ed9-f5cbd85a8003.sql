
-- email_receipt_sheet_config
CREATE TABLE public.email_receipt_sheet_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  spreadsheet_id text,
  spreadsheet_name text,
  sheet_name text DEFAULT 'Sheet1',
  rows_posted integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_receipt_sheet_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email receipt sheet config"
  ON public.email_receipt_sheet_config FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email receipt sheet config"
  ON public.email_receipt_sheet_config FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email receipt sheet config"
  ON public.email_receipt_sheet_config FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- email_receipt_sheet_processed
CREATE TABLE public.email_receipt_sheet_processed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_message_id text NOT NULL,
  vendor text,
  amount text,
  date_str text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email_message_id)
);

ALTER TABLE public.email_receipt_sheet_processed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own processed receipts"
  ON public.email_receipt_sheet_processed FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own processed receipts"
  ON public.email_receipt_sheet_processed FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at on config table
CREATE TRIGGER update_email_receipt_sheet_config_updated_at
  BEFORE UPDATE ON public.email_receipt_sheet_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
