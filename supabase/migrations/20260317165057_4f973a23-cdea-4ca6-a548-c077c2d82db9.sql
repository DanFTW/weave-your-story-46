
-- Add video_title and video_category columns
ALTER TABLE youtube_synced_posts
  ADD COLUMN IF NOT EXISTS video_title text,
  ADD COLUMN IF NOT EXISTS video_category text;

-- Backfill existing rows
UPDATE youtube_synced_posts
SET video_category = CASE
  WHEN youtube_video_id LIKE 'sub_%' THEN 'Subscription'
  ELSE 'Liked Video'
END
WHERE video_category IS NULL;
