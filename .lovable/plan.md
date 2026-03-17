

## Problem

The Sync History section on `/flow/youtube-sync` only shows "Subscription" entries because all 40 records in the database have `video_category = 'Subscription'`. The category assignment in the edge function works correctly (`sub_` prefix → Subscription, else → Liked Video), but no liked videos have been synced yet. The user also wants filter tabs and proper category display.

## Plan — 2 changes in 1 file

### `src/components/flows/youtube-sync/YouTubeSyncActive.tsx`

1. **Add filter state**: `const [categoryFilter, setCategoryFilter] = useState<string>("All");`

2. **Add filter tabs** between the collapsible trigger and the history list — a row of pill-style buttons: `All`, `Liked Videos`, `Watch History`, `Subscriptions`. Styled consistently with the existing category badges (red/orange/purple). Active tab gets a solid background, inactive tabs get a subtle outline.

3. **Filter the displayed history**: Derive `filteredHistory` from `syncHistory` based on `categoryFilter`. "All" shows everything; otherwise match `item.videoCategory`.

4. **Update count display**: Show filtered count in the header: `Sync History (filtered / total)`.

No other files modified. The edge function already assigns categories correctly — liked videos and watch history entries will appear with their proper badges once synced.

