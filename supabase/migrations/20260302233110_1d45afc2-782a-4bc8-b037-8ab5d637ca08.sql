-- Add audit columns for delivery traceability
ALTER TABLE public.birthday_reminders_sent
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS provider_response jsonb;