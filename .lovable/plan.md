

## Problem

The `searchTwitterUser` function in `supabase/functions/twitter-alpha-tracker/index.ts` silently returns `null` when searching for users. Two issues:

1. **No response logging**: The function logs "Searching for Twitter user" but never logs the Composio API response body, making it impossible to diagnose why parsing fails.

2. **Incomplete response parsing**: The composio-callback file shows the working pattern for Twitter profile parsing is `result.data || result.response_data || result` then `data.data || data`. The `searchTwitterUser` function uses a different pattern with `possiblePaths` that may miss certain response structures.

3. **No error-in-body detection**: Composio can return HTTP 200 with an error JSON body (e.g., expired connection). The function only checks `response.ok` but doesn't inspect the body for `error` fields, so it silently returns null instead of surfacing the issue.

## Fix (single file: `supabase/functions/twitter-alpha-tracker/index.ts`)

Update the `searchTwitterUser` function (~lines 125-181):

1. **Log the raw response body** for debugging (first 1000 chars).

2. **Check for error in response body** before parsing user data. If `data.error` exists, log it and return null.

3. **Align parsing with the proven pattern** from composio-callback:
   ```
   const result = JSON.parse(responseText);
   const data = result.data || result.response_data || result;
   const userData = data.response_data?.data || data.data || data;
   ```
   Then check `userData.username || userData.id` to confirm valid user data.

This matches the exact pattern that works in `composio-callback/index.ts` for `TWITTER_USER_LOOKUP_ME`, and adds visibility into what Composio actually returns.

