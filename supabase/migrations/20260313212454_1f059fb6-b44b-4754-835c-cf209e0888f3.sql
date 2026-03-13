ALTER TABLE slack_messages_config
  ADD COLUMN trigger_word text DEFAULT null,
  ADD COLUMN trigger_word_enabled boolean DEFAULT false;