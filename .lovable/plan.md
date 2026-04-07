

## Fix: "Get Started" button on `/thread/email-text-alert`

### Problem
The `flowEnabledThreads` whitelist in `src/pages/ThreadOverview.tsx` (line 36) does not include `'email-text-alert'`, so the `handleGetStarted` handler falls through to a console.log instead of navigating to `/flow/email-text-alert`.

### Solution
Add `'email-text-alert'` to the `flowEnabledThreads` array on line 36 of `src/pages/ThreadOverview.tsx`.

### Files changed
- `src/pages/ThreadOverview.tsx` — append `'email-text-alert'` to the whitelist array (1 string added, no other changes).

