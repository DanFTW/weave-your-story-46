

# Fix Google Drive "Auth config not found" Error

## Root Cause

The Composio logs show the exact error:

```
Composio response: {"error":{"message":"Auth config not found","code":302}}
Composio request body: {"auth_config_id":"ac_7m7XMBKrLI_O",...}
```

The hardcoded auth config ID `ac_7m7XMBKrLI_O` for Google Drive **no longer exists** in Composio. The code hits the explicit `AUTH_CONFIGS` map first, finds this stale ID, sends it to Composio, and Composio rejects it with a 400.

The dynamic fallback (`getDefaultAuthConfigId`) -- which we already fixed to use the correct `toolkit_slug` parameter -- never gets a chance to run because the hardcoded entry takes priority.

## Fix

### File: `supabase/functions/composio-connect/index.ts`

**Single change**: Remove the stale `googledrive` entry from the `AUTH_CONFIGS` map (line 116).

This allows the code to fall through to `getDefaultAuthConfigId("googledrive")`, which will query:

```
GET /api/v3/auth-configs?toolkit_slug=GOOGLEDRIVE&is_composio_managed=true
```

...and retrieve the current valid auth config ID from Composio automatically.

No other files or logic changes are needed.

## Technical Details

- Line 116 in `supabase/functions/composio-connect/index.ts`: delete `googledrive: "ac_7m7XMBKrLI_O",`
- The `COMPOSIO_TOOLKIT_NAMES` mapping already has `googledrive -> "GOOGLEDRIVE"` (correct)
- The `toolkit_slug` query parameter fix is already in place
- The dynamic fallback will fetch and use the correct Composio-managed default auth config
- Edge function will be redeployed after the change

