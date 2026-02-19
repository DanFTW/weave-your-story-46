
# Share Memory Flow — Overhaul Plan

## Summary of Changes Required

1. **Rename CTA**: "Create share link" → "Share memory" on Step 3 footer button
2. **Canonical short URL format**: `https://weave-your-story-46.lovable.app/s/<token>` (base URL read from env/config so it can be updated later without touching code)
3. **Add a `/s/:token` route alias** that redirects to the existing `/shared/:token` handler (no new page needed — the `SharedMemory` component is already correct)
4. **Visibility toggle on Step 2**: "Only invited recipients" vs "Anyone with the link" — replaces the hardcoded microcopy and adds explicit semantics
5. **Post-generation behaviour**:
   - If recipients were added → generate link + notify them (currently recipients are stored but no notification is sent; we add email notification via the edge function)
   - If no recipients → generate link + trigger native Web Share API with pre-filled message
6. **"Skip recipients" microcopy** must reflect the chosen visibility setting rather than defaulting to "anyone can view"

---

## Architecture Decisions

### URL Config
A new `src/config/app.ts` file will export:
```typescript
export const APP_BASE_URL =
  import.meta.env.VITE_APP_BASE_URL ?? "https://weave-your-story-46.lovable.app";
```
This is the single place to change when the domain moves to `weave.cloud`. The `.env` file already exists with Supabase vars; `VITE_APP_BASE_URL` can simply be overridden by setting the env var.

The edge function generates the URL by reading a `APP_BASE_URL` Supabase secret (already manageable via the dashboard) — no hardcoded origin sniffing.

### Short URL Route `/s/:token`
Add a new React Router route `<Route path="/s/:token" element={<SharedMemory />} />` in `App.tsx`. The existing `SharedMemory` component reads `useParams<{ token: string }>()` so it will work immediately with no changes to that component. The route param name matches what `SharedMemory` already expects.

### Visibility (`share_visibility`)
A new piece of local state `visibility: 'recipients_only' | 'anyone'` defaults to `'recipients_only'`. It is:
- Stored client-side only (no DB column needed)
- Passed to the edge function as `visibility` alongside `recipients`
- Displayed in the Step 3 summary card
- The "skip / generate without recipients" microcopy changes based on this value

When `visibility === 'recipients_only'` and no recipients are added, the footer shows a warning instead of allowing progression, **OR** the user can choose to skip and generate a public link (the copy makes this explicit).

### Notification on share creation (when recipients present)
The edge function currently stores recipients in `memory_share_recipients` but sends no notification. We will add a `notify_recipients` flag. When `true`, the edge function sends a simple email notification via Supabase's built-in `auth.admin.generateLink()` or just logs it for now — **however, we do not have an email/SMS secret configured**. The practical approach: the edge function will attempt to use the Supabase Auth admin API to send a magic-link-style email notification, which is already available with `SUPABASE_SERVICE_ROLE_KEY`. This is the correct 2026 pattern — no third-party email service needed for basic transactional email from Supabase.

Actually, on review: Supabase's auth admin `generateLink` can send magic links to existing users, but cannot send arbitrary emails to non-users. For non-users (external recipients), we'd need Resend/SendGrid. Since no email secret is configured, we will **not** add server-side email sending. Instead, the "notification" will be the share URL that is immediately shown and can be shared by the user. The receipt of recipients is already stored for access-control purposes (`Shared with Me` view). This is documented clearly in the UI.

### Native Share Sheet (no recipients)
When 0 recipients are added and user clicks "Share memory", after the link is generated, call:
```typescript
navigator.share({
  title: "Memory shared via Weave",
  text: "Someone shared a memory with you.",
  url: shareUrl,
});
```
Fall back to copy-to-clipboard if `navigator.share` is not available (desktop). This is the correct Web Share API Level 2 pattern.

---

## Files to Create / Modify

| File | Action | Summary |
|---|---|---|
| `src/config/app.ts` | **Create** | Single source of truth for `APP_BASE_URL` |
| `src/App.tsx` | **Modify** | Add `/s/:token` route alias |
| `src/components/memories/ShareMemoryModal.tsx` | **Modify** | Add visibility toggle, update CTA copy, update microcopy, add native share behaviour, use `APP_BASE_URL` |
| `supabase/functions/memory-share/index.ts` | **Modify** | Use `APP_BASE_URL` env secret for URL generation; format as `/s/<token>` |

No DB migration needed. No new edge function.

---

## Detailed Change Breakdown

### 1. `src/config/app.ts` (new)
```typescript
/**
 * Central app configuration.
 * Override VITE_APP_BASE_URL in your environment to change the base URL
 * (e.g., when migrating from weave-your-story-46.lovable.app to weave.cloud).
 */
export const APP_BASE_URL =
  (import.meta.env.VITE_APP_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "https://weave-your-story-46.lovable.app";

/**
 * Build a canonical short share URL for a given token.
 * Format: <APP_BASE_URL>/s/<token>
 */
export function buildShareUrl(token: string): string {
  return `${APP_BASE_URL}/s/${token}`;
}
```

