Fix: Google Calendar Connected Account Missing Name & Avatar Display

Root Cause The database row for `googlecalendar` has `account_name = NULL` while `account_email` and `account_avatar_url` are populated. This means:

1. The `fetchGoogleDocsProfile` function successfully called Google userinfo but the `name` field came back null (possibly the Google account doesn't expose a name, or the response structure differed).
2. The `IntegrationConnectedAccount` component receives `name="Connected Account"` (fallback from line 218) and shows a "C" initial instead of the avatar photo. Looking at the DB: `account_avatar_url` IS populated (`https://lh3.googleusercontent.com/...`), so the avatar should display. The component already handles avatar rendering. The real issue is likely that the `name` fallback of `"Connected Account"` is masking the actual problem — let me re-check the component logic... The component shows the avatar image when `avatarUrl` is provided and no image error occurs. So the avatar should be showing. Wait — the user says it shows the user's name but no profile picture. The uploaded image shows a green circle with "D" initial — meaning the avatar URL is failing to load (triggering `onError` → `setImageError(true)` → fallback initials). The Google avatar URL may be expired or require a fresh token. Also `account_name` is null, so the name shown is "Connected Account" and the email is used to derive the "D" initial.

Two issues to fix: Issue 1: Null `account_name` — The callback edge function needs to better extract the name. The Google userinfo endpoint returns `name`, `given_name`, `family_name`. If `name` was null, we should fall back to constructing from given/family name, or use the email prefix. Issue 2: Stale avatar URL — Google profile picture URLs from `lh3.googleusercontent.com` can expire. Handle the error gracefully by deriving initials from the email when name is missing.

Changes

1. `supabase/functions/composio-callback/index.ts` (lines 2888-2910) — add a fallback: if `accountName` is still empty but `accountEmail` is available, derive the name from the email (e.g., `daniel@weave.cloud` → `Daniel`).
2. `src/components/integrations/IntegrationConnectedAccount.tsx` — when `name` is a generic fallback like "Connected Account" and `email` is available, derive initials from the email instead.
3. Also run this SQL in Supabase to fix the existing null name immediately without requiring reconnection:

```sql
UPDATE user_integrations 
SET account_name = split_part(account_email, '@', 1)
WHERE integration_id = 'googlecalendar' AND account_name IS NULL AND account_email IS NOT NULL;

```

Do not make any other changes to the codebase that are not directly related to this fix.

---