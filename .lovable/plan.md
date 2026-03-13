

## Root Cause: Discord Message Content Intent

### Analysis

The edge function logs confirm:
- `poll` action executes successfully
- Discord API returns messages (no error logged)
- 0 messages imported
- No "Memory creation failed" logs (meaning no LIAM calls are even attempted)
- `discord_processed_messages` table has 0 rows (deduplication is not the culprit)

Every message is being filtered out before the LIAM call. The two filters are:
1. `msg.author?.bot` — skip bot messages
2. `!msg.content || msg.content.trim() === ""` — skip empty content

Since September 2022, Discord requires bots to have the **Message Content privileged intent** enabled in the Developer Portal. Without it, `msg.content` is returned as an empty string `""` for all messages from other users. The bot sees message metadata (author, timestamp, id) but content is blank — so filter #2 silently discards every message.

### Fix (two parts)

**Part 1 — Add diagnostic logging** to the poll action so we can see exactly what's being received and filtered. This is essential for confirming the diagnosis and for future debugging:

In `supabase/functions/discord-automation-triggers/index.ts`, after `messages = await msgRes.json()`:
```
console.log(`[Discord Poll] Fetched ${messages.length} messages`);
// Log first message to diagnose content intent issues
if (messages.length > 0) {
  const sample = messages[0];
  console.log(`[Discord Poll] Sample msg: id=${sample.id}, author.bot=${sample.author?.bot}, content.length=${(sample.content || '').length}, content="${(sample.content || '').substring(0, 80)}"`);
}
```

Also log skip reasons in the loop:
```
const botCount = messages.filter(m => m.author?.bot).length;
const emptyCount = messages.filter(m => !m.author?.bot && (!m.content || !m.content.trim())).length;
console.log(`[Discord Poll] Skipping: ${botCount} bot msgs, ${emptyCount} empty-content msgs`);
```

**Part 2 — Handle empty content gracefully**: If `content` is empty but the message has embeds or attachments, format a fallback memory from those fields. This makes the sync resilient even when the Message Content Intent isn't fully propagated:

```typescript
// Build content from message body, embeds, or attachments
let messageText = msg.content?.trim() || '';
if (!messageText && msg.embeds?.length > 0) {
  messageText = msg.embeds.map(e => [e.title, e.description].filter(Boolean).join(': ')).join('\n');
}
if (!messageText && msg.attachments?.length > 0) {
  messageText = msg.attachments.map(a => `[Attachment: ${a.filename}]`).join(', ');
}
if (!messageText) continue; // truly empty
```

### User action required

Enable **Message Content Intent** in the Discord Developer Portal:
1. Go to https://discord.com/developers/applications
2. Select your bot application
3. Go to **Bot** → scroll to **Privileged Gateway Intents**
4. Enable **Message Content Intent**
5. Save

### Files changed

| File | Change |
|------|--------|
| `supabase/functions/discord-automation-triggers/index.ts` | Add diagnostic logging + embed/attachment fallback in poll action |

