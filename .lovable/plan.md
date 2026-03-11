## Diagnosis

The Apify actor `dev_fusion/linkedin-profile-scraper` returns a **200 OK** response even when there's an error. The actual response body is:

```json
[{"error": "❌ Users on the free Apify plan can run the actor through the UI and not via other methods."}]

```

The edge function doesn't check for an `error` field in the profile object, so it falls through to the raw extraction fallback, which captures the error string as "content". Then `generate-memories` receives an error message instead of profile data and returns zero memories, triggering the "Could not extract any memories" toast.

## Root Cause

**The** `APIFY_TOKEN` **is on a free Apify plan**, which does not allow API-based actor execution. This is an account-level limitation. The code fix below will surface this clearly, but **the token must be upgraded to a paid Apify plan** for the feature to work.

## Code Fix

**File:** `supabase/functions/linkedin-profile-scrape/index.ts`

Add an error-field check immediately after parsing the Apify response (after line 57, before field extraction):

```typescript
// After: const profile = profiles[0];
// Add check for Apify-level errors returned as data
if (profile.error) {
  console.error('Apify actor error:', profile.error);
  throw new Error(typeof profile.error === 'string' ? profile.error : 'Apify actor returned an error');
}

```

This is the minimum change needed. It follows the same pattern used by the existing error checks in the function (lines 40-44) and surfaces the actual Apify error message to the user via the existing toast flow in the hook.

## Required Action (Non-Code)

Upgrade the Apify account associated with the `APIFY_TOKEN` secret to a paid plan. Free-tier tokens cannot invoke actors via the API — only through the Apify web UI.