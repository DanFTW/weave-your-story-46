

## Plan

Two changes in `ActiveMonitoring.tsx`:

### 1. Expand `allowedMetrics` and enforce display order
Update the `parseInsightsData` function to accept 6 metrics and return them in a fixed order:

```
Reach, Follower Count, Impressions, Views, Comments, Likes
```

Map keys: `reach` → "Reach", `follower_count` → "Follower Count", `impressions` → "Impressions", `views` → "Views", `comments` → "Comments", `likes` → "Likes". Use an ordered array of keys to sort the output.

### 2. Change grid to single column
Line 177: change `grid grid-cols-2 gap-2` to `flex flex-col gap-1` so each metric stacks vertically on its own row.

