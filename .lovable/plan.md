

## Diagnosis

The Google Maps integration IS genuinely connected to daniel@weave.cloud. The issue is cosmetic: `account_name` is stored as `null` in the database because:

1. Google Maps OAuth scopes don't include the `profile` scope, so `https://www.googleapis.com/oauth2/v3/userinfo` returns email and avatar but **not** `name`
2. The cross-integration lookup found email from another Google service, but that service also had a null name
3. The UI falls back to showing "Connected Account" as the display name, which looks like a placeholder/error

The "Change" button functionality works correctly (disconnect + reconnect with forceReauth). The user's confusion stems from the generic "Connected Account" text.

## Fix

**1. `composio-callback` edge function** — After the Google Maps profile fetch block (line ~3386), add a name-from-email derivation fallback. When `accountName` is null but `accountEmail` is available, derive a display name from the email prefix (e.g., `daniel@weave.cloud` → `Daniel`):

```typescript
// Derive name from email if still missing
if (!accountName && accountEmail) {
  const prefix = accountEmail.split("@")[0];
  const segments = prefix.split(/[._-]/).filter(Boolean);
  accountName = segments.map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(" ");
}
```

This same pattern should apply to all Google toolkit blocks that share this problem, but per the user's request, I'll only fix the Google Maps block.

**2. Fix existing DB record** — Run an UPDATE to set the account_name for the existing googlemaps row so the user sees the fix immediately without reconnecting.

**3. Redeploy edge function** — Deploy the updated `composio-callback`.

### Files to modify
- `supabase/functions/composio-callback/index.ts` — add name-from-email fallback in the googlemaps block

### No other changes
- The "Change" button works correctly
- The connection is legitimate, not falsely showing

