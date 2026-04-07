

## Fix: Event dates lost in the curation pipeline

### Root cause

There are two places where date information is being dropped:

**1. Incomplete date field extraction in the LLM prompt (line 211)**

The event summaries sent to the LLM for curation use `e.date || e.start_date || ""` but omit `e.when` — a common field in Composio search results. Events that only have a `when` field appear dateless to the LLM, so it returns empty or fabricated dates.

**2. LLM prompt lacks explicit instruction to preserve dates**

The prompt says "pick the top 5 most relevant events" but doesn't tell the LLM to copy dates verbatim. The model may paraphrase ("next Saturday") or omit dates it considers unimportant.

**3. No fallback to original event data after curation**

After the LLM returns curated events, the code uses the LLM's output directly. If the LLM drops or mangles a date, there's no mechanism to recover the original date from the raw search results.

### Solution

**File: `supabase/functions/weekly-event-finder/index.ts`**

**A. Fix the event summary extraction (line 211)**
Add `e.when` to the date fallback chain so dates from all common Composio fields reach the LLM:
```
e.date || e.start_date || e.when || ""
```

**B. Strengthen the LLM prompt (line 226)**
Explicitly instruct the LLM to copy the exact date string from the input for each event. Update the prompt to:
```
"You are an event curator. Given a user's interests and a list of events, pick the top 5 most relevant events. IMPORTANT: For each event, copy the exact date string from the input — do not rephrase, summarize, or omit dates."
```

**C. Post-curation date recovery**
After the LLM returns curated events, cross-reference each curated event title against the original raw events. If a curated event has an empty or missing `date` field, copy the date from the matching raw event. This ensures dates survive even if the LLM drops them.

### No other files changed

