# Fix: Fireflies Transcript Detection Returns 0 Results

## Root Cause Analysis

The edge function logs tell the whole story in three lines:

```
[Fireflies Sync] Composio response status: 404
[Fireflies Sync] Composio error: "Tool FIREFLIES_LIST_TRANSCRIPTS not found"
[Fireflies Sync] Composio tool failed, trying direct GraphQL fallback
[Fireflies Sync] Found 0 total transcripts

```

There are **two cascading failures**:

### Prerequisite issue (from the provided console screenshot): Composio Connect is blocked because it is being framed

Your console shows:

```
Framing "https://connect.composio.dev/" violates the following Content Security Policy directive: "frame-ancestors 'none'". The request has been blocked.

```

This means the app is attempting to load Composio Connect in an iframe/modal. Composio explicitly blocks embedding (`frame-ancestors 'none'`). If the Connect UI cannot load, users may never complete the Fireflies connection successfully, which results in missing/invalid connected account tokens and ultimately 0 transcripts detected.

(Other `net::ERR_BLOCKED_BY_CLIENT` errors in the console are caused by browser extensions blocking analytics/pixels and are not relevant to transcript detection.)

### Failure 1: Composio tool slug no longer exists

`FIREFLIES_LIST_TRANSCRIPTS` returns HTTP 404 from Composio ("Tool not found"). This slug has been removed or renamed in the Composio tooling catalog. The code correctly falls back to direct GraphQL, but...

### Failure 2: GraphQL fallback silently fails because `getAccessToken()` uses outdated Composio v1 API

The `getAccessToken()` function (line 199-213) calls:

```
GET /api/v1/connected_accounts/{connectionId}

```

and extracts `connectionParams.access_token`.

But Composio now uses **v3**, where the token is stored at different paths:

- `data.connection_params.access_token`
- `data.access_token`

The v1 endpoint either returns a different structure or fails entirely, causing `getAccessToken()` to return `null`. When the token is null, the GraphQL fallback is **silently skipped** (no log message), and the function returns 0 transcripts.

**Evidence**: Other working integrations (LinkedIn, HubSpot) already use v3:

```typescript
// LinkedIn (working):
fetch(`https://backend.composio.dev/api/v3/connected_accounts/${connectionId}`)
const accessToken = data?.data?.connection_params?.access_token || data?.data?.access_token || ...

```

### Secondary issue: `fetchFullTranscript()` uses the same broken `getAccessToken()`

Even if we fix the list query, the per-transcript detail fetch (for sentences/summary) would also fail via the same broken token extraction path.

## Solution

### Change 0: Stop embedding Composio Connect in an iframe/modal (CSP `frame-ancestors 'none'`)

Wherever the app opens Composio Connect, do not render it in an iframe. Launch it as a top-level navigation (or a new tab) so the connection flow can complete and produce a valid connected account token.

Example implementation approach:

- Replace iframe/modal embedding with `window.location.href = connectUrl`, or
- `window.open(connectUrl, "_blank", "noopener,noreferrer")`

### Change 1: Update `getAccessToken()` to use Composio v3 API with robust token extraction

Replace the v1 call with v3 and try multiple token paths (matching the pattern used by LinkedIn/HubSpot). Add logging when no token is found.

```text
Before (broken):
  GET /api/v1/connected_accounts/{connectionId}
  extract: connectionParams.access_token

After (fixed):
  GET /api/v3/connected_accounts/{connectionId}
  extract: data?.connection_params?.access_token
        || data?.access_token
        || connectionParams.access_token (legacy fallback)
  + log warning when no token found

```

### Change 2: Remove dead `FIREFLIES_LIST_TRANSCRIPTS` Composio tool call

Since this tool no longer exists in Composio, the code wastes a network round-trip and always falls through to GraphQL. Remove the Composio tool attempt entirely and go directly to the Fireflies GraphQL API. This eliminates one unnecessary failure + 404 log noise on every sync.

### Change 3: Add missing log when `getAccessToken` returns null in the fallback path

Currently, if `getAccessToken` returns null at line 338, the entire GraphQL branch is silently skipped. Add a warning log so future debugging is easier.

## Files to Change


| File                                                                                   | Change                                                                                                                               |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `supabase/functions/fireflies-automation-triggers/index.ts`                            | Fix `getAccessToken()` to use v3 API; remove dead `FIREFLIES_LIST_TRANSCRIPTS` call in `syncFirefliesTranscripts()`; add missing log |
| Frontend file that currently embeds `https://connect.composio.dev/` in an iframe/modal | Replace iframe/modal embedding with a full-page redirect or new-tab launch so Connect can complete                                   |


No frontend changes needed. **(Exception: Composio Connect must not be embedded in an iframe due to CSP; open it as a full-page redirect/new tab.)** No database changes needed.

## Technical Details

### `getAccessToken()` (lines 199-213) -- rewrite:

```typescript
async function getAccessToken(connectionId: string): Promise<string | null> {
  try {
    const connResponse = await fetch(
      `https://backend.composio.dev/api/v3/connected_accounts/${connectionId}`,
      { headers: { "x-api-key": COMPOSIO_API_KEY } }
    );
    if (!connResponse.ok) {
      console.error(`[Fireflies] Failed to fetch connected account: ${connResponse.status}`);
      return null;
    }
    const connData = await connResponse.json();
    const data = connData?.data || connData;

    const accessToken =
      data?.connection_params?.access_token ||
      data?.access_token ||
      data?.connectionParams?.access_token ||
      data?.connectionParams?.headers?.Authorization?.replace("Bearer ", "") ||
      null;

    if (!accessToken) {
      console.error("[Fireflies] No access token found in Composio response. Keys:", Object.keys(data));
    }
    return accessToken;
  } catch (err) {
    console.error("[Fireflies] Error fetching access token:", err);
    return null;
  }
}

```

### `syncFirefliesTranscripts()` (lines 284-453) -- simplify:

Remove the `FIREFLIES_LIST_TRANSCRIPTS` Composio tool call (lines 294-331). Go directly to the GraphQL API using `getAccessToken()`. This is the only reliable path since the Composio tool slug no longer exists.

Add a warning log when `getAccessToken` returns null so the failure is visible:

```typescript
const accessToken = await getAccessToken(connectionId);
if (!accessToken) {
  console.error("[Fireflies Sync] No access token available -- cannot fetch transcripts");
  return { newTranscripts: 0, totalSaved: 0 };
}

```

### `fetchFullTranscript()` (lines 215-280) -- no structural change

This function already calls `getAccessToken()` for its GraphQL fallback, so fixing `getAccessToken()` automatically fixes this path too. The Composio `FIREFLIES_GET_TRANSCRIPT_BY_ID` call (lines 217-239) may also 404, but the function already handles that gracefully and falls through to GraphQL.

## Deployment

Redeploy the `fireflies-automation-triggers` edge function after the changes.

Perform a rubber duck analysis and go through the relevant code to identify errors and logic gaps. Please also use modern-day 2026 best practices to implement your well-thought-out solution. Do not make any other changes to the codebase that are not directly related to the problems identified, etc.