

## Auto-refresh interest tags from LIAM memories

### What changes

1. **Always fetch LIAM interests on open** — currently prefill only runs when `config.interests` is empty. Change to always call `onPrefill` and additively merge new LIAM tags into existing tags.
2. **Add manual refresh button** — small `RefreshCw` icon button next to the "Your interests" label.
3. **Additive merge logic** — new tags from LIAM are added without removing user-added tags.

### Technical plan

#### 1. `EventFinderConfig.tsx` — extract refresh logic, always run on mount

Create a `refreshFromMemories` callback that:
- Calls `onPrefill()` to get latest LIAM interests
- Parses result through `parseInterestsToTags`
- Merges additively: adds any tags not already present (case-insensitive dedup)
- Updates `prefillRef` with the latest raw interests

On mount (`useEffect`), always call `refreshFromMemories()` — not just when config is empty. If the config already has interests, initialize tags from config first, then merge LIAM tags on top.

Add a `RefreshCw` icon button next to the "Your interests" label that calls the same `refreshFromMemories`.

Track a separate `isRefreshing` state for the manual button spinner.

```typescript
const refreshFromMemories = useCallback(async () => {
  setIsPrefilling(true);
  try {
    const result = await onPrefill();
    if (!result) return;
    if (result.interests) {
      const memoryTags = parseInterestsToTags(result.interests);
      setInterestTags(prev => {
        const lowerSet = new Set(prev.map(t => t.toLowerCase()));
        const newTags = memoryTags.filter(t => !lowerSet.has(t.toLowerCase()));
        return newTags.length > 0 ? [...prev, ...newTags] : prev;
      });
    }
    if (result.location && !location) setLocation(result.location);
    prefillRef.current = {
      interests: result.interests ?? "",
      location: result.location ?? "",
    };
  } finally {
    setIsPrefilling(false);
  }
}, [onPrefill, location]);
```

#### 2. Refresh button UI

Next to "Your interests" label, add a small `RefreshCw` button matching existing icon button patterns:

```tsx
<label className="flex items-center gap-2 text-sm font-medium text-foreground">
  <Heart className="w-4 h-4 text-muted-foreground" />
  Your interests
  {isPrefilling ? (
    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
  ) : (
    <button onClick={refreshFromMemories} type="button"
      className="ml-auto p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
      <RefreshCw className="w-3.5 h-3.5" />
    </button>
  )}
</label>
```

#### 3. Helper text update

Change from "Pre-filled from your memories if available" to "Synced from your memories" after refresh completes.

### Files changed

| File | Change |
|---|---|
| `src/components/flows/weekly-event-finder/EventFinderConfig.tsx` | Always fetch on mount, additive merge, add refresh button |

No other files change. The `onPrefill` API, `useInterestSync`, and `InterestTagInput` are unchanged.

