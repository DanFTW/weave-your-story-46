

## Fix: Duplicate and Malformed Interest Tags

### Root Cause

Two places produce malformed tags:

1. **Server (`fetchLiamMemories`, lines 178-188)**: Steps 3 and 4 push `normalizeTag(text)` where `text` is the *full memory content* (e.g., `"My interests and hobbies include: tech"`). `normalizeTag` only trims and title-cases — it doesn't strip conversational prefixes. Result: `"My Interests And Hobbies Include Tech"` becomes a tag.

2. **Client (`parseInterestsToTags`)**: Only strips one exact prefix (`/my interests and hobbies include:/i`), missing variations. No deduplication after normalization.

### Solution

**A. New client utility** — `src/utils/interestTagUtils.ts`
- `cleanInterestTag(raw: string): string` — strips all known conversational prefixes (case-insensitive), trims, collapses whitespace, title-cases. Rejects results over 60 chars (full sentences, not tags).
- `parseAndDeduplicateInterestTags(raw: string): string[]` — splits on `,` or `;`, runs each through `cleanInterestTag`, filters empties, deduplicates case-insensitively.

Prefixes stripped:
```
my interests and hobbies include:
i love | i enjoy | i like | i'm into | i am into
passionate about | interested in | fan of | obsessed with
hobbies include | interests include
```

**B. Refactor client consumers** — Replace inline `parseInterestsToTags` in `EventFinderConfig.tsx` and `WeeklyEventFinderFlow.tsx` with imports from the new utility.

**C. Fix server** — In `supabase/functions/weekly-event-finder/index.ts`:
- Add a `stripInterestPrefixes(text)` function (same prefix list).
- Steps 3 and 4 in `fetchLiamMemories`: run text through `stripInterestPrefixes` before `normalizeTag`. Discard results over 60 chars after stripping.

### Files Changed

| File | Change |
|---|---|
| `src/utils/interestTagUtils.ts` | **New** — `cleanInterestTag`, `parseAndDeduplicateInterestTags` |
| `src/components/flows/weekly-event-finder/EventFinderConfig.tsx` | Replace inline `parseInterestsToTags` with import from utility |
| `src/components/flows/weekly-event-finder/WeeklyEventFinderFlow.tsx` | Replace inline `parseInterestsToTags` with import from utility |
| `supabase/functions/weekly-event-finder/index.ts` | Add `stripInterestPrefixes`; apply in steps 3/4 of `fetchLiamMemories` + add 60-char cap |

Defense-in-depth: the server produces clean tags, and the client normalizes anything it receives as a safety net.

