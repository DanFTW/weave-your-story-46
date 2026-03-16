

## Problem

The ActiveMonitoring page shows "1 insight collected" but has no history feed showing when insights were collected. The `instagram_analytics_processed` table has `dedupe_key` (format: `insights_YYYY-MM-DD`) and `created_at` for each collection event — enough to build a history list.

## Plan

**File: `src/components/flows/instagram-analytics/ActiveMonitoring.tsx`** (only file modified)

1. **Import `supabase` client and add state** for fetched history items and a loading flag.

2. **Add `useEffect`** that queries `instagram_analytics_processed` for the current user, ordered by `created_at` descending, limit 50. Each row gives us the date the insight was collected (`dedupe_key` contains the date, `created_at` has the exact timestamp).

3. **Add a "Collection History" section** below the monitoring card and above the action buttons:
   - Card with header "Collection History" and item count badge
   - List of collected insight entries, each showing:
     - A calendar/activity icon
     - "Instagram Insights" label
     - The date extracted from `dedupe_key` (e.g., "March 16, 2026")
     - Relative timestamp from `created_at` (e.g., "2 hours ago")
   - Empty state: "No insights collected yet" if list is empty
   - Loading spinner while fetching

This follows the existing card styling patterns already used in the component (bg-card, rounded-xl, border-border).

