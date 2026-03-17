

## Investigation Results

**Root cause confirmed**: Both Google Photos connections (`ca_NWNCudsPQWnZ` updated today, `ca_xltKkAWRHr1Y` from January) return `401 UNAUTHENTICATED` from Google's API. Composio wraps this in an HTTP 200 response with `"successful": false`. The edge function only checks `response.ok` (which is `true`), so it silently returns empty arrays instead of surfacing the error.

The auth config `ac_SQbZGWVauUwV` is correct and already in the code. The problem is the **connected accounts' OAuth tokens** are invalid — even the one updated today. This suggests the connection was created but the OAuth grant didn't complete properly, or the token was immediately invalid.

## Plan — 1 file: `supabase/functions/google-photos-sync/index.ts`

### Add Composio `successful` field validation

In all three fetch functions (`listAlbums`, `listAlbumPhotos`, `listPhotos`), after parsing the JSON response, check `data.successful === false`. If the nested status is 401, throw a typed `NEEDS_RECONNECT` error. Otherwise throw a generic error.

```typescript
// After: const data = JSON.parse(responseText);
if (data.successful === false) {
  const statusCode = data.data?.status_code;
  if (statusCode === 401) {
    throw new Error('NEEDS_RECONNECT');
  }
  throw new Error(data.error || 'Composio tool failed');
}
```

### Propagate `needsReconnect` to frontend

In the main request handler, wrap each action's response in a try/catch that detects `NEEDS_RECONNECT` and returns `{ error: "Google Photos token expired. Please reconnect.", needsReconnect: true }`. This follows the existing pattern used by Slack and Instagram integrations.

### Changes summary

| Location | Change |
|----------|--------|
| `listAlbums` (after line 156) | Add `data.successful` check, throw on 401 |
| `listAlbumPhotos` (after line 209) | Same check |
| `listPhotos` (after line 263) | Same check |
| Main handler (lines 70-116) | Catch `NEEDS_RECONNECT`, return `{ needsReconnect: true }` |

### User action required

After deploying, **you must reconnect Google Photos** at `/integration/googlephotos` — disconnect and reconnect to get a fresh OAuth token. The code fix ensures the 401 error is properly surfaced going forward instead of silently returning empty results.

