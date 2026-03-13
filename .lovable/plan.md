

## Fix: Clear Slack Message Monitor config on Slack reconnect

### Problem
When a user disconnects and reconnects Slack with a different account, the `slack_messages_config` table still contains the old workspace and channel selections. The Slack Message Monitor then shows the stale workspace instead of prompting the user to set up from scratch.

### Solution
In the Slack disconnect branch of `useComposio.ts`, also delete the user's `slack_messages_config` row. This ensures reconnecting Slack always starts the Message Monitor fresh.

### Change (1 file)

**`src/hooks/useComposio.ts`** — In the `disconnect` function's Slack branch (lines 366-372), add a second delete to clear `slack_messages_config`:

```typescript
if (toolkit.toLowerCase() === "slack") {
  // Slack: delete DB record and clear message monitor config
  await supabase
    .from("user_integrations")
    .delete()
    .eq("user_id", session.user.id)
    .eq("integration_id", "slack");

  // Clear Slack Message Monitor config so reconnect starts fresh
  await supabase
    .from("slack_messages_config" as any)
    .delete()
    .eq("user_id", session.user.id);
}
```

The `slack_messages_config` table already has a DELETE RLS policy for `auth.uid() = user_id`, so no database changes are needed. No other flows are affected.

