

## Root Cause Analysis

There are **two interacting bugs** creating an infinite redirect loop:

### Bug 1: Redirect ping-pong between two pages

The `SlackMessagesSyncFlow` checks `composio_connection_id` (the actual token). Since it's null, it sets `sessionStorage("returnAfterSlackConnect", "/flow/slack-messages-sync")` and redirects to `/integration/slack`.

The `IntegrationDetail` page uses `useComposio` which only checks `status === "connected"` (ignoring the token). It sees Slack as connected, reads `returnAfterSlackConnect` from sessionStorage, and redirects back to `/flow/slack-messages-sync`. This creates an infinite loop.

### Bug 2: Token never persisted in database

The DB confirms `composio_connection_id: null` for the user's Slack row. The `slack-oauth` edge function code has the fix (`composio_connection_id: userToken`) but either wasn't redeployed or the connection predates the fix. All 2 Slack connections in the DB have null tokens.

### Evidence from network requests

The requests fire every ~1 second in pairs (one from SlackMessagesSyncFlow, one from useComposio/IntegrationDetail), confirming the redirect loop between the two pages.

---

## Plan

### 1. Break the redirect loop in SlackMessagesSyncFlow.tsx

When `composio_connection_id` is null but `status` is `"connected"`, instead of redirecting to `/integration/slack` (which bounces back), show a "Reconnect Required" inline screen with a button that navigates to the integration page **without** setting the return path in sessionStorage. This breaks the loop.

```typescript
// New state
const [needsReconnect, setNeedsReconnect] = useState(false);

// In checkSlackAuth: detect connected-but-no-token
const hasUsableToken = Boolean(data?.composio_connection_id);
const isConnectedWithoutToken = Boolean(data && !data.composio_connection_id);
setIsSlackConnected(hasUsableToken);
setNeedsReconnect(isConnectedWithoutToken);

// In second useEffect: only redirect if NOT connected at all
if (!isSlackConnected && !needsReconnect) {
  sessionStorage.setItem("returnAfterSlackConnect", "/flow/slack-messages-sync");
  navigate("/integration/slack");
}

// New render branch for needsReconnect: show reconnect UI
```

### 2. Add `/flow/slack-me` route alias in App.tsx

Add a redirect route so `/flow/slack-me*` resolves to `/flow/slack-messages-sync`.

### 3. Redeploy the slack-oauth edge function

The function code already has the fix at line 161 (`composio_connection_id: userToken`). Trigger a redeploy to ensure the live version matches.

### 4. Add console logging for debugging

Add a `console.log` in `SlackMessagesSyncFlow` showing the auth check result (`hasUsableToken`, `needsReconnect`) so future debugging is easier.

---

## Files to change

- `src/components/flows/slack-messages-sync/SlackMessagesSyncFlow.tsx` — break redirect loop, add reconnect UI
- `src/App.tsx` — add `/flow/slack-me` redirect alias
- `supabase/functions/slack-oauth/index.ts` — redeploy (no code changes needed, already fixed)

