
-- Birthday reminder config table
CREATE TABLE public.birthday_reminder_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  days_before integer NOT NULL DEFAULT 7,
  reminders_sent integer NOT NULL DEFAULT 0,
  last_checked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.birthday_reminder_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own birthday config"
  ON public.birthday_reminder_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own birthday config"
  ON public.birthday_reminder_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own birthday config"
  ON public.birthday_reminder_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_birthday_reminder_config_updated_at
  BEFORE UPDATE ON public.birthday_reminder_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Birthday reminders sent (dedup) table
CREATE TABLE public.birthday_reminders_sent (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  person_name text NOT NULL,
  birthday_date text,
  year_sent integer NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, person_name, year_sent)
);

ALTER TABLE public.birthday_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sent reminders"
  ON public.birthday_reminders_sent FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sent reminders"
  ON public.birthday_reminders_sent FOR INSERT
  WITH CHECK (auth.uid() = user_id);
