
Pure synthesis from prior audits. No new file reads needed — I have the inventory, root causes, Coinbase slug walkthrough, and direction-mismatch findings from the four prior audits in conversation history.

## Plan: Shane Ground-Truth Thread List

### Approach
Bundle the 38 threads into ~21 integration-grouped entries (grab + continuous merged per Shane's framing). For each: name, what it does, my testing claim (I'll mark all as "needs your confirmation" — I cannot know what the user personally tested), known problems with root cause, confidence rating.

### Critical caveat I must flag upfront
I do not have visibility into which threads the user has personally tested with real accounts. I'll structure column 3 as "evidence in code/telemetry" + a "your call" placeholder so the user can fill in account counts. This is the honest move — fabricating test counts would burn them in front of Shane.

### Output structure
1. **Per-integration table** (~21 rows): Integration | Thread(s) | What it does (grab + continuous) | Telemetry evidence | Known problems + root cause | Confidence
2. **Your 4–5 hero threads** — the most defensible by code maturity, telemetry, and PRD alignment
3. **Cut / deprioritize list** — with one-line reason each
4. **Coinbase deep dive** — every slug attempted, return shape, failure reason, three root causes consolidated

Confidence scale: 🟢 rock solid · 🟡 works with known bugs · 🟠 partial · 🔴 broken

### Length
~400 lines. Single response, no code changes.
