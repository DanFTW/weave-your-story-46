

## Problem

The `insights_data` stored in the DB has this structure:
```
{ data: [ {id, name, title, period, values: [{end_time, value}, ...], description}, ... ], paging: null }
```

The `parseInsightsData` function receives this top-level object and falls into the `typeof data === "object"` branch, which iterates over keys (`data`, `paging`). The `data` key's value is an array of complex metric objects, which gets rendered as raw JSON.

## Fix

**File: `src/components/flows/instagram-analytics/ActiveMonitoring.tsx`** — update `parseInsightsData` only.

1. At the top of `parseInsightsData`, unwrap the `data.data` array if present (the Instagram API wrapper object).
2. Only display metrics whose `name` is in the allowed set: `reach`, `follower_count`, `impressions`.
3. Extract the numeric value from `values[0].value` (the most recent day's value).
4. This ensures only clean labeled values like "Reach: 7" are rendered — no IDs, descriptions, periods, or raw objects.