### 2. `src/App.tsx`
Add one new route before the wildcard:
```tsx
<Route path="/s/:token" element={<SharedMemory />} />
```
The `SharedMemory` component reads `useParams<{ token }>()` so this works instantly with zero changes to that component.

### 3. `supabase/functions/memory-share/index.ts`
Replace the URL-building logic:
```typescript
// OLD (fragile — uses request origin or hardcoded fallback)
const origin = req.headers.get("origin") || "https://weave-your-story-46.lovable.app";
const shareUrl = `${origin}/shared/${shareToken}`;

// NEW (reads from Supabase secret, clean /s/ short path)
const APP_BASE_URL =
  (Deno.env.get("APP_BASE_URL") ?? "https://weave-your-story-46.lovable.app").replace(/\/$/, "");
const shareUrl = `${APP_BASE_URL}/s/${shareToken}`;
```
We'll also add the `APP_BASE_URL` Supabase secret so it can be updated without a code redeploy.

### 4. `src/components/memories/ShareMemoryModal.tsx`
Changes by section:

**A. New state (Step 2)**
```typescript
type Visibility = 'recipients_only' | 'anyone';
const [visibility, setVisibility] = useState<Visibility>('recipients_only');
```

**B. Visibility toggle UI (Step 2, below heading)**
A pill-style `SegmentedControl` component (inline, not extracted — keep it local):
- "Only invited recipients" → lock icon
- "Anyone with the link" → globe icon
- Style: `bg-muted rounded-xl p-1 flex gap-1` with `framer-motion` layout animation for the active segment

**C. "Skip recipients" microcopy**
The empty-state dashed box text changes dynamically:
- `visibility === 'recipients_only'` → "No recipients added. Add emails above to restrict access."
- `visibility === 'anyone'` → "No recipients added. Anyone with the link will be able to view this."

**D. Step 3 summary card**
Add a "Visibility" row that shows "Only invited recipients" or "Anyone with the link" with appropriate icon.

**E. CTA button (Step 3 footer, pre-generate state)**
```tsx
// OLD
<>
  <Link className="mr-1.5 h-4 w-4" />
  Create share link
</>

// NEW
<>
  <Share2 className="mr-1.5 h-4 w-4" />
  {isCreating ? "Sharing…" : "Share memory"}
</>
```

**F. Post-generation behaviour**
After `setShareUrl(result.share_url)` and `setStep(3)`:
```typescript
// If no recipients, trigger native share sheet
if (recipients.length === 0) {
  const shareUrl = result.share_url;
  if (typeof navigator.share === 'function') {
    // Small delay so the modal transitions to step 3 first
    setTimeout(() => {
      navigator.share({
        title: 'Memory shared via Weave',
        text: `${user?.name ?? 'Someone'} shared a memory with you`,
        url: shareUrl,
      }).catch(() => {
        // User dismissed or share failed — already showing the URL in UI
      });
    }, 400);
  }
  // If navigator.share unavailable (desktop), the copy button on step 3 is the fallback
}
```

**G. Step 3 success state microcopy**
Update the subtitle: currently says "Anyone with this link can view the shared memory." → dynamically reflect visibility:
- `recipients_only`: "Only the {N} invited recipient(s) can view this memory."
- `anyone`: "Anyone with this link can view the shared memory."

**H. Reset on close**
Add `setVisibility('recipients_only')` to the reset block in `handleOpenChange`.

**I. Pass `visibility` to edge function**
```typescript
body: JSON.stringify({
  action: "create",
  memory_id: memory.id,
  share_scope: scope,
  custom_condition: scope === "custom" ? customCondition : undefined,
  thread_tag: scope === "thread" ? threadTag : undefined,
  recipients,
  visibility, // 'recipients_only' | 'anyone'
}),
```
The edge function receives but does not currently use `visibility` for access-control (the existing RLS already handles this via `memory_share_recipients`). We store it for future use — this is forward-compatible.

---

## What We Are NOT Doing (Scope Boundaries)
- Not adding email/SMS transactional sends (no email secret configured; would require Resend/SendGrid)
- Not modifying the `SharedMemory` page (already correct)
- Not adding DB columns (no migration needed)
- Not changing any other feature or page

---

## Edge Function: `APP_BASE_URL` Secret
We need to add `APP_BASE_URL` as a Supabase secret so the edge function builds the correct short URL. The value will be `https://weave-your-story-46.lovable.app`. This can be updated to `https://weave.cloud` later via the Supabase secrets dashboard without touching any code.
