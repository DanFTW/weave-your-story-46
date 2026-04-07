

## Fix: Raw JSON rendering for event dates

### Problem

The `extractDateString` helper doesn't recognize objects with `when` or `start_date` keys. When an event's `date` field is an object like `{"start_date":"May 16","when":"Sat, May 16, 4 – 8 PM EDT"}`, it falls through to `JSON.stringify(value)` (line 199), which produces the raw JSON visible in the screenshot.

Additionally, the date extraction chain (`e.date || e.start_date || e.when`) short-circuits at `e.date` — but `e.date` can itself be an object containing the nested `when` field. The `when` field is the best human-readable string and should be prioritized.

### Solution — single file: `supabase/functions/weekly-event-finder/index.ts`

**1. Update `extractDateString` to handle `when` and `start_date` keys (lines 189-199)**

Add checks for `v.when` and `v.start_date` before the `JSON.stringify` fallback:

```typescript
if (typeof value === "object") {
  const v = value as Record<string, any>;
  if (v.when && typeof v.when === "string") return v.when;        // prioritize human-readable
  if (v.dateTime && typeof v.dateTime === "string") return v.dateTime;
  if (v.start_date && typeof v.start_date === "string") return v.start_date;
  if (v.date && typeof v.date === "string") return v.date;
  if (v.year && v.month && v.day) { /* existing pad logic */ }
  // Recurse into nested objects if any known key holds an object
  if (v.when) return extractDateString(v.when);
  if (v.dateTime) return extractDateString(v.dateTime);
  if (v.date) return extractDateString(v.date);
  if (v.start_date) return extractDateString(v.start_date);
  try { return JSON.stringify(value); } catch { return ""; }
}
```

**2. Prioritize `when` in all extraction chains**

Change the fallback order everywhere from `e.date || e.start_date || e.when` to `e.when || e.date || e.start_date` at these locations:
- Line 206 (`isUpcomingEvent`)
- Line 231 (LLM summary builder)
- Line 327 (date recovery map)
- Line 537 (delivery message builder)

**3. Skip `new Date()` reformatting when `when` is already human-readable (lines 539-562)**

The `when` field like `"Sat, May 16, 4 – 8 PM EDT"` is already the ideal display format. Attempting `new Date()` on it will fail or produce a worse result. Update the delivery formatter to use the raw string directly when it's already human-readable (i.e., not an ISO date):

```typescript
const dateStr = extractDateString(e.when) || extractDateString(e.date) || extractDateString(e.start_date);
let formattedDate = dateStr;
// Only attempt Date parsing if it looks like an ISO/standard date, not already human-readable
if (dateStr && /^\d{4}-\d{2}/.test(dateStr)) {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      // existing formatting logic
    }
  } catch { /* keep raw */ }
}
```

**4. Redeploy the edge function.**

### Why this works

- `when` is prioritized everywhere because Composio returns it as the cleanest human-readable string (e.g., "Sat, May 16, 4 – 8 PM EDT").
- The `extractDateString` helper now recognizes `when` and `start_date` as object keys, preventing the `JSON.stringify` fallback.
- ISO-only reformatting avoids mangling already-formatted `when` strings.
- No other changes to the codebase.

