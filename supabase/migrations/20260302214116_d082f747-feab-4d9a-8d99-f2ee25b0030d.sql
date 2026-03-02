
SELECT cron.schedule(
  'birthday-reminder-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yatadupadielakuenxui.supabase.co/functions/v1/birthday-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhdGFkdXBhZGllbGFrdWVueHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Nzg1NzksImV4cCI6MjA4NDE1NDU3OX0.G6MyJfGjhzfTVEzJA5OVSNY4c41oWGhDUf__mJ5-g9Y"}'::jsonb,
    body := '{"action": "cron-poll"}'::jsonb
  ) AS request_id;
  $$
);
