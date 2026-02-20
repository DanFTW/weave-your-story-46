

# Fix: Share Links Pointing to Preview URL Instead of Published App

## Root Cause

Share links are generated using `window.location.origin` (via `buildShareUrl()` in `src/config/app.ts`). When you create a share link while using the preview environment, the link contains the preview domain (e.g., `https://id-preview--....lovable.app/s/abc123`). This preview domain is behind Lovable's own authentication wall, so recipients see Lovable's sign-in page instead of your Weave app.

## Fix

Set `VITE_APP_BASE_URL` in the `.env` file to your published URL. This ensures all generated share links always point to the public-facing app, regardless of which environment you're using.

### File: `.env`

Add this line:

```
VITE_APP_BASE_URL=https://weave-your-story-46.lovable.app
```

This single change is all that's needed. The existing code in `src/config/app.ts` already reads this variable:

```typescript
export const APP_BASE_URL =
  ((import.meta.env.VITE_APP_BASE_URL as string | undefined) ?? window.location.origin)
    .replace(/\/$/, "");
```

And `buildShareUrl()` already uses it to construct links:

```typescript
export function buildShareUrl(token: string): string {
  return `${APP_BASE_URL}/s/${token}`;
}
```

## Why This Works

- Share links will always be `https://weave-your-story-46.lovable.app/s/<token>` -- the published domain has no Lovable auth wall
- The published app has `public/_redirects` with a catch-all rule, so `/s/:token` deep links load the SPA correctly
- `SharedMemory.tsx` renders on that route without `ProtectedRoute`, showing the landing card to unauthenticated users
- The "Sign in to view" button navigates to `/login?redirect=/s/<token>`, keeping them in your Weave app

## No Other Changes Needed

The routing (`App.tsx`), the `SharedMemory.tsx` component, and the `Login.tsx` redirect handling are all working correctly. The only issue was the link origin.

