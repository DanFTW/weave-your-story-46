&nbsp;

**Fix: Shared Memory Not Appearing After Sign-In**

&nbsp;

**Problem**

&nbsp;

After a recipient signs in via a share link’s “View in app” button, they land on the Memories page “Shared with Me” tab and see “No shared memories yet” plus an error toast “Failed to load memories.”

&nbsp;

**Root Causes**

&nbsp;

**1. The resolve action never registers the visitor as a recipient**

&nbsp;

The memory-share edge function’s resolve action only looks up the share metadata and returns it. It does NOT insert the visiting user into memory_share_recipients. Database query confirms: the latest shares have zero recipient rows. So useSharedWithMe (which queries memory_share_recipients) will always return empty for anyone visiting via a link-only share.

&nbsp;

**2. Race condition in Memories.tsx**

&nbsp;

The pendingShareToken effect runs on mount with empty deps []. It calls supabase.auth.getSession() (works), then calls fetchShared(). But fetchShared internally checks if (!user) return – where user comes from useAuth() state. The auth state listener is async and may not have set user yet when this effect fires, so fetchShared() silently returns without fetching.

&nbsp;

**3. Error toast from own-memories fetch**

&nbsp;

The page always fetches the user’s own memories on mount via liam-memory. If the recipient has no LIAM API keys configured, this fails with a 400 error and shows a distracting “Failed to load memories” toast – even though the user only cares about shared content.

&nbsp;

**Fix**

&nbsp;

**File 1: supabase/functions/memory-share/index.ts**

&nbsp;

In the resolve action, when the request includes an Authorization header:

• **Verify the auth session via Supabase (auth.getUser()) instead of decoding the JWT manually**

• Upsert the user into memory_share_recipients so they appear in the “Shared with Me” tab

&nbsp;

This is a ~15-line addition inside the existing resolve block, after the share is looked up and validated. It uses the existing adminClient to bypass RLS, and uses an upsert (ON CONFLICT DO NOTHING pattern) to avoid duplicates.

&nbsp;

**Additional best-practice adjustment:** Use a user-scoped Supabase client (anon key + forwarded Authorization header) to call auth.getUser() and obtain a verified user.id/email, rather than trusting unverified JWT payload decoding.

&nbsp;

**File 2: src/pages/Memories.tsx**

&nbsp;

Fix the pendingShareToken effect:

• Add user from useAuth() as a dependency so the effect re-runs once auth state is available

• Guard on user being truthy instead of manually calling getSession()

• **Do not run the own-memories fetch at all when the view is shared (not just suppressing the toast)**

• Suppress the own-memories error toast when the view is shared (the user doesn’t need LIAM API keys to view shared content)

&nbsp;

**Additional best-practice adjustment:** Ensure own-memory queries/hooks are conditionally disabled in shared view (e.g., React Query enabled: view !== 'shared') to prevent unnecessary calls and UI error bleed-through.

&nbsp;

**File 3: src/hooks/useSharedWithMe.ts**

&nbsp;

Minor fix: the fetch function depends on user being set. When called from the pendingShareToken effect, the hook’s user may still be null. Accept an optional override session parameter so the caller can bypass the !user guard.

&nbsp;

**Technical Details**

&nbsp;

**Edge function change (resolve action)**

&nbsp;

After validating the share token and before returning the response:

&nbsp;

1. Check for Authorization header

2. If present, use a user-scoped Supabase client to call auth.getUser() and obtain verified user_id (sub) and email

3. Upsert into memory_share_recipients:

   - share_id = [shareData.id](http://shareData.id)

   - recipient_user_id = userId

   - recipient_email = email

   - ON CONFLICT (share_id, recipient_email) DO UPDATE SET recipient_user_id = userId

&nbsp;

**Memories.tsx change**

&nbsp;

Replace the pendingShareToken useEffect:

- Depend on [user] instead of []

- Guard: if (!pendingToken || !user) return

- Remove manual getSession() call

- After resolve succeeds, call fetchShared() directly

&nbsp;

Additionally:

- Disable / do not invoke own-memories fetching logic when view === 'shared' (prefer query-level enable/disable)

- Keep suppression of the own-memories error toast when view is 'shared' as a safety net

&nbsp;

**Files Changed**

&nbsp;

**File** **Change**

supabase/functions/memory-share/index.ts Auto-register authenticated visitor as recipient in the resolve action (using verified auth.getUser() instead of JWT decode)

src/pages/Memories.tsx Fix race condition by depending on user; disable own-memory fetches on shared view; suppress own-memory errors on shared view

src/hooks/useSharedWithMe.ts Optional session override to avoid !user guard timing edge case (or keep as-is if the race fix fully resolves it)