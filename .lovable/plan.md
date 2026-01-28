
# Fix Twitter Alpha Tracker Account Selection

## Problem Summary

When selecting a Twitter account to track, the edge function returns a 400 error: "Account details required". The root cause is a **property name mismatch** between the edge function response and the hook's data mapping.

## Root Cause

The edge function (`searchTwitterUser`) returns:
```json
{
  "user": {
    "username": "doginaldogs",
    "userId": "1659130914746806272",
    "displayName": "Doginal Dogs",
    "avatarUrl": "..."
  }
}
```

But the hook incorrectly maps these fields as:
```typescript
userId: data.user.id,           // Should be: data.user.userId
displayName: data.user.name,     // Should be: data.user.displayName  
avatarUrl: data.user.profile_image_url,  // Should be: data.user.avatarUrl
```

## Solution

Update `src/hooks/useTwitterAlphaTracker.ts` to correctly map the edge function response properties:

**File: `src/hooks/useTwitterAlphaTracker.ts`**
Lines 130-138:

```typescript
// Before (incorrect):
if (data?.user) {
  setSearchResults([
    {
      username: data.user.username,
      userId: data.user.id,
      displayName: data.user.name,
      avatarUrl: data.user.profile_image_url,
    },
  ]);
}

// After (correct):
if (data?.user) {
  setSearchResults([
    {
      username: data.user.username,
      userId: data.user.userId,
      displayName: data.user.displayName,
      avatarUrl: data.user.avatarUrl,
    },
  ]);
}
```

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useTwitterAlphaTracker.ts` | Fix property mapping in `searchUsers` callback |

## Expected Outcome

After this fix:
1. Search results will include the correct `userId`
2. Clicking on a search result will pass the complete account object to `select-account`
3. The edge function will successfully save the tracked account
4. User will proceed to the "configure" phase

