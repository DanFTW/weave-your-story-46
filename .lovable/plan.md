
# Fix Trello Task Tracker Flow Navigation Issues

## Problem Summary

Two navigation issues prevent users from completing the Trello Task Tracker setup:

1. **Already-connected users are redirected to Connect Trello** - The auth check races and fires before the connection status is confirmed
2. **Post-connection redirect missing** - After connecting Trello, users land on the integration page without being sent back to the flow

## Root Cause Analysis

### Issue 1: Auth Check Race Condition

The `useTrelloAutomation` hook has an initialization issue:

```text
Initial State:
  phase = 'auth-check'
  isLoading = false     <-- Problem: Should start as true
  isConnected = false

Effect fires immediately → Redirects to /integration/trello
```

The Instagram and LinkedIn flows solve this with a dedicated `isCheckingAuth` state that gates the redirect logic until the check completes.

### Issue 2: Missing Return Path

The Email Dump flow pattern stores a return path:
```typescript
sessionStorage.setItem('returnAfterGmailConnect', '/flow/email-dump');
```

The Trello flow doesn't store any return path, and `IntegrationDetail.tsx` only handles Gmail-specific returns.

---

## Solution

### Part 1: Fix Auth Check in TrelloAutomationFlow

Update the flow component to use `useComposio('TRELLO')` for connection checking, following the LinkedIn/Instagram pattern:

1. Add `isCheckingAuth` local state
2. Use `useComposio` hook to check connection
3. Gate redirect logic on `isCheckingAuth` completion
4. Store return path before redirecting

### Part 2: Add Trello Return Path Handling

Update `IntegrationDetail.tsx` to handle Trello return paths using a generic pattern.

---

## Technical Implementation

### File 1: `src/components/flows/trello-automation/TrelloAutomationFlow.tsx`

**Changes:**
- Import and use `useComposio('TRELLO')` hook
- Add `isCheckingAuth` state to track connection check
- Replace the existing redirect effect with a pattern matching Instagram/LinkedIn
- Store `returnAfterTrelloConnect` before redirecting to integration page
- Simplify the hook's auth check responsibility

```typescript
// Add imports
import { useComposio } from "@/hooks/useComposio";

// Inside component
const [isCheckingAuth, setIsCheckingAuth] = useState(true);
const trello = useComposio('TRELLO');

// Check connection on mount
useEffect(() => {
  const checkAuth = async () => {
    await trello.checkStatus();
    setIsCheckingAuth(false);
  };
  checkAuth();
}, []);

// Handle connection status after check completes
useEffect(() => {
  if (isCheckingAuth) return;
  
  if (trello.isConnected) {
    // Connection confirmed, proceed with hook initialization
    // The hook will load config and set phase
  } else {
    // Store return path for after connection
    sessionStorage.setItem('returnAfterTrelloConnect', '/flow/trello-tracker');
    navigate('/integration/trello');
  }
}, [trello.isConnected, isCheckingAuth, navigate]);
```

### File 2: `src/hooks/useTrelloAutomation.ts`

**Changes:**
- Remove internal auth checking logic (now handled by component)
- Accept an `isConnected` parameter or simply assume connected when hook is used
- Initialize phase to `'select-board'` instead of `'auth-check'`
- Start `isLoading` as `true` to prevent flash

```typescript
// Update initial state
const [phase, setPhase] = useState<TrelloAutomationPhase>('auth-check');
const [isLoading, setIsLoading] = useState(true);  // Start as true

// Simplify init - remove connection check, just load config
useEffect(() => {
  const init = async () => {
    setIsLoading(true);
    await loadConfig();
    setIsLoading(false);
  };
  // Only run when connected (component guarantees this)
  init();
}, [loadConfig]);
```

### File 3: `src/pages/IntegrationDetail.tsx`

**Changes:**
- Generalize the return path handling to support multiple integrations
- Check for `returnAfterTrelloConnect` in addition to Gmail

```typescript
// Update the useEffect that handles return redirects
useEffect(() => {
  if (isConnected && !hasHandledReturn.current) {
    // Check for integration-specific return paths
    const returnPathKey = `returnAfter${integrationId?.charAt(0).toUpperCase()}${integrationId?.slice(1).toLowerCase()}Connect`;
    const returnPath = sessionStorage.getItem(returnPathKey);
    
    if (returnPath) {
      hasHandledReturn.current = true;
      sessionStorage.removeItem(returnPathKey);
      setTimeout(() => {
        navigate(returnPath);
      }, 500);
    }
  }
}, [isConnected, integrationId, navigate]);
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/flows/trello-automation/TrelloAutomationFlow.tsx` | Add `useComposio` hook, `isCheckingAuth` state, proper gated redirect with return path storage |
| `src/hooks/useTrelloAutomation.ts` | Start `isLoading` as `true`, simplify init to assume connection is already verified |
| `src/pages/IntegrationDetail.tsx` | Generalize return path handling to support Trello and other integrations |

---

## Expected Behavior After Fix

1. **Connected User Flow:**
   - User clicks "Get Started" → `/flow/trello-tracker`
   - `isCheckingAuth` = true → Shows loader
   - Connection check completes → `trello.isConnected` = true
   - Hook loads config → Shows board selection

2. **Disconnected User Flow:**
   - User clicks "Get Started" → `/flow/trello-tracker`
   - `isCheckingAuth` = true → Shows loader
   - Connection check completes → `trello.isConnected` = false
   - Stores `returnAfterTrelloConnect = '/flow/trello-tracker'`
   - Redirects to `/integration/trello`
   - User connects Trello
   - `IntegrationDetail` detects connection + return path
   - Auto-redirects to `/flow/trello-tracker`
   - Flow resumes at board selection
