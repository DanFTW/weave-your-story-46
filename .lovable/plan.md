

## Fix: Clean All Code Paths Where Interest Tags Enter the UI

### Problem

The `cleanInterestTag` / `parseAndDeduplicateInterestTags` utility exists but two code paths still consume raw `config.interests` without cleaning:

1. **`ActiveMonitoring.tsx` line 50** — displays `config.interests` verbatim as text, so dirty DB values like `"Interests And Hobbies Include Tech, Tech, Making Music, Making Music"` render as-is.
2. **`WeeklyEventFinderFlow.tsx` line 45** — `handleSyncInterests` builds `existingTags` from raw `config.interests`, preserving dirty entries, then merges clean memory tags on top — duplicates survive.

### Fix

Two surgical changes, both under 5 lines each:

| File | Line(s) | Change |
|---|---|---|
| `ActiveMonitoring.tsx` | 49-51 | Clean `config.interests` through `parseAndDeduplicateInterestTags` before display, joining with `", "` |
| `WeeklyEventFinderFlow.tsx` | 45 | Already imports `parseAndDeduplicateInterestTags` — just confirm it's applied to `config.interests` when building `existingTags` (it is, but the result is never re-cleaned after merge; the merged string on line 55 should be run through `parseAndDeduplicateInterestTags` then re-joined to guarantee no dupes survive the round-trip) |

**`ActiveMonitoring.tsx`:**
- Import `parseAndDeduplicateInterestTags` from `@/utils/interestTagUtils`
- Replace `{config.interests || "Not set"}` with `{config.interests ? parseAndDeduplicateInterestTags(config.interests).join(", ") : "Not set"}`

**`WeeklyEventFinderFlow.tsx`:**
- The existing `handleSyncInterests` already calls `parseAndDeduplicateInterestTags` on both `result.interests` and `config.interests`, but the final `merged.join(", ")` could still contain dirty tags from `existingTags` if the DB was written before the utility existed. Wrap the final merge: `const mergedStr = parseAndDeduplicateInterestTags(merged.join(", ")).join(", ")` — this is a safety net that re-cleans the combined output.

No other files need changes. The configure screen already initializes from `parseAndDeduplicateInterestTags(config.interests)` on line 25 of `EventFinderConfig.tsx`.

