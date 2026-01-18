-- Add selected_album_ids column to google_photos_sync_config
ALTER TABLE google_photos_sync_config
ADD COLUMN selected_album_ids text[] DEFAULT NULL;