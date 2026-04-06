

# Fix: Spotify Playlists Not Loading

## Root Cause

The Composio v3 tool execute API returns responses nested as:
```json
{ "data": { "response_data": { "items": [...] } } }
```

The `composioExecute` helper in `spotify-music-finder/index.ts` parses the raw JSON and returns the full object. But line 322 extracts items as:
```typescript
const data = result?.response_data || result?.data || result;
const items = data?.items || [];
```

This checks `result.response_data` first (which doesn't exist at the top level), then falls back to `result.data` — but `result.data` is `{ response_data: { items: [...] } }`, so `data.items` is undefined. The playlists array ends up empty.

Every other Composio-calling edge function in the codebase (YouTube, Trello, Google Drive, Grocery Sync) accesses the data as `data?.data?.response_data` — the spotify function is the only one that gets this wrong.

The same bug also affects the search result parsing on line 522 (used during music discovery polling).

## Fix

**File: `supabase/functions/spotify-music-finder/index.ts`**

1. **Line 322-323** (list-playlists): Change response extraction to check multiple nesting levels, matching the pattern used in other functions:
```typescript
const data = result?.data?.response_data || result?.response_data || result?.data || result;
const items = data?.items || [];
```

2. **Line 522-523** (search): Apply the same fix:
```typescript
const data = searchResult?.data?.response_data || searchResult?.response_data || searchResult?.data || searchResult;
tracks = data?.tracks?.items || [];
```

3. Add a `console.log` after the Composio call to log the raw response shape (truncated) for future debugging — same pattern other functions use.

No frontend changes needed. The frontend already handles the playlists array correctly once populated.

