

## Problem

The `loadConfig` function in `useRestaurantBookmarkSync.ts` only fetches bookmarks with `status = "pending"` (line 81). There are 18 completed and 2 pending records in the database, but only the 2 pending ones ever load. The `ActiveMonitoring` component also has no section to render completed/historical bookmarks.

## Fix — 3 files

### 1. `src/hooks/useRestaurantBookmarkSync.ts`
- Add a second query alongside the pending query to fetch bookmarks with `status = "completed"`, ordered by `updated_at desc`
- Store them in a new `completedBookmarks` state (`PendingRestaurantBookmark[]`)
- Re-fetch completed bookmarks after `loadConfig` is called (including after `manualSync` and `pushBookmark`)
- Export `completedBookmarks` from the hook

### 2. `src/components/flows/restaurant-bookmark-sync/ActiveMonitoring.tsx`
- Accept new prop `completedBookmarks: PendingRestaurantBookmark[]`
- Add a "Previously found" section below the pending queue that lists completed restaurants
- Each completed item: card showing restaurant name, address, cuisine, and a Google Maps external link button if URL exists
- Simple read-only display (no edit/dismiss controls)

### 3. `src/components/flows/restaurant-bookmark-sync/RestaurantBookmarkSyncFlow.tsx`
- Pass the new `completedBookmarks` from the hook to `ActiveMonitoring`

### UI for completed section
```text
── Previously found (18) ──────────
┌──────────────────────────────────┐
│ 🍽 Sushi Nakazawa          ↗    │
│ 23 Commerce St, New York        │
│ Japanese                        │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ 🍽 L'Artusi                ↗    │
│ 228 W 10th St, New York         │
│ Italian                         │
└──────────────────────────────────┘
...
```

