# Fix Slack Integration: Icon + OAuth Connection

## Problem 1: Missing Slack Icon on /integrations

`IntegrationIcon.tsx` imports the `slack.png` asset but **never adds it to the** `iconImages` **map**. The lookup `iconImages["slack"]` returns `undefined`, triggering the fallback "S" letter placeholder.

### Fix

Add `slack: slackIcon` to the `iconImages` map in `IntegrationIcon.tsx` (after `googledrive` on line 106).

---

## Problem 2: OAuth Redirect Blocked in Iframe

The Composio API call succeeds and returns a valid redirect URL. However, Slack's OAuth page sets `X-Frame-Options: DENY`, which prevents it from loading inside the Lovable preview iframe.

The current `useComposio.ts` desktop flow:

1. Tries `window.open(url, '_blank', 'width=600,height=700')` -- this can be blocked by browsers when called from within an iframe
2. If popup fails, falls back to `window.top.location.assign(url)` -- this navigates the top-level Lovable editor away, which is undesirable, or gets blocked by frame security

### Fix

Update the desktop popup fallback in `useComposio.ts` to always attempt `window.open` without popup dimensions first (which opens a new tab instead of a popup window -- less likely to be blocked), and only fall back to `window.top` navigation as last resort.

**File:** `src/hooks/useComposio.ts` (lines 204-’215)

Change the desktop branch to:

```typescript
} else {
  // Desktop - try new tab first (less likely to be blocked than popup)
  const popup = window.open(data.redirectUrl, '_blank');

  if (!popup || popup.closed) {
    console.log("New tab blocked, trying popup window...");
    const popupWindow = window.open(
      data.redirectUrl, 'oauth_popup', 'width=600,height=700'
    );

    if (!popupWindow || popupWindow.closed) {
      console.log("All popups blocked, using top-level redirect");
      stopPolling();
      const targetWindow = window.top || window;
      targetWindow.location.assign(data.redirectUrl);
    }
  }
}

```

This tries a plain new tab first (which browsers are more permissive about), then falls back to a sized popup, then finally to top-level navigation.

---

## Files Modified


| File                                              | Change                                                      |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `src/components/integrations/IntegrationIcon.tsx` | Add `slack: slackIcon` to iconImages map                    |
| `src/hooks/useComposio.ts`                        | Improve desktop OAuth redirect to prefer new tab over popup |


No backend or edge function changes needed. The Composio connect flow and auth config (`ac_H9kYZsVaw_gS`) are working correctly.

---

## Suggestion (only)

Replace the last line with the correct Slack auth config id you provided earlier:

- Replace `ac_H9kYZsVaw_gS` with `ac_BOCrE-Q-yqJu`