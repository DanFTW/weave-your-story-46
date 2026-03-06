

## Plan: Add `INSTAGRAM` tag to analytics memory creation

**Single change** in `supabase/functions/instagram-analytics-poll/index.ts`:

1. **Line 68**: Add `tag: "INSTAGRAM"` to the LIAM API body:
   ```typescript
   const body = { userKey: apiKeys.user_key, content, tag: "INSTAGRAM" };
   ```

That's it. No signature change, no frontend changes, no new tag type. The `signRequest` function signs the full body object, so the tag will be included in the signature automatically.

2. **Redeploy** `instagram-analytics-poll` and verify with a test invocation.

This reuses the exact same tag the working `instagram-sync` flow uses, so new analytics memories will render with the existing Instagram icon/gradient/label.

