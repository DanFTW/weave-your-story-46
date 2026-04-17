
Pure research/synthesis task — no code changes. I have all the data from the four prior audits. This is a packaging exercise: convert technical findings into Shane-ready talking points + dispositions + effort estimates + prioritization.

## Plan: Shane Prep Pack

### Approach
No new file reads needed — synthesize from prior audit outputs (PRD scope, root causes, status table, direction mismatches). One small verification pass to sanity-check effort estimates against codebase complexity for the top 10 items.

### Output structure
Single deliverable, ~500–700 lines of markdown, organized as:

**Section 1 — Per-story table (46 rows), grouped by integration**

| Story | Talking point (1 line, plain English) | Disposition | Effort (hrs) |

Dispositions (fixed vocabulary):
- 🟢 Ship as-is
- 🟡 Finish partial
- 🔴 Rebuild (direction mismatch)
- 🔧 Fix known bug
- ⭐ Not started, prioritize
- ⏸ Deprioritize (platform limit)

Effort: blank for 🟢; hours for everything else (rough t-shirt buckets: 4 / 8 / 16 / 24 / 40 / 80).

**Section 2 — Top 10 prioritized list**
Ranked by PRD impact ÷ effort. Each row: rank, story, why it wins, hours, expected outcome.

**Section 3 — Direction-mismatch rebuild specs**
For each of the 4 mismatches (Spotify Music Finder, Calendar Event Sync, plus any others surfaced):
- What it does today (1 line)
- What PRD requires (1 line)
- Rebuild scope (3–5 bullets)
- Rough effort + reuse opportunities

**Section 4 — Shane's anticipated questions**
~10–12 likely product/engineering questions with one-line answers:
- "Why are we polling Twitter when the Free tier rate-limits us?"
- "Can we ship Instagram stories at all this quarter?"
- "What's the cost of cutting the iOS native bridges from scope?"
- "Why does Spotify Music Finder push instead of pull?"
- "How long to ship the top 10?"
- "Which integrations should we deprecate publicly vs hide?"
- "What's the LIAM API throughput ceiling for bulk grabs?"
- "Are we blocked on any vendor (Composio, Despia, Apify)?"
- "Which stories need design vs engineering only?"
- "What's the migration story to weavefabric main?"

### What I will NOT do
- No code changes
- No new DB queries (all telemetry already captured)
- No new file reads beyond a quick spot-check of 2–3 hooks to validate effort buckets

### Estimated length
~600 lines. Single markdown response, no code blocks except the tables.
