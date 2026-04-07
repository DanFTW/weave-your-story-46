

## Fix: `[object Object]` in event date rendering

### Root cause

Composio search results can return date fields (`date`, `start_date`, `when`) as **objects** rather than strings — e.g., `{ date: { year: 2026, month: 4, day: 8 } }` or similar structured formats. Every place in the pipeline that reads these fields assumes they're strings, so the object flows through untouched and eventually renders as `[object Object]` in delivery messages.

### Solution

Add a single `extractDateString` helper that safely coerces any date field value (string, object, Date, etc.) into a string. Then use it everywhere date fields are accessed.

### Changes — single file: `supabase/functions/weekly-event-finder/index.ts`

**1. Add `extractDateString` helper (near line 184, before `isUpcomingEvent`)**

```typescript
function extractDateString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    // Handle structured date objects like { year, month, day, hour, minute }
    const v = value as Record<string, any>;
    if (v.dateTime) return String(v.dateTime);       // Google Calendar style
    if (v.date) return String(v.date);               // nested date string
    if (v.year && v.month && v.day) {
      const pad = (n: number) => String(n).padStart(2, "0");
      let s = `${v.year}-${pad(v.month)}-${pad(v.day)}`;
      if (v.hour != null) s += `T${pad(v.hour)}:${pad(v.minute || 0)}:00`;
      return s;
    }
    // Last resort: try JSON.stringify so it's at least debuggable
    try { return JSON.stringify(value); } catch { return ""; }
  }
  return String(value);
}
```

**2. Update `isUpcomingEvent` (line 186)** — use the helper:
```typescript
const dateStr = extractDateString(event.date) || extractDateString(event.start_date) || extractDateString(event.when);
```

**3. Update LLM summary builder (line 211)** — use the helper:
```typescript
`... — Date: ${extractDateString(e.date) || extractDateString(e.start_date) || extractDateString(e.when) || "unknown"} — ...`
```

**4. Update date recovery map builder (line 307)** — use the helper:
```typescript
const rawDate = extractDateString(e.date) || extractDateString(e.start_date) || extractDateString(e.when);
```

**5. Update delivery message formatter (line 517)** — use the helper:
```typescript
const dateStr = extractDateString(e.date) || extractDateString(e.start_date) || extractDateString(e.when);
```

**6. Improve the date display format** to match the user's preferred style (`Wednesday April 8, 2026 @ 5:30pm EST`):
```typescript
// Replace the current toLocaleDateString/toLocaleTimeString block with:
formattedDate = d.toLocaleDateString("en-US", {
  weekday: "long", month: "long", day: "numeric", year: "numeric"
});
const timeStr = d.toLocaleTimeString("en-US", {
  hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short"
});
if (d.getHours() !== 0 || d.getMinutes() !== 0) {
  formattedDate += ` @ ${timeStr}`;  // e.g. "Wednesday, April 8, 2026 @ 5:30 PM EST"
}
```

**7. Redeploy the edge function.**

### Why this works

- The `extractDateString` helper handles every possible shape: string passthrough, Date objects, structured objects with named fields, and nested date strings.
- Applied at all four touchpoints ensures no `[object Object]` can leak through at any stage.
- The `@` separator and `timeZoneName: "short"` match the user's preferred format.

