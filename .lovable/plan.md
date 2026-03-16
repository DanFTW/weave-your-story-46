

## Problem

The hardcoded Twitter auth config `ac_5uSLoTdeFuN6` does not exist in Composio (returns `Auth_Config_NotFound`). The dynamic fallback picks `ac_ZdV9hvrxwmJa` (first in the list by creation date), but that config's underlying Twitter app credentials cause the OAuth consent screen to fail with "Something went wrong. You weren't able to give access to the App."

From the Composio API logs, there are 6 Twitter auth configs available. The memory registry lists `ac_Fws-kT1Rb6Yn` as the correct Twitter config, and it uses a different set of Twitter app credentials (client_id starting with `emJySjR...`) than the failing fallback. It has 11 active connections, confirming it works.

## Fix

Single change in `supabase/functions/composio-connect/index.ts`, line 151:

```
twitter: "ac_5uSLoTdeFuN6"  →  twitter: "ac_Fws-kT1Rb6Yn"
```

This matches the auth config registry in project memory and uses Twitter app credentials that are properly enrolled for v2 API access. With a valid hardcoded ID, the fallback path will not be triggered, and OAuth will complete successfully.

Redeploy the edge function after the change.

