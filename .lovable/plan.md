# Fix: Channel Loading Auth Failure in Discord Tracker

## Root Cause

The edge function correctly returns a 200 with error details when channel loading fails, but the frontend has two gaps:

1. `useDiscordAutomation.ts`**** `selectServer` **function** (lines 230-236): When channel loading returns an error, it shows a toast and sets empty channels, but does NOT set `needsReconnect = true`. So the reconnect UI never appears.
2. `ChannelPicker` **component**: Has no props or UI for handling auth failures / reconnect. It only shows "No text channels found" when channels are empty.
3. `DiscordAutomationFlow` (lines 148-155): Does not pass `needsReconnect` or `onReconnect` to `ChannelPicker`.

## Changes

### 1. `src/hooks/useDiscordAutomation.ts` - Detect channel auth failures in `selectServer`

In the `selectServer` callback (around lines 230-236), add auth failure detection when `channelData.error` is present:

```typescript
if (channelData.error) {
  const isChannelAuthFailure =
    channelData.details?.includes("All Discord connections failed") ||
    channelData.error?.includes("reconnect");

  if (isChannelAuthFailure) {
    setNeedsReconnect(true);
  }

  toast({
    title: "Failed to load channels",
    description: extractErrorMessage(channelData),
    variant: "destructive",
  });
  setChannels([]);
}

```

### 2. `src/components/flows/discord-automation/ChannelPicker.tsx` - Add reconnect UI

Add `needsReconnect`, `onReconnect`, and `onGoBack` props. When `channels` is empty and `needsReconnect` is true, show a "Reconnect Discord" button instead of just "No text channels found". Also add a "Pick a different server" button.

### 3. `src/components/flows/discord-automation/DiscordAutomationFlow.tsx` - Wire reconnect to ChannelPicker

Pass `needsReconnect`, `onReconnect={reconnectDiscord}`, and `onGoBack` to the `ChannelPicker` component (lines 148-155).

## No edge function changes needed

The edge function already returns 200 with the correct error body. The fix is entirely frontend.

---

## Suggestions (additions only)

1. **Reset** `needsReconnect` **on success and on new server selection**
  - Before fetching channels in `selectServer`, call `setNeedsReconnect(false)` so a previous failure doesn’t “stick”.
  - When channels load successfully, also ensure `setNeedsReconnect(false)`.
2. **Make auth-failure detection slightly more robust (still scoped)**
  - Instead of checking only `details`/`error`, run the same check against the final `extractErrorMessage(channelData)` (covers cases where the message is stored in a different field).
3. **ChannelPicker empty-state should differentiate “no channels” vs “auth failure”**
  - If `needsReconnect === false`, keep “No text channels found in this server”.
  - If `needsReconnect === true`, show the reconnect CTA + a short line like “Your Discord connection needs to be refreshed to list channels.”
4. `onGoBack` **should actually return to the server picker**
  - Wire `onGoBack` to set the phase back to `'select-server'` (or call your existing “reset selection” method if you have one).