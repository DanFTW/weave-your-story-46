

## Fix: Force fresh Slack OAuth by signing out first

### Problem
When reconnecting Slack, the browser's cached Slack session cookies cause the OAuth screen to auto-fill the previous workspace. URL parameters like `prompt=consent` or `nonce` only affect the OAuth server behavior, not the browser's cookie store. The only way to guarantee a fresh login screen is to clear the Slack session by visiting `https://slack.com/signout` before starting the OAuth flow.

### Approach
Before navigating to the Slack OAuth URL on reconnect (`forceReauth=true`), first open `https://slack.com/signout` in the same window/popup to clear Slack's session cookies. After a brief delay for the signout to process, redirect that window to the Slack OAuth authorize URL. This gives the user a completely clean workspace/account selection screen.

### Changes (1 file)

**`src/hooks/useComposio.ts`** — Modify the Slack branch in the `connect()` function. When `forceReauth` is true, add a signout-first step before opening the OAuth URL:

- **Median app**: Open `slack.com/signout` in the appbrowser, wait 2 seconds, auto-close it via `median.appbrowser.close()`, then open OAuth URL in a fresh appbrowser.
- **Desktop browser**: Open `slack.com/signout` in a popup window, wait 2 seconds, then navigate that same popup to the OAuth URL (cross-origin navigation of a popup you opened is allowed).
- **Mobile browser**: Attempt the popup approach; if blocked, fall back to direct redirect (current behavior, best-effort).

No edge function changes needed. No other integration flows are touched. The signout step only runs when `forceReauth` is true (i.e., only on "Change Account" reconnect, not initial connect).

```text
Flow: forceReauth=true (reconnect)

  [User taps "Change Account"]
       │
       ▼
  disconnect() — deletes DB record
       │
       ▼
  connect(path, forceReauth=true)
       │
       ▼
  Get OAuth URL from edge function
       │
       ▼
  Open popup/appbrowser → slack.com/signout
       │  (2s delay)
       ▼
  Navigate same window → Slack OAuth URL
       │
       ▼
  User sees fresh workspace/account picker
```

