
-- Enable pg_cron and pg_net (if not already enabled)
-- pg_cron may already be enabled, so use IF NOT EXISTS
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
