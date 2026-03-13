

## Plan: Add Slack API Error Logging

Modify `supabase/functions/slack-messages-sync/index.ts` to add a `console.error` log inside the `slackApi` helper function that prints the full Slack API response body whenever `result.ok` is `false`.

### Changes to `slack-messages-sync/index.ts`

**Location:** Inside the `slackApi` function (lines 65-86), after parsing the JSON response.

**Action:** Add a check for `!result.ok` and log the full response body with a descriptive message including the method name.

**Code change:**
- After `return resp.json()` in both the GET and POST branches, store the result in a variable
- Check if `!result.ok` and call `console.error` with the full response body
- Return the result as before

This will catch errors from:
- `conversations.list` (list-channels action)
- `conversations.history` (poll action)
- `search.all` (search action)
- Any future Slack API calls

