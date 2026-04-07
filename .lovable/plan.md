

## Pass event URLs through curation and into delivery messages

### Problem

Composio event search results include URLs (e.g., `link`, `url`, `event_url`), but the curation step and delivery message both drop them. The LLM tool schema doesn't include a `link` field, and the delivery template doesn't render one.

### Changes

**File: `supabase/functions/weekly-event-finder/index.ts`**

#### 1. Include URLs in event summaries sent to the LLM (line ~196)

Add the event link to each summary line so the LLM can pass it through:

```
`${i + 1}. ${e.title || ...} — ${e.description || ...} — ${e.date || ...} — ${e.link || e.url || e.event_url || ""}`
```

#### 2. Add `link` to the LLM tool schema (lines ~227-234)

Add `link` as an optional string property in the `select_events` tool schema so the LLM returns it:

```typescript
properties: {
  title: { type: "string" },
  date: { type: "string" },
  description: { type: "string" },
  reason: { type: "string" },
  link: { type: "string" },
},
required: ["title", "date", "description", "reason"],
```

#### 3. Include links in the delivery message (line ~469)

Add the link to each event in the formatted output:

```typescript
const eventList = newEvents
  .map((e: any, i: number) =>
    `${i + 1}. ${e.title || e.name}\n   ${e.date || ""}\n   ${e.description || ""}\n   ${e.reason || ""}${e.link ? `\n   ${e.link}` : ""}`
  )
  .join("\n\n");
```

#### 4. Redeploy the edge function

### Files touched

- `supabase/functions/weekly-event-finder/index.ts` — steps 1-3

