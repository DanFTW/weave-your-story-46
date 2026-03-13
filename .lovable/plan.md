

## Plan: Add Debug Logging to Poll Action

Add `console.log` statements at four points in the poll action of `supabase/functions/slack-messages-sync/index.ts`. No logic changes.

### Changes (lines 188-227)

1. **After `historyResult` check (line 188):** Log total messages returned and how many have subtypes.

2. **When a message is skipped as already processed (line 201):** Increment a counter and log total skipped after the loop.

3. **Before the LIAM API fetch (line 205):** Log the exact payload (headers and body).

4. **After the LIAM API response (line 220):** Log the full response status and body text.

### Concrete code shape

```typescript
if (historyResult.ok) {
  const allMessages = historyResult.messages || [];
  const nonSubtypeMessages = allMessages.filter((m: any) => !m.subtype);
  console.log(`[poll] conversations.history returned ${allMessages.length} total messages, ${nonSubtypeMessages.length} without subtype`);

  let skippedCount = 0;

  for (const msg of allMessages) {
    if (msg.subtype) continue;

    const messageId = `${channelId}_${msg.ts}`;

    const { data: existing } = await adminClient
      .from("slack_processed_messages")
      .select("id")
      .eq("user_id", user.id)
      .eq("slack_message_id", messageId)
      .maybeSingle();

    if (existing) {
      skippedCount++;
      continue;
    }

    const memoryContent = `Slack message from ${msg.user || "unknown"}: ${msg.text}`;

    const liamPayload = { content: memoryContent, tags: ["SLACK"] };
    console.log(`[poll] Sending to LIAM API:`, JSON.stringify(liamPayload));

    const liamResp = await fetch("https://web.askbuddy.ai/api/memories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": liamApiKey,
        "x-user-key": liamUserKey,
        "x-private-key": liamPrivateKey,
        "x-user-id": user.id,
      },
      body: JSON.stringify(liamPayload),
    });

    const liamRespText = await liamResp.text();
    console.log(`[poll] LIAM API response status=${liamResp.status} body=${liamRespText}`);

    if (liamResp.ok) {
      await adminClient.from("slack_processed_messages").insert({
        user_id: user.id,
        slack_message_id: messageId,
      });
      totalImported++;
    }
  }

  console.log(`[poll] Skipped ${skippedCount} already-processed messages, imported ${totalImported} new messages`);
}
```

Only the block inside `if (historyResult.ok)` is modified. All existing logic remains identical.

