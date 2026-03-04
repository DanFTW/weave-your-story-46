## Analysis

### What's working

- Google Maps Text Search via Composio succeeds and returns place data
- The search finds "Pei Wei Asian Kitchen" at the correct address

### Two issues found

**1. Missing `place_id` extraction** — The edge function logs show `"No place_id found, using search URL fallback"`. The Composio response wraps the Places API (new) data where the place ID field is `name` (format: `places/ChIJ...`) not `id`. The current code checks `firstPlace.id ?? firstPlace.place_id ?? firstPlace.placeId` but the actual field from the new Google Places API returned by Composio is either `name` (the resource name like `places/ChIJxxxxx`) or nested differently. This means every restaurant falls back to a generic search URL instead of a precise place URL.

**2. Button copy mismatch** — The `PendingBookmarkCard` shows "Open in Google Maps" but the user wants "Bookmark on Google Maps". Since Google Maps has no programmatic save API, the best UX is: open the place directly in Maps where the user taps the save/star button. The CTA should read "Bookmark on Google Maps" to match the thread's purpose.

### Fix plan

**File 1: `supabase/functions/restaurant-bookmark-sync/index.ts**`

- In `findOnGoogleMaps`, broaden the `place_id` extraction to check `firstPlace.name` (the resource name from new Places API, e.g. `places/ChIJ...`), then strip the `places/` prefix to get the actual place ID
- Also check `firstPlace.id` which some Composio responses use
- Use `https://www.google.com/maps/place/?q=place_id:${placeId}` for precise linking

**File 2: `src/components/flows/restaurant-bookmark-sync/PendingBookmarkCard.tsx**`  

- Change "Open in Google Maps" button text to "Bookmark on Google Maps"
- Change "Find on Google Maps" button text to "Bookmark on Google Maps"

**File 3: `src/components/flows/restaurant-bookmark-sync/ActiveMonitoring.tsx**`

- Change "Restaurants found" copy back to "Restaurants bookmarked" to match the thread title

Redeploy the edge function after changes.  
  
Do not modify any other files