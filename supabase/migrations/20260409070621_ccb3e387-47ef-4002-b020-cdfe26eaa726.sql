
-- bill_due_reminder_config
CREATE TABLE public.bill_due_reminder_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  bills_found INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bill_due_reminder_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bill due reminder config"
  ON public.bill_due_reminder_config FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bill due reminder config"
  ON public.bill_due_reminder_config FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bill due reminder config"
  ON public.bill_due_reminder_config FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bill due reminder config"
  ON public.bill_due_reminder_config FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_bill_due_reminder_config_updated_at
  BEFORE UPDATE ON public.bill_due_reminder_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- bill_due_reminder_processed
CREATE TABLE public.bill_due_reminder_processed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email_message_id TEXT NOT NULL,
  biller_name TEXT,
  amount_due TEXT,
  due_date TEXT,
  subject TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, email_message_id)
);

ALTER TABLE public.bill_due_reminder_processed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own processed bills"
  ON public.bill_due_reminder_processed FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own processed bills"
  ON public.bill_due_reminder_processed FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own processed bills"
  ON public.bill_due_reminder_processed FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
