

## Problem

The `discord-automation-webhook/index.ts` (the Composio real-time webhook handler) **completely lacks trigger word filtering**. It saves every incoming message as a memory, ignoring the `trigger_word` and `trigger_word_enabled` fields on the config — even though those fields are already loaded from the database.

The manual poll and cron-poll paths in `discord-automation-triggers/index.ts` correctly implement the filter (lines 763-767 and 169-171). Only the webhook is missing it.

## Plan — 1 file: `supabase/functions/discord-automation-webhook/index.ts`

### Add trigger word filter after the empty-content check (after line 87)

Insert the same logic used in the poll paths:

```typescript
// Trigger word filter
if (config.trigger_word_enabled === true && config.trigger_word) {
  if (!messageContent.toLowerCase().includes(config.trigger_word.toLowerCase())) {
    console.log("[Discord Webhook] Message does not contain trigger word, skipping");
    return new Response(JSON.stringify({ received: true, filtered: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
```

This goes between the empty-content check (line 82-87) and the deduplication check (line 89-102). The config object already contains `trigger_word` and `trigger_word_enabled` from the database query on line 38-42.

No other files need changes.

