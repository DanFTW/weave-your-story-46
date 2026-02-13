
# Fix Discord Server Loading

## Problem

Two issues are preventing servers from loading:

1. **Fallback logic bug** (lines 116-122): A broken ternary expression causes the same connection ID (`ca_CLVIIXBLidKg`) to be tried twice. The second connection (`ca_seifjoPKRVN6`) is never attempted.

2. **Stale Discord connection**: The `discord` entry in the database (`ca_CLVIIXBLidKg`) appears to hold an invalid/expired token. The `discordbot` entry (`ca_seifjoPKRVN6`) may work but is never reached due to bug #1.

## Solution

**Single file**: `supabase/functions/discord-automation-triggers/index.ts`

### 1. Fix the broken fallback logic (lines 116-124)

Replace the complex ternary with simple array deduplication:

```text
Before (buggy):
  const fallbackConnectionId = (discordIntegration && botIntegration && discordIntegration !== integration)
    ? botIntegration.composio_connection_id
    : (botIntegration && discordIntegration && botIntegration !== integration)
      ? discordIntegration.composio_connection_id
      : null;

After (fixed):
  const allConnectionIds = [
    discordIntegration?.composio_connection_id,
    botIntegration?.composio_connection_id,
  ].filter((id): id is string => !!id && id.startsWith("ca_"));
  const connectionIdsToUse = [...new Set(allConnectionIds)];
  const connectionId = connectionIdsToUse[0];
```

### 2. Use the fixed list in get-servers and get-channels

- Line 153: Replace `[connectionId, fallbackConnectionId].filter(Boolean)` with `connectionIdsToUse`
- Line 241: Same change for channels

### 3. Prioritize regular Discord OAuth

Reorder `connectionIdsToUse` so the `discord` integration (auth config `ac_BOCrE-Q-yqJu`) is always tried first, before `discordbot`. This is already handled by lines 105-107 where `discordIntegration` is listed first in the array.

### 4. Add a "reconnect" action

Add a new `reconnect` case that calls the Composio initiate-connection API with auth config `ac_BOCrE-Q-yqJu` to get a fresh OAuth URL. This gives the frontend a way to trigger re-authentication for the regular Discord integration without going through the full integrations page.

## After deploying

The user will need to **reconnect their Discord (regular) integration** since the existing token (`ca_CLVIIXBLidKg`) is expired/invalid. The fix ensures that:
- Both connections are actually tried (fixing the fallback bug)
- Regular Discord OAuth (`ac_BOCrE-Q-yqJu`) is preferred
- Clear error messaging tells the user to reconnect if both fail

## Technical Details

- Lines 116-124: Replace with array dedup (5 lines)
- Line 153: `connectionIdsToUse` instead of `[connectionId, fallbackConnectionId].filter(Boolean)`
- Line 241: Same
- No frontend changes needed
- Deploy the updated edge function
