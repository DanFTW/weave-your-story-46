We found the real root cause of the Facebook memory bug. Do not touch auth, scopes, page access, reconnect logic, Graph API fetching, or frontend memory rendering **except for the minimal Facebook-specific metadata enrichment needed to display the reference URL as secondary metadata rather than primary content**.

Confirmed diagnosis:

- facebook-sync is fetching page posts correctly
- post.message is present
- the LIAM create request currently sends a mixed freeform content blob that includes both:
  - the actual Facebook post text
  - a metadata footer with URL / Post ID / Source
- LIAM is fragmenting that blob and returning metadata-only lines as memories, which is why the memories page shows URL / Post ID instead of the original post text

Goal:  
For Facebook memories, send only the actual post text to LIAM. Do not include URL, Post ID, or source footer inside the LIAM content field. **However, preserve the Facebook URL/Post ID as reference metadata and display that reference separately in the product, not as the main memory body.**

Required changes:

1. In `supabase/functions/facebook-sync/index.ts`
  - update `formatPostAsMemory()` so it returns only `post.message.trim()`
  - keep the existing skip for posts with no message
  - do not append any metadata footer to the LIAM content
2. Preserve Facebook metadata outside LIAM content
  - keep or add URL / post ID storage in Supabase only, using `facebook_synced_posts` or a related structure if needed
  - do not send URL / post ID / source lines in the LIAM `content` field
  - **make sure this metadata remains available to the app as proof/reference for each Facebook memory**
3. Apply the same fix to `facebook-page-posts`
  - that flow should also send only the post text to LIAM
  - remove in-band metadata formatting there too
  - skip no-message posts there as well
4. Make the smallest possible changes
  - do not modify unrelated flows
  - do not refactor unrelated code
  - do not change the Facebook auth/integration behavior
  - **only add the smallest safe Facebook-specific UI/data enrichment needed so the reference URL can still be shown separately from the main memory text**
5. After the change, report back with:
  - exact files changed
  - exact root cause
  - before/after LIAM content example for a post with message `test 5`
  - whether any metadata is still sent to LIAM content (it should not be)
  - **how the Facebook URL/Post ID is preserved and where it is now displayed as secondary reference metadata**

Also, if the `/memories` page is currently using `transactionNumber` alone as a React key, fix the duplicate key warning with the smallest safe change, since LIAM can return multiple rows for the same transaction. Treat that as a separate UI fix, not part of the Facebook content bug.