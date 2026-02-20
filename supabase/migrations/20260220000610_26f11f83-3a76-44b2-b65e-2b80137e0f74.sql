ALTER TABLE public.memory_share_recipients 
ADD CONSTRAINT memory_share_recipients_share_id_recipient_email_key 
UNIQUE (share_id, recipient_email);