

## Plan: Add missing post-OAuth redirect sessionStorage entries

### Problem
7 thread flows navigate to their integration page when unauthenticated but don't set a `sessionStorage` return path, so after OAuth completes the user lands on the integration page instead of returning to the originating thread.

### Files to change (7 flow components)

Each file needs one line added before its `navigate('/integration/...')` call:

| File | Missing `sessionStorage.setItem` | Return path |
|---|---|---|
| `src/components/flows/facebook-sync/FacebookSyncFlow.tsx` | `returnAfterFacebookConnect` | `/flow/facebook-sync` |
| `src/components/flows/email-automation/EmailAutomationFlow.tsx` | `returnAfterGmailConnect` | `/flow/email-automation` |
| `src/components/flows/linkedin-automation/LinkedInAutomationFlow.tsx` | `returnAfterLinkedinConnect` | `/flow/linkedin-live` |
| `src/components/flows/instagram-sync/InstagramSyncFlow.tsx` | `returnAfterInstagramConnect` | `/flow/instagram-sync` |
| `src/components/flows/instagram-automation/InstagramAutomationFlow.tsx` | `returnAfterInstagramConnect` | `/flow/instagram-live` |
| `src/components/flows/youtube-sync/YouTubeSyncFlow.tsx` | `returnAfterYoutubeConnect` | `/flow/youtube-sync` |
| `src/components/flows/google-photos-sync/GooglePhotosSyncFlow.tsx` | `returnAfterGooglephotosConnect` | `/flow/google-photos-sync` |

### How it works
The `IntegrationDetail.tsx` page already reads `returnAfter{CapitalizedId}Connect` from sessionStorage when a connection succeeds and navigates to that path. Each flow just needs to set that key before redirecting.

### Example change (FacebookSyncFlow)
```typescript
// Before:
navigate('/integration/facebook');

// After:
sessionStorage.setItem('returnAfterFacebookConnect', '/flow/facebook-sync');
navigate('/integration/facebook');
```

### Key constraints
- The sessionStorage key must match the pattern `returnAfter{IntegrationId}Connect` where `IntegrationId` is the URL param capitalized (first letter upper, rest lower) — this is what `IntegrationDetail.tsx` constructs at line 57-58.
- No changes to auth logic, OAuth config, or any other files.

