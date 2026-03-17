

## Problem

From the edge function logs, `listAlbums` returns `"albums":[]` and `listPhotos` returns `"mediaItems":[]` despite `successful: true` responses with `nextPageToken`. Two issues:

1. **Missing auth config ID**: All three Composio calls lack the `auth_config_id` parameter. Without it, the API authenticates with a default/wrong config, returning empty results.
2. **Wrong tool for `listPhotos`**: Uses `GOOGLEPHOTOS_LIST_MEDIA_ITEMS` which returns empty arrays. Should use `GOOGLEPHOTOS_SEARCH_MEDIA_ITEMS` (same tool already used in `listAlbumPhotos`).

## Plan — 1 file: `supabase/functions/google-photos-sync/index.ts`

### Change 1: Add auth config to `listAlbums` (line 138)
Add `auth_config_id: 'ac_SQbZGWVauUwV'` to the request body JSON.

### Change 2: Add auth config to `listAlbumPhotos` (line 189)
Add `auth_config_id: 'ac_SQbZGWVauUwV'` to the request body JSON.

### Change 3: Fix `listPhotos` (lines 237-248)
- Change tool from `GOOGLEPHOTOS_LIST_MEDIA_ITEMS` to `GOOGLEPHOTOS_SEARCH_MEDIA_ITEMS`
- Add `auth_config_id: 'ac_SQbZGWVauUwV'` to the request body JSON

All three changes are adding one field to existing request bodies + one URL change. No structural changes needed.

