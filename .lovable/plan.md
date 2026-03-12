

## Analysis

The code in `OAuthComplete.tsx` already has a Slack-specific branch (lines 82-135) that checks for `code` + `state` starting with `slack_`. However, the user reports the console shows `connectionId = null, toolkit = null` (logged at line 146), meaning the Slack branch at line 87 evaluates to `false` despite the URL containing the correct params.

Looking at the Slack detection:
```ts
const slackCode = searchParams.get("code");
const stateParam = searchParams.get("state");
const isSlackCallback = slackCode && stateParam?.startsWith("slack_");
```

The most likely cause is a **build/deploy mismatch** — the published URL may be serving an older build that doesn't include the Slack branch added in the previous edit. The code in the repo is correct.

## Plan (single file: `src/pages/OAuthComplete.tsx`)

1. **Add diagnostic logging** before the Slack branch to log `slackCode`, `stateParam`, and `isSlackCallback` values — this will confirm whether the detection logic is actually running or if an older build is being served.

2. **Make the Slack detection more defensive** — add a fallback that also checks if `state` contains `"slack"` (case-insensitive) in case of any encoding edge case:
   ```ts
   const isSlackCallback = slackCode && (
     stateParam?.startsWith("slack_") || 
     stateParam?.toLowerCase().includes("slack")
   );
   ```

3. **Force a rebuild** to ensure the published URL picks up the latest code.

No other files will be changed. The Composio path remains untouched.

