## Root Cause Analysis

The edge function logs reveal two critical issues:

1. `**GOOGLE_MAPS_GET_PLACE_DETAILS` returns 404** — this Composio tool does not exist:
  ```
   Save place returned 404: {"error":{"message":"Tool GOOGLE_MAPS_GET_PLACE_DETAILS not found"}}
  ```
2. **The function lies about success** — line 197 of the edge function says `return true` after the search alone, treating a search as a bookmark. The counter increments, the UI says "bookmarked", but nothing was actually saved to Google Maps.
3. **Google Maps Platform does not expose a "save place" API** — starring/saving places to a user's personal list is a consumer-only feature with no public API endpoint. No Composio tool exists for this because Google doesn't offer it.

### What actually happens today

```text
User clicks "Bookmark" → search succeeds → save tool 404s → function returns true anyway → counter increments → nothing in Google Maps
```

### Fix: Use the place_id from search results to generate actionable Google Maps links

Since we cannot programmatically save a place to a user's Google Maps account, we should:

1. **Extract `place_id` from the `GOOGLE_MAPS_TEXT_SEARCH` response** (which already returns it successfully)
2. **Store the place_id and generate a Google Maps URL** (`https://www.google.com/maps/place/?q=place_id:{place_id}`) in our pending/completed bookmarks table
3. **Update the UI** to show a "View on Google Maps" link that opens the place directly, allowing the user to save it themselves
4. **Stop pretending the bookmark was saved** — rename the action to "Found on Maps" and provide the link
5. **Add a `google_maps_url` and `place_id` column** to `pending_restaurant_bookmarks`

### Files to modify

- `**supabase/functions/restaurant-bookmark-sync/index.ts**` — rewrite `bookmarkOnGoogleMaps` to extract `place_id` from search results and return it; stop calling the non-existent save tool; return the place_id and maps URL instead of a boolean
- **DB migration** — add `place_id text` and `google_maps_url text` columns to `pending_restaurant_bookmarks`
- `**src/components/flows/restaurant-bookmark-sync/PendingBookmarkCard.tsx**` — show "View on Google Maps" link when a maps URL is available
- `**src/components/flows/restaurant-bookmark-sync/ActiveMonitoring.tsx**` — update copy from "bookmarked" to "found" where appropriate
- `**src/types/restaurantBookmarkSync.ts**` — add `placeId` and `googleMapsUrl` optional fields to `PendingRestaurantBookmark`
- `**src/hooks/useRestaurantBookmarkSync.ts**` — map new fields from DB

### Key behavior change

- "Bookmark on Google Maps" button becomes "Find on Google Maps" — searches for the place and stores the result with a direct link
- After finding, a "Open in Google Maps" link lets the user tap to view (and manually save/star) the place
- The counter reflects "restaurants found" rather than "restaurants bookmarked"
- No more false positives — the user gets an honest, useful result  

  note: Do not change the thread title "Restaurant Memories to Google Maps Bookmark". Do not make any other changes.