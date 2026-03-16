

## Problem

All 5 rows in `instagram_analytics_processed` have `insights_data = NULL` because they were inserted before the edge function was updated to persist metrics. The dedup logic prevents re-collection for today's date, so even after the fix, no new data gets written — the function just says "Already collected for today, skipping."

The UI code in `ActiveMonitoring.tsx` is correctly parsing and rendering `insights_data`, but there's nothing to display because all values are NULL.

## Fix — Two Changes

### 1. Edge function: backfill `insights_data` on dedup hit

When the dedup check finds an existing row **with NULL `insights_data`**, treat it as incomplete — fetch insights and UPDATE the row instead of skipping entirely. This way, the next "Check Now" click will populate the missing data for today's row.

**File: `supabase/functions/instagram-analytics-poll/index.ts`**

In `pollInstagramInsights`, change the dedup logic (around lines 189-199):
- If `existing` row found AND `existing.insights_data` is not null → skip as before
- If `existing` row found AND `existing.insights_data` is null → fetch insights, UPDATE the row with `insights_data`, still return `newInsights: 0` (no new memory created since the memory was already sent)

This ensures all historical NULL rows get backfilled on the next poll cycle.

### 2. Redeploy the edge function

Deploy `instagram-analytics-poll` so the backfill logic takes effect.

No changes needed to `ActiveMonitoring.tsx` — the UI code already correctly fetches `insights_data`, parses it with `parseInsightsData`, and renders metrics in a grid. It will work as soon as the data exists.

