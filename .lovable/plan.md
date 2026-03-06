## IInvestigation Findings

### Error Location Clarified

The reported error `{"error":"Composio API error: 400"}` originates from `composio-connect/index.ts` (line 332), not from `coinbase-trades-poll`. This is a **connection creation** failure, not a polling failure.

### Root Cause: Auth Scheme Mismatch in Connect Flow

The Composio Coinbase toolkit uses **API Key** authentication (not OAuth). The `composio-connect` edge function calls Composio's `/api/v3/connected_accounts/link` endpoint, which is designed for **OAuth** flows (it returns a `redirect_url`). This endpoint does not support API Key auth configs, so it rejects `ac_fCVi2K8lFafl` with a 400 error.

The dynamic fallback also fails because any Coinbase auth config will be API Key type.

### Tool Availability Confirmed

`COINBASE_LIST_PRODUCTS_TRADES` **exists** in the Composio Coinbase toolkit (29 tools total, confirmed via official docs at v3.docs.composio.dev/tools/coinbase). The previous diagnosis of "tool does not exist" was incorrect.

### Current Connection State

- `user_integrations` has `composio_connection_id: ca_SkPdaHWbhndP` with `status: connected`
- This connection was likely created via the Composio dashboard/playground, not through the app's connect flow
- If this connection is valid and linked to the correct API Key auth, `coinbase-trades-poll` should work -- but we have **no recent logs** from that function to verify (logs have rotated)

### What Needs Verification (requires a live poll attempt)

1. Whether `ca_SkPdaHWbhndP` is still active and linked to the correct Coinbase API Key credentials
2. The actual Composio error response when `coinbase-trades-poll` calls `COINBASE_LIST_PRODUCTS_TRADES` with this connection ID
3. Whether the 404 errors from earlier conversation were `Tool_ToolNotFound` or `ConnectedAccount` related

### Plan: Three Fixes

**Fix 1:** `coinbase-trades-poll/index.ts` **-- Add diagnostic logging**

Before changing the tool call, add verbose logging to capture:

- The exact `connectionId` being passed
- The full raw Composio response (status + body) for each tool execution attempt
- Whether errors are `Tool_ToolNotFound` vs `ConnectedAccountExpired` vs `Auth_Config` errors

This will definitively prove whether the poll failure is a connection issue or a tool resolution issue.

**Fix 2:** `composio-connect/index.ts` **-- Support API Key auth scheme for Coinbase**

The connect flow needs a separate code path for API Key-based toolkits. Instead of calling `/connected_accounts/link` (OAuth only), Coinbase connections should either:

- Use Composio's `/api/v3/connected_accounts` POST endpoint with `auth_scheme: "API_KEY"` and the user's Coinbase API credentials
- Or skip the OAuth redirect flow entirely and prompt the user to enter their Coinbase API key/secret directly in the app, which gets sent to Composio to create the connected account

This requires adding Coinbase to a list of "API Key auth" toolkits that bypass the OAuth link flow.

**Fix 3:** `useCoinbaseTradesAutomation.ts` **-- Surface errors to user**

Add toast feedback for `manualPoll()` failures and zero-result scenarios so the user always gets feedback.

### Files to Change

- `supabase/functions/composio-connect/index.ts` -- Add API Key auth path for Coinbase (and future API Key toolkits)
- `supabase/functions/coinbase-trades-poll/index.ts` -- Add diagnostic logging; truncate error-swallowing in per-pair catch blocks
- `src/hooks/useCoinbaseTradesAutomation.ts` -- Add error/zero-result toast feedback