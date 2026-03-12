## Fix: Infinite "Checking connection..." Loop

### Root Cause

The `checkSlackAuth` function in `SlackMessagesSyncFlow.tsx` calls `supabase.auth.getUser()` which makes a **network request** to verify the token. If the auth session isn't fully restored yet (race condition with `onAuthStateChange`), this call can hang or fail silently, leaving `isCheckingAuth` stuck at `true`.

### Fix

`src/components/flows/slack-messages-sync/SlackMessagesSyncFlow.tsx`:

1. Replace `supabase.auth.getUser()` with `supabase.auth.getSession()` — this reads from local storage and doesn't make a network call, so it resolves immediately
2. Wrap the entire `checkSlackAuth` in try/catch so any unexpected error still sets `isCheckingAuth(false)` instead of silently swallowing the rejection
3. No other files need changes

```typescript
useEffect(() => {
  const checkSlackAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsCheckingAuth(false);
        return;
      }
      const { data } = await supabase
        .from("user_integrations")
        .select("status")
        .eq("user_id", session.user.id)
        .eq("integration_id", "slack")
        .eq("status", "connected")
        .maybeSingle();
      const hasUsableToken = Boolean(data);
      setIsSlackConnected(hasUsableToken);
    } catch (err) {
      console.error("Slack auth check failed:", err);
    } finally {
      setIsCheckingAuth(false);
    }
  };
  checkSlackAuth();
}, []);

```

This ensures the spinner always resolves, and connected users proceed directly to channel selection.