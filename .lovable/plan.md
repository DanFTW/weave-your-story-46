

# Fix: Share Links Returning 404

## Root Cause

The share URL is generated **server-side** in the `memory-share` edge function (line 13), which hardcodes `APP_BASE_URL` to `https://weave-your-story-46.lovable.app`. This means every share link points to the **published site**, which may not have the latest deployed frontend code containing the `/s/:token` route.

The route `/s/:token` exists in `App.tsx` (line 69) and works correctly in the preview environment. The 404 only occurs on the published site because it hasn't been re-published with the latest code.

However, even after re-publishing, this architecture is fragile: the URL is always the published URL, so testing in preview always generates links that point elsewhere.

## Fix

**1. `src/config/app.ts`** -- Use `window.location.origin` as the default instead of hardcoding the published URL. This ensures share links always point to the current environment (preview or published).

```typescript
export const APP_BASE_URL =
  ((import.meta.env.VITE_APP_BASE_URL as string | undefined) ?? window.location.origin)
    .replace(/\/$/, "");
```

**2. `src/components/memories/ShareMemoryModal.tsx`** -- Override the server-returned `share_url` with the client-side `buildShareUrl()` so the link always uses the current origin.

On the line where `generatedUrl` is set from `result.share_url`, replace it with a client-side construction using the token extracted from the server response:

```typescript
import { buildShareUrl } from "@/config/app";

// After receiving result from edge function:
const serverUrl: string = result.share_url;
const tokenFromUrl = serverUrl.split("/s/").pop() ?? "";
const generatedUrl = buildShareUrl(tokenFromUrl);
```

This ensures the copied/shared link always uses `window.location.origin`, pointing to whichever environment the user is currently on.

## What NOT to change

- No edge function changes (server URL is only used for emails, which should point to the published site)
- No route changes (the `/s/:token` route is already correctly defined)
- No database changes

## Important: Publish Required

After this fix is implemented, the app **must be re-published** so the published site has the `/s/:token` route and the SPA `_redirects` catch-all takes effect.

## Technical Details

| File | Change |
|---|---|
| `src/config/app.ts` | Default `APP_BASE_URL` to `window.location.origin` instead of hardcoded published URL |
| `src/components/memories/ShareMemoryModal.tsx` | Import `buildShareUrl`, use client-side URL instead of server-returned URL |

