

## Fix: Manually Added Interests Not Surviving Sync

### Problem

When a user adds an interest tag manually and then presses the sync/refresh button, the new tag may not appear in the list because:

1. **`syncNewInterestTag` is fire-and-forget** — `handleAddTag` calls it without `await`, so the LIAM save may not have completed when the sync button fetches from LIAM. While the local state merge *should* preserve the tag via `prev =>`, there's a second issue:

2. **`filterRemoved` is a stale closure** — `refreshFromMemories` has `[onPrefill, location]` as its dependency array but uses `filterRemoved` from the closure. Since `filterRemoved` isn't listed as a dependency, React may serve a stale version that still considers the just-undone tag as "removed," causing it to be filtered from the LIAM results. Combined with any subtle state timing, this could cause the tag to not appear.

3. **No persistence until activation** — manually added tags live only in component-local state. If the component remounts for any reason before activation, they're lost because `config.interests` in the DB hasn't been updated.

### Fix

Two changes in `src/components/flows/weekly-event-finder/EventFinderConfig.tsx`:

**1. Make `handleAddTag` async and await `syncNewInterestTag`**
Ensures the LIAM save completes before the user can sync, so the tag is guaranteed to be in LIAM when prefill fetches.

```typescript
const handleAddTag = async (tag: string) => {
  const cleaned = cleanInterestTag(tag);
  if (!cleaned) return;
  if (interestTags.some(t => t.toLowerCase() === cleaned.toLowerCase())) return;
  setInterestTags(prev => [...prev, cleaned]);
  undoRemoval(cleaned);
  await syncNewInterestTag(cleaned);
};
```

**2. Add `filterRemoved` to `refreshFromMemories` dependency array**
Fixes the stale closure so the function always uses the current removed-tags set.

```typescript
}, [onPrefill, location, filterRemoved]);
```

### Files to update

| File | Change |
|---|---|
| `src/components/flows/weekly-event-finder/EventFinderConfig.tsx` | Make `handleAddTag` async + await `syncNewInterestTag`; add `filterRemoved` to `refreshFromMemories` deps |

