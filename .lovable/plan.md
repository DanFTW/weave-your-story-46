
# Fix: Share Link Not Being Generated

## Root Cause (Confirmed via Logs)

The `memory-share` edge function is returning **401** on every call from the app. The analytics logs show this clearly.

The cause is **not** in the edge function auth logic itself — that is already correctly using `getUser(token)`. The cause is in how the frontend **calls** the function.

`ShareMemoryModal.tsx` uses a raw `fetch()` call instead of `supabase.functions.invoke()`:

```typescript
// CURRENT (broken) — raw fetch with manually built URL
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const functionUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/memory-share`;

const response = await fetch(functionUrl, {
  headers: { Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({ action: "create", ... })
});
```

The problem: `supabase.auth.getSession()` can return a **stale or null session** in certain race conditions (e.g., tab restored from background, token still refreshing). When `accessToken` is null or expired, the function rejects with 401. Every other hook in the codebase uses `supabase.functions.invoke()` which handles session refresh automatically before the call.

## The Fix — 2 Files Only

### 1. `src/components/memories/ShareMemoryModal.tsx`

Replace the raw `fetch` in `handleCreateShare` with `supabase.functions.invoke("memory-share", { body: { ... } })`. This is the same pattern used by all 22 other hook files. The Supabase JS client automatically:
- Gets the current session (refreshing it if expired)  
- Attaches the correct `Authorization` header  
- Points to the right function URL

```typescript
// FIXED — use supabase SDK, identical to all other hooks
const { data: result, error: fnError } = await supabase.functions.invoke("memory-share", {
  body: {
    action: "create",
    memory_id: memory.id,
    share_scope: scope,
    custom_condition: scope === "custom" ? customCondition : undefined,
    thread_tag: scope === "thread" ? threadTag : undefined,
    recipients,
    visibility,
  },
});

if (fnError) throw fnError;
```

This removes the `getSession()` call, the manual URL construction, and the manual `Authorization` header — simplifying the code considerably.

### 2. `supabase/functions/memory-share/index.ts` — No changes needed

The auth logic there (`getUser(token)`) is already correct. The 401s were coming from the frontend sending no/bad token, not from the JWT verification failing.

## What Changes

| What | Before | After |
|---|---|---|
| How the function is called | Raw `fetch()` with `import.meta.env` URL | `supabase.functions.invoke()` |
| Auth token source | `getSession()` → may return stale/null | SDK auto-refreshes session |
| Session check | Manual `if (!accessToken)` guard | Handled by SDK |
| Code complexity | 30 lines | 15 lines |

## What Will Work After

- Tapping "Create Share Link" on Step 3 always succeeds and shows the `/s/<token>` link
- The copy button and "Share via..." native sheet work as expected
- On iOS Safari, the Contacts picker (already implemented) continues to work
- Resend email delivery (already in the edge function) fires for any added recipients when the key is present
- No DB or migration changes required
