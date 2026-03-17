

## Problem
The "Search Channel" section in `ActiveMonitoring.tsx` (lines 218-245) uses a manual text input and search button. The user wants it replaced with a channel picker dropdown that fetches available Slack channels and lets users add them to the monitored set.

## Constraint
Only `src/components/flows/slack-messages-sync/ActiveMonitoring.tsx` will be modified.

## Plan

### Replace the Search section (lines 218-245) with a Channel Picker

1. **Add local state** for:
   - `availableChannels: SlackChannel[]` — fetched from edge function
   - `isLoadingChannels: boolean`
   - `pickerOpen: boolean` — controls the dropdown visibility

2. **Fetch channels** on dropdown open via `supabase.functions.invoke("slack-messages-sync", { body: { action: "list-channels" } })`. Cache results so repeated opens don't re-fetch.

3. **Render a Popover-based dropdown** (using existing `Popover`/`PopoverContent`/`PopoverTrigger` from `@/components/ui/popover` and `Command`/`CommandInput`/`CommandList`/`CommandItem` from `@/components/ui/command`) that:
   - Shows a trigger button styled like the existing card ("Add Channel" with a `+` icon)
   - Lists fetched channels with `#name` and member count
   - Filters already-monitored channels (from `stats.channelNames`) visually (greyed out / checkmark)
   - On select, updates the DB directly via `supabase.from("slack_messages_config").update(...)` to append the new channel ID/name, then updates local `stats` display and shows a toast

4. **Remove** the `searchQuery` state, `handleSearch` function, the text input, and the search Button entirely.

5. **Remove unused imports**: `Search` icon (if not used elsewhere in the file — it is not).

### UI
- Same card styling as the existing "Search Channel" card
- Header: "Add Channel" with a `Hash` or `Plus` icon
- Dropdown: searchable list of workspace channels
- Already-monitored channels shown with a checkmark, non-clickable

