

# Plan: Fix Instagram Analytics Poll — Redeploy, Add Logging, Reset Stale State

## Confirmed Facts
- Source code metric array is `["reach", "profile_views", "follower_count", "accounts_engaged"]` — all valid per Composio's allowed list
- Earlier runtime errors cited `metric[0]` rejection, consistent with a previous payload containing `"impressions"`
- There is currently a mismatch between the source on disk and the earlier observed runtime error
- DB state is stuck: `is_active=true`, `insights_collected=0`, `last_polled_at=NULL`

## Remaining Hypothesis
- Whether the deployed function is stale (serving old code) or updated — requires one fresh invocation with payload logging to confirm

## Changes

### 1. Add defensive payload logging (edge function)
In `supabase/functions/instagram-analytics-poll/index.ts`, add a `console.log` immediately before the `executeComposioAction` call (around line 201) that logs the exact outbound payload:
```typescript
const insightsPayload = { metric: ["reach", "profile_views", "follower_count", "accounts_engaged"], period: "day" };
console.log("[Instagram Analytics] Outbound Composio payload:", JSON.stringify(insightsPayload));
const insightsResult = await executeComposioAction("INSTAGRAM_GET_USER_INSIGHTS", connectionId, insightsPayload);
```

### 2. Graceful recovery for activate action
In the `activate` action handler (~line 265), move the `is_active=true` update to **after** the poll succeeds rather than before, so a failed first poll doesn't leave the config in a broken "active but never polled" state. If the poll throws, catch it, leave `is_active=false`, and return the error.

### 3. Force redeploy
Deploy `instagram-analytics-poll` after the code changes.

### 4. Verify with invocation
After deploy, invoke the function with `action: "manual-poll"` and check edge function logs to confirm the logged payload matches the source and to see whether Composio accepts or rejects it.

## Files Modified
- `supabase/functions/instagram-analytics-poll/index.ts` — payload logging + activate ordering fix

No frontend changes needed. The hook already handles error responses correctly.

