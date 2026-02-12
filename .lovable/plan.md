# Fix Google Drive Auth Config Lookup

## Root Cause

The `getDefaultAuthConfigId` function in `composio-connect/index.ts` uses the wrong query parameter name when calling the Composio API. The code sends `?toolkit=GOOGLE_DRIVE` but the Composio v3 API expects `toolkit_slug` as the parameter name. This causes a 404 response, which the code interprets as "no auth config available."

## Fix

### File: `supabase/functions/composio-connect/index.ts`

**Change 1** -- Fix the query parameter name in `getDefaultAuthConfigId` (line 25):

```text
Before: /api/v3/auth-configs?toolkit=${composioName}&is_composio_managed=true
After:  /api/v3/auth-configs?toolkit_slug=${composioName}&is_composio_managed=true

```

**Change 2** -- Add enhanced logging to capture the actual API response when lookups fail, so future debugging is easier:

```typescript
const responseText = await response.text();
console.log(`Auth config API response for ${composioName}: ${responseText}`);
const data = JSON.parse(responseText);

```

That is the only change needed. Once deployed, the dynamic lookup will correctly query Composio for Google Drive's managed auth config.

---

## Suggestions (only additions)

**Change 3** — Ensure the toolkit slug value is correct for Google Drive  
Your Composio dashboard shows the toolkit slug is `GOOGLEDRIVE` (no underscore). Ensure `composioName` is exactly `GOOGLEDRIVE` for Google Drive lookups (not `GOOGLE_DRIVE`). If you have any normalization code that inserts underscores, add a one-off override for Google Drive so the final `toolkit_slug` sent is `GOOGLEDRIVE`.

**Change 4** — Prefer the explicit `AUTH_CONFIGS` mapping for `googledrive` before dynamic lookup  
Since you already have an auth config ID (`ac_7m7XMBKrLI_O`), ensure `AUTH_CONFIGS` includes:

- `googledrive: "ac_7m7XMBKrLI_O"`  
…and make sure the request path that triggers this error is using the integration key `googledrive` (so it hits the mapping). Only fall back to `getDefaultAuthConfigId` if there is no explicit mapping.

**Change 5** — Make the enhanced logging safe (don’t crash on non-JSON)  
Wrap `JSON.parse(responseText)` in a try/catch (or only parse when the response content-type is JSON). This prevents a secondary failure while trying to log a failed lookup.