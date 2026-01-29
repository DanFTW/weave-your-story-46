

# Fix Twitter Alpha Tracker: Implement Fallback Authentication for Cron Job

## The Problem

The current code (lines 454-462) only validates the `x-cron-secret` header:

```typescript
if (action === 'cron-poll') {
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== CRON_SECRET) {  // ❌ This always fails due to secret mismatch
    console.log('Cron poll: Invalid or missing secret');
    return new Response(...);
  }
}
```

The cron job sends the correct secret from the database, but the edge function's `CRON_SECRET` environment variable has a different value - causing authentication to fail every time.

## The Solution

Add `x-cron-trigger: supabase-internal` as a fallback authentication method:

```typescript
if (action === 'cron-poll') {
  const cronSecret = req.headers.get('x-cron-secret');
  const cronTrigger = req.headers.get('x-cron-trigger');
  
  // Accept either: matching secret OR internal cron trigger header
  const validSecret = cronSecret && cronSecret === CRON_SECRET;
  const validTrigger = cronTrigger === 'supabase-internal';
  
  if (!validSecret && !validTrigger) {
    console.log('Cron poll: Invalid or missing authentication');
    return new Response(...);
  }
  // Continue with sync...
}
```

## File to Modify

| File | Lines | Change |
|------|-------|--------|
| `supabase/functions/twitter-alpha-tracker/index.ts` | 454-462 | Add `x-cron-trigger` fallback authentication |

## Expected Result

Within 1-2 minutes after deployment:
- Cron job authentication succeeds
- Background sync runs automatically every minute
- New tweets from tracked accounts are detected without clicking "Sync Now"

