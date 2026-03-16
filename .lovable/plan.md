

## Investigation Results

The `instagram_analytics_processed` table only stores four columns: `id`, `user_id`, `dedupe_key`, and `created_at`. **No actual metrics data** (reach, followers, impressions, etc.) is persisted in the database. The edge function fetches insights from the Instagram API and sends them to the LIAM memory API, but discards the raw values without saving them to the DB.

## Required Changes

To display data points in the history entries, we need three changes:

### 1. Database migration — add `insights_data` column
Add a `jsonb` column to `instagram_analytics_processed` to store the raw metrics snapshot:
```sql
ALTER TABLE instagram_analytics_processed
ADD COLUMN insights_data jsonb DEFAULT NULL;
```

### 2. Edge function — persist metrics on poll
In `supabase/functions/instagram-analytics-poll/index.ts`, update the dedup insert to include the insights result:
```typescript
.insert({ user_id: userId, dedupe_key: dedupeKey, insights_data: insightsResult })
```

### 3. Component — display metrics in history entries
In `ActiveMonitoring.tsx`, update the history fetch to include `insights_data` and render each metric (reach, profile_views, follower_count, accounts_engaged) inline on each history card.

**Note:** The constraint "do not modify any other files" conflicts with this requirement — the edge function must be updated to persist the data, and a DB migration is needed. Two files plus a migration are the minimum scope. Shall I proceed with all three changes?

