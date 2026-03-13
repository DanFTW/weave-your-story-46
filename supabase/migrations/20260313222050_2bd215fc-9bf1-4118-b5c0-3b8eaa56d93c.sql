ALTER TABLE discord_automation_config
  ADD COLUMN trigger_word text DEFAULT null,
  ADD COLUMN trigger_word_enabled boolean DEFAULT false;

ALTER TABLE discord_processed_messages
  ADD COLUMN message_content text DEFAULT null,
  ADD COLUMN author_name text DEFAULT null;