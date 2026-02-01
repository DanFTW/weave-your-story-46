
# Fix Instagram Live Automatic Monitoring

## Root Cause Analysis

I identified **three critical issues** preventing automatic Instagram monitoring:

| Issue | Root Cause | Impact |
|-------|------------|--------|
| No automatic polling | No pg_cron job exists for Instagram automation | Posts only captured when "Check Now" clicked manually |
| Memory creation fails | Private key parsing uses wrong PEM header format | `InvalidCharacterError: Failed to decode base64` |
| Content not preserved | Missing hybrid storage pattern | LIAM tokenizes content, losing original post data |

### Evidence from Edge Function Logs

```
Error creating memory: InvalidCharacterError: Failed to decode base64
    at atob (ext:deno_web/05_base64.js:28:12)
    at importPrivateKey (instagram-automation-poll/index.ts:65:37)
```

The `importPrivateKey` function expects `-----BEGIN EC PRIVATE KEY-----` but the stored key uses `-----BEGIN PRIVATE KEY-----` (PKCS#8 format).

## Solution Overview

1. **Create pg_cron job** - Schedule automatic polling every 5 minutes (matching other automation patterns)
2. **Fix private key parsing** - Update to handle PKCS#8 format like other working edge functions
3. **Add hybrid storage** - Store posts in `instagram_synced_post_content` table during automation (matching the sync pattern we just implemented)

---

## Technical Implementation

### 1. Database Migration: Add pg_cron Job

Create a new migration to schedule the Instagram automation polling:

```sql
-- First try to unschedule if exists
DO $$
BEGIN
  PERFORM cron.unschedule('instagram-automation-poll');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- Schedule the cron job to run every 5 minutes
SELECT cron.schedule(
  'instagram-automation-poll',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yatadupadielakuenxui.supabase.co/functions/v1/instagram-automation-poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', COALESCE((SELECT value FROM public.app_settings WHERE key = 'cron_secret'), '')
    ),
    body := '{"action": "cron-poll"}'::jsonb
  ) AS request_id;
  $$
);
```

### 2. Fix Edge Function: `instagram-automation-poll/index.ts`

Update the `importPrivateKey` function to match the working pattern from `twitter-alpha-tracker`:

```typescript
// BEFORE (broken)
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContents = pemKey
    .replace(/-----BEGIN EC PRIVATE KEY-----/g, "")  // Wrong header!
    .replace(/-----END EC PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  // ...
}

// AFTER (fixed - handles PKCS#8 format)
async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  const cleanKey = base64Key
    .replace(/-----BEGIN.*-----/g, '')   // Handles any PEM format
    .replace(/-----END.*-----/g, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(cleanKey), c => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}
```

### 3. Add Hybrid Storage to Edge Function

Store each post in `instagram_synced_post_content` during automation (matching the sync pattern):

```typescript
// After creating LIAM memory, store locally for reliable display
async function storePostLocally(
  supabase: any, 
  userId: string, 
  post: InstagramPost,
  imageUrl: string | null
): Promise<void> {
  await supabase.from('instagram_synced_post_content').upsert({
    user_id: userId,
    instagram_post_id: post.id,
    caption: post.caption || null,
    media_type: post.media_type || null,
    media_url: imageUrl,
    permalink_url: post.permalink || null,
    username: null, // Can be fetched if needed
    likes_count: post.like_count || null,
    comments_count: post.comments_count || null,
    posted_at: post.timestamp || null,
  }, {
    onConflict: 'user_id,instagram_post_id'
  });
}
```

### 4. Update cron-poll Header Validation

Match the Twitter Alpha Tracker pattern for accepting the cron trigger:

```typescript
// Handle cron-poll action
if (action === "cron-poll") {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    console.error("Cron poll: Invalid or missing cron secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // ... process all active users
}
```

---

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| New SQL migration | Create | Add pg_cron job for 5-minute polling |
| `supabase/functions/instagram-automation-poll/index.ts` | Modify | Fix private key parsing + add hybrid storage |

---

## Comparison: Twitter Alpha Tracker vs Instagram Automation

| Aspect | Twitter Alpha | Instagram Live (Current) | Instagram Live (Fixed) |
|--------|---------------|--------------------------|------------------------|
| Cron job | Every 1 minute | None | Every 5 minutes |
| Private key parsing | Handles PKCS#8 | Expects EC key header | Handles PKCS#8 |
| Local storage | `twitter_alpha_posts` table | None | `instagram_synced_post_content` |
| Memory creation | Works | Fails with base64 error | Works |

---

## Expected Outcome

After implementation:
1. Posts automatically captured every 5 minutes without user intervention
2. Memory creation succeeds (no more base64 errors)
3. Posts stored in local table for reliable 1:1 display
4. Stats update automatically in the "Instagram Live" active monitoring screen
5. Consistent architecture with other automation flows (Twitter, Email, etc.)
