

## Fix: Event search query format

### Problem

The current query is built as:
```
"tech,food,numismatics events near Miami,FL"
```

Google Events search treats this as a single literal string and returns nothing. A clean natural-language query like `"tech events in Miami"` works perfectly. Two issues:

1. **Comma-separated interests crammed into one query** — Google can't parse `"tech,food,numismatics"` as meaningful search terms.
2. **Single search for all interests** — even with better formatting, a broad multi-topic query produces worse results than individual focused searches.

### Solution

Instead of one combined query, split interests by comma and run a separate search per interest (up to 5), then merge and deduplicate results before curation.

### Changes — single file

**`supabase/functions/weekly-event-finder/index.ts`**

1. **Rename `searchEvents` to `searchEventsSingle`** and simplify the query template:
   ```typescript
   async function searchEventsSingle(interest: string, location: string): Promise<any[]> {
     const searchQuery = `${interest.trim()} events in ${location.trim()}`;
     // ... rest unchanged
   }
   ```
   - Uses `"in"` instead of `"near"` (matches the working curl test).
   - Takes a single interest string, not the full comma list.

2. **Add a new `searchEvents` wrapper** that splits interests and merges results:
   ```typescript
   async function searchEvents(interests: string, location: string): Promise<any[]> {
     const terms = interests.split(",").map(s => s.trim()).filter(Boolean).slice(0, 5);
     const allResults: any[] = [];
     const seenTitles = new Set<string>();
     
     for (const term of terms) {
       const results = await searchEventsSingle(term, location);
       for (const r of results) {
         const key = (r.title || r.name || "").toLowerCase();
         if (!seenTitles.has(key)) {
           seenTitles.add(key);
           allResults.push(r);
         }
       }
     }
     return allResults;
   }
   ```
   - Searches are sequential to avoid rate-limiting from Composio.
   - Deduplicates by title before returning.

3. **No changes to the `manual-sync` handler** — it already calls `searchEvents(interests, location)` which will now use the new wrapper.

### Why this works

The logs show the Composio tool returns `events_results_state: "Fully empty"` for the combined query. Splitting into clean single-topic queries like `"tech events in Miami"` matches the format that returns results via curl.

