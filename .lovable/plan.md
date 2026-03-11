

# Fix: Facebook Sync Access Token Extraction

## Root Cause

The `getAccessToken` function in `facebook-sync/index.ts` fails because it checks the wrong response paths. The Composio v3 API wraps the response in a `data` property, and the access token is at `data.access_token` -- not `connection_params.access_token`.

**Current code (line 127-128):**
```ts
const data = await response.json();
const token = data?.connection_params?.access_token || data?.connectionParams?.access_token;
```

**Working pattern from `composio-callback` (lines 961-963), which successfully fetches Facebook access tokens:**
```ts
const connectionData = await response.json();
const data = connectionData.data || connectionData;
const accessToken = data.access_token || data.params?.access_token;
```

## Fix

Update `getAccessToken` in `supabase/functions/facebook-sync/index.ts` (lines 127-129) to match the proven pattern from `composio-callback`, checking all known token paths:

```ts
const responseData = await response.json();
const data = responseData.data || responseData;
const token =
  data.access_token ||
  data.params?.access_token ||
  data.connectionParams?.access_token ||
  data.connection_params?.access_token;
console.log('Response keys:', Object.keys(data).join(', '));
console.log('Access token retrieved:', token ? 'yes' : 'no');
```

Add a debug log of `Object.keys(data)` so if it still fails, we can see the actual structure.

### Files changed
- `supabase/functions/facebook-sync/index.ts` -- fix `getAccessToken` token extraction paths + redeploy

No other files touched.

