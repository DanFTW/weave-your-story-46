

## Add Interest Blocklist & Confirm-Delete on Tag Removal

### Overview
When a user removes an interest tag, show a confirmation dialog offering to also permanently delete the LIAM memory. Add a blocklist (stored in the DB config) so blocked words never reappear during sync/prefill.

### Database Change

Add a `blocked_interests` text column to `weekly_event_finder_config`:

```sql
ALTER TABLE public.weekly_event_finder_config
  ADD COLUMN IF NOT EXISTS blocked_interests text;
```

Stored as comma-separated lowercase strings (consistent with the `interests` column pattern).

### Files to Change

| File | Change |
|---|---|
| `supabase/migrations/new.sql` | Add `blocked_interests` column |
| `src/types/weeklyEventFinder.ts` | Add `blockedInterests: string | null` to `WeeklyEventFinderConfig` |
| `src/hooks/useWeeklyEventFinder.ts` | Map `blocked_interests` from DB to config; pass it through `updateConfig` |
| `src/hooks/useWeeklyEventFinder.ts` → `updateConfig` | Accept new `blockedInterests` param, send to edge function |
| `src/components/flows/weekly-event-finder/InterestTagInput.tsx` | Update `onRemoveTag` callback signature to include a "also delete memory" boolean, or keep it simple — the parent handles the dialog |
| `src/components/flows/weekly-event-finder/TagRemoveDialog.tsx` | **New.** AlertDialog with 3 options: "Remove" (local only), "Remove & Block" (local + blocklist + LIAM delete), "Cancel" |
| `src/components/flows/weekly-event-finder/EventFinderConfig.tsx` | Wire `TagRemoveDialog`; manage blocklist state; filter blocklist during prefill merge; pass blocklist to `updateConfig` |
| `src/components/flows/weekly-event-finder/WeeklyEventFinderFlow.tsx` | Pass blocklist through `handleSyncInterests` filter; update `updateConfig` calls to include blockedInterests |
| `supabase/functions/weekly-event-finder/index.ts` | Accept & persist `blockedInterests` in `update-config` action; filter blocklist during `prefill` action results |

### New Component: `TagRemoveDialog.tsx`

Uses existing `AlertDialog` components. Triggered when user taps `X` on a tag chip.

```
┌─────────────────────────────────┐
│  Remove "Cooking"?              │
│                                 │
│  This will remove it from your  │
│  interests list.                │
│                                 │
│  ☐ Block this topic             │
│    (won't reappear on sync)     │
│                                 │
│  [Cancel]  [Remove]             │
└─────────────────────────────────┘
```

- "Remove" → removes tag locally + `addRemovedTag` + `forgetInterestMemory`
- If "Block this topic" is checked → also adds to `blockedInterests` in config
- Uses `AlertDialog` from `@/components/ui/alert-dialog`

### Blocklist Filtering Logic

A new utility function in `interestTagUtils.ts`:

```typescript
export function filterBlockedInterests(tags: string[], blocklist: string | null): string[] {
  if (!blocklist) return tags;
  const blocked = new Set(blocklist.split(",").map(b => b.trim().toLowerCase()).filter(Boolean));
  return tags.filter(t => !blocked.has(t.toLowerCase()));
}
```

Applied in:
1. `EventFinderConfig.refreshFromMemories` — filter prefill results
2. `WeeklyEventFinderFlow.handleSyncInterests` — filter before merge
3. Edge function `prefill` action — server-side filter before returning

### Hook Changes

`updateConfig` signature gains `blockedInterests: string`:

```typescript
await onUpdateConfig(interests, location, frequency, deliveryMethod, email, phone, blockedInterests);
```

`useWeeklyEventFinder.updateConfig` passes it to the edge function and updates local state.

### Edge Function Changes

- `update-config` action: persist `blocked_interests` column
- `prefill` action: load user's `blocked_interests`, filter returned interests server-side

