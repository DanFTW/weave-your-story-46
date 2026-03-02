-- Remove stale 2026 dedup row for Frenboi so the hardened flow can resend
DELETE FROM public.birthday_reminders_sent
WHERE person_name = 'Frenboi' AND year_sent = 2026;