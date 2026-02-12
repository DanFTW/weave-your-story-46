#  Fix Google Drive Icon and Account Card

## Problem 1: "G" Fallback Instead of Google Drive Logo

**Root cause**: `IntegrationLargeIcon.tsx` (used on the detail page header) does not have `googledrive` in its `iconImages` map, even though `IntegrationIcon.tsx` (used on the list page) does. This causes the large icon to render the "G" text fallback.

Additionally, the current `googledrive.svg` is a monochrome blue shape -- it should be the official multicolor Google Drive triangle logo.

**Fix**:

- Replace `src/assets/integrations/googledrive.svg` with the official multicolor Google Drive logo (sourced from Simple Icons / official brand assets, rendered with the four brand colors: blue #4285F4, green #0F9D58, yellow #F4B400, red #EA4335)
- Add the `googledrive` import and map entry to `IntegrationLargeIcon.tsx` (lines 51 and 105)

## Problem 2: Account Card Shows "Connected Account" Instead of User's Name

**Root cause**: The database has `account_name = NULL` for the googledrive integration. The `fetchGoogleDocsProfile` function in `composio-callback/index.ts` fetches Google's userinfo endpoint and reads `userinfo.name`, but that field was null in the API response. Google's userinfo v3 API also returns `given_name` and `family_name` as separate fields, which the code does not check as a fallback.

The `IntegrationDetail.tsx` then renders `connectedAccount.name || "Connected Account"` -- since name is empty string (from `integration.account_name || ""`), it shows the fallback.

**Fix**:

- In `composio-callback/index.ts`, update the `fetchGoogleDocsProfile` function (around line 432) to construct the name from `given_name` + `family_name` when `name` is null
- This fix benefits all Google integrations (Docs, Photos, Drive, YouTube, etc.) since they all use this shared function

## Files to Modify

1. `src/assets/integrations/googledrive.svg` -- Replace with official multicolor Google Drive logo
2. `src/components/integrations/IntegrationLargeIcon.tsx` -- Add googledrive import and map entry
3. `supabase/functions/composio-callback/index.ts` -- Add `given_name`/`family_name` fallback in `fetchGoogleDocsProfile`

## Technical Details

### IntegrationLargeIcon.tsx changes

```typescript
// Add import (after line 50)
import googledriveIcon from "@/assets/integrations/googledrive.svg";

// Add to iconImages map (after line 104)
googledrive: googledriveIcon,

```

### composio-callback/index.ts change (line ~432)

```typescript
return {
  email: userinfo.email || null,
  name: userinfo.name || 
    [userinfo.given_name, userinfo.family_name].filter(Boolean).join(" ") || 
    null,
  avatarUrl: userinfo.picture || null,
};

```

### googledrive.svg

Replace monochrome SVG with official multicolor Google Drive triangle logo using brand colors (#4285F4, #0F9D58, #F4B400, #EA4335).

## Note on Existing Data

After deploying the callback fix, the user will need to reconnect (or "Change" account) to re-trigger the profile fetch and populate the name field. Alternatively, a one-time DB update can set the name for the existing record.

---

## Suggestions (only additions)

1. **Fix the “name becomes empty string” logic gap at the source**

- In the code where you map DB → `connectedAccount`, do **not** coerce null to `""` (e.g. avoid `integration.account_name || ""`). Keep it `null` so your UI logic can correctly distinguish “missing” vs “present”. This prevents weird fallthrough behavior and keeps the data model clean.

2. **If** `userinfo.name` **is null, it’s often a scope/config issue**

- If you still see missing `name/picture`, ensure the Composio auth config for Google Drive includes Google profile scopes (profile/email or equivalent). Otherwise you’ll “fix” fallbacks but still get no data.

3. **Make the icon mapping impossible to drift again**

- Minimal modularity tweak: export a single `iconImages` map used by both `IntegrationIcon.tsx` and `IntegrationLargeIcon.tsx` (one shared module), so you never fix one and forget the other.