

## Root Cause

The edge function logs tell the exact story:

```
[Fireflies] No access token found in Composio response. Keys: ["status", "generic_api_key", "base_url", "headers", "queryParams", "extra_data"]
[Fireflies Sync] No access token available -- cannot fetch transcripts
```

Fireflies uses **API key authentication**, not OAuth. Composio returns the credential as `generic_api_key`, but `getAccessToken()` (lines 212-217) only checks for `access_token` / `connection_params.access_token` -- it never looks at `generic_api_key`. So the function always returns `null`, skips the GraphQL call, and reports 0 new transcripts.

## Fix

**File: `supabase/functions/fireflies-automation-triggers/index.ts`** -- Update `getAccessToken()` (lines 212-217) to also check `generic_api_key` and `headers.Authorization`:

```typescript
const accessToken =
  data?.connection_params?.access_token ||
  data?.access_token ||
  data?.connectionParams?.access_token ||
  data?.connectionParams?.headers?.Authorization?.replace("Bearer ", "") ||
  data?.generic_api_key ||                                    // NEW
  data?.headers?.Authorization?.replace("Bearer ", "") ||     // NEW
  null;
```

Adding `generic_api_key` to the lookup chain means API-key-based integrations like Fireflies will resolve correctly. The `headers.Authorization` fallback covers cases where Composio pre-builds the auth header.

Then redeploy the `fireflies-automation-triggers` edge function.

