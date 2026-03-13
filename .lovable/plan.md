

## Fix: Reset Configuration Not Working in Slack Channel Monitor

### Root Cause

Two issues in `resetConfig` (`src/hooks/useSlackMessagesSync.ts`):

1. **Silent delete failure**: The Supabase `.delete()` call doesn't destructure or check the `error` from the response. Unlike `throw`, the Supabase client resolves with `{ data, error }` — so a failed delete (e.g., RLS issue) silently proceeds to clear local state. When the user re-enters the flow, `loadConfig` finds the old DB row and restores the previous configuration.

2. **Stale state after reset**: `resetConfig` clears `config`, `channels`, `selectedChannelId`, and `selectedChannelName`, but does NOT clear `workspace` or reset `hasInitialized`. This means:
   - The cached workspace persists across reset
   - If the hook instance survives navigation, `initializeAfterAuthCheck` won't re-run because `hasInitialized` is still `true`

### Fix (single file: `src/hooks/useSlackMessagesSync.ts`)

**In `resetConfig` (~line 350):**
- Destructure and check the `{ error }` from the `.delete()` call — throw on error so the catch block handles it properly
- Clear `workspace` state (`setWorkspace(null)`)
- Reset `hasInitialized` to `false` so `initializeAfterAuthCheck` will re-run if the user navigates away and returns

```typescript
const resetConfig = useCallback(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  setIsLoading(true);
  try {
    const { error } = await supabase
      .from("slack_messages_config" as any)
      .delete()
      .eq("user_id", user.id);

    if (error) throw error;

    setConfig(null);
    setChannels([]);
    setWorkspace(null);
    setSelectedChannelId(null);
    setSelectedChannelName(null);
    setHasInitialized(false);
    setPhase("select-workspace");
  } catch (error) {
    // ... existing error handling
  } finally {
    setIsLoading(false);
  }
}, [toast]);
```

No other files or logic changes needed.

