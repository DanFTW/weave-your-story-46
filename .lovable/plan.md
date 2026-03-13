

## Restaurant Memories to Google Maps Bookmark — Implementation Plan

This thread mirrors the calendar-event-sync pattern exactly: AI parses memories for restaurant mentions, auto-bookmarks them via Composio Google Maps, and queues incomplete ones for manual resolution.

### 1. Database Tables (2 new tables via migration)

**`restaurant_bookmark_config`** — mirrors `calendar_event_sync_config`
- `id` uuid PK, `user_id` uuid NOT NULL, `is_active` boolean DEFAULT false, `restaurants_bookmarked` integer DEFAULT 0, `created_at` timestamptz, `updated_at` timestamptz
- RLS: user can SELECT/INSERT/UPDATE own rows

**`pending_restaurant_bookmarks`** — mirrors `pending_calendar_events`
- `id` uuid PK, `user_id` uuid NOT NULL, `memory_id` text NOT NULL, `memory_content` text NOT NULL, `restaurant_name` text, `restaurant_address` text, `restaurant_cuisine` text, `restaurant_notes` text, `status` text DEFAULT 'pending', `created_at` timestamptz, `updated_at` timestamptz
- RLS: user can SELECT/INSERT/UPDATE/DELETE own rows
- Unique constraint on `(user_id, memory_id)`

### 2. Edge Function: `restaurant-bookmark-sync`

Single edge function (mirrors `calendar-event-sync`) with actions:
- **`activate`** / **`deactivate`** — toggle `is_active` on config table
- **`process-new-memory`** — AI parses memory for restaurant mentions (name, address, cuisine). If complete + Google Maps connected, execute Composio `GOOGLEMAPS_SEARCH_PLACES` to find the place, then `GOOGLEMAPS_SAVE_PLACE` (or closest available action) to bookmark. If incomplete, queue in `pending_restaurant_bookmarks`
- **`create-bookmark`** — from pending queue, search + bookmark via Composio Google Maps
- **`update-pending`** — update fields on a pending item
- **`dismiss-pending`** — mark as dismissed
- **`manual-sync`** — scan all LIAM memories for restaurant mentions, process unprocessed ones

AI parsing uses the same Lovable AI gateway pattern with a `extract_restaurant` tool schema that returns `{ isRestaurant, name, address, cuisine, notes, isComplete }`.

### 3. Types: `src/types/restaurantBookmarkSync.ts`

Mirrors `calendarEventSync.ts`:
- `RestaurantBookmarkSyncPhase` = "auth-check" | "configure" | "activating" | "active"
- `RestaurantBookmarkSyncConfig` — id, userId, isActive, restaurantsBookmarked, timestamps
- `PendingRestaurantBookmark` — id, userId, memoryId, memoryContent, restaurantName, restaurantAddress, restaurantCuisine, restaurantNotes, status
- `RestaurantBookmarkSyncStats` — restaurantsBookmarked, isActive, pendingCount

### 4. Hook: `src/hooks/useRestaurantBookmarkSync.ts`

Mirrors `useCalendarEventSync.ts` — loadConfig, activate, deactivate, updatePendingBookmark, pushBookmark, dismissPending, manualSync. Queries `restaurant_bookmark_config` and `pending_restaurant_bookmarks`.

### 5. UI Components: `src/components/flows/restaurant-bookmark-sync/`

Mirrors the calendar-event-sync component structure:
- **`index.ts`** — barrel export
- **`RestaurantBookmarkSyncFlow.tsx`** — main flow component with auth gate for GOOGLEMAPS (same pattern as CalendarEventSyncFlow)
- **`AutomationConfig.tsx`** — explains how it works, "Enable Bookmark Sync" button
- **`ActiveMonitoring.tsx`** — stats, auto-sync toggle, manual sync button, pending list
- **`ActivatingScreen.tsx`** — loading animation during activation
- **`PendingBookmarkCard.tsx`** — expandable card to edit restaurant name/address/cuisine and trigger manual bookmark

### 6. Registration (data + routing)

**`src/data/threads.ts`** — add entry:
```
{
  id: "restaurant-bookmark-sync",
  title: "Restaurant Memories to Google Maps Bookmark",
  icon: MapPin,  // from lucide-react
  gradient: "teal",
  status: "active",
  type: "automation",
  category: "personal",
  integrations: ["googlemaps"],
  triggerType: "automatic",
  flowMode: "thread",
}
```

**`src/data/threadConfigs.ts`** — add config with 3 steps (Connect Google Maps, Enable Sync, Always-On)

**`src/data/flowConfigs.ts`** — add entry with `isRestaurantBookmarkSyncFlow: true`

**`src/types/flows.ts`** — add `isRestaurantBookmarkSyncFlow?: boolean`

**`src/pages/FlowPage.tsx`** — import `RestaurantBookmarkSyncFlow`, add render block for `config.isRestaurantBookmarkSyncFlow`

**`src/pages/Threads.tsx`** — add `'restaurant-bookmark-sync'` to `flowEnabledThreads`

**`src/pages/ThreadOverview.tsx`** — add `'restaurant-bookmark-sync'` to the `flowEnabledThreads` array

### 7. Fire-and-forget trigger: `src/utils/triggerRestaurantBookmarkSync.ts`

Mirrors `triggerCalendarSync.ts` — checks if restaurant bookmark sync is active, then fires `restaurant-bookmark-sync` edge function with `process-new-memory`.

### 8. Wire trigger into memory save

Update `useLiamMemory.ts` `createMemory` to also call `triggerRestaurantBookmarkSync` alongside the existing `triggerCalendarSync`.

### Summary of files to create/modify

**Create (8 files):**
- `src/types/restaurantBookmarkSync.ts`
- `src/hooks/useRestaurantBookmarkSync.ts`
- `src/components/flows/restaurant-bookmark-sync/index.ts`
- `src/components/flows/restaurant-bookmark-sync/RestaurantBookmarkSyncFlow.tsx`
- `src/components/flows/restaurant-bookmark-sync/AutomationConfig.tsx`
- `src/components/flows/restaurant-bookmark-sync/ActiveMonitoring.tsx`
- `src/components/flows/restaurant-bookmark-sync/ActivatingScreen.tsx`
- `src/components/flows/restaurant-bookmark-sync/PendingBookmarkCard.tsx`
- `src/utils/triggerRestaurantBookmarkSync.ts`
- `supabase/functions/restaurant-bookmark-sync/index.ts`

**Modify (6 files):**
- `src/data/threads.ts` — add thread entry
- `src/data/threadConfigs.ts` — add thread config
- `src/data/flowConfigs.ts` — add flow config
- `src/types/flows.ts` — add boolean flag
- `src/pages/FlowPage.tsx` — import + render
- `src/pages/Threads.tsx` — add to flowEnabledThreads
- `src/pages/ThreadOverview.tsx` — add to flowEnabledThreads
- `src/hooks/useLiamMemory.ts` — call triggerRestaurantBookmarkSync

**Database migration:** 2 tables + RLS policies

