
This is a pure research/audit request — no code changes. The user wants every PRD user story (across ~21 integrations) classified into one of four buckets: ✅ built & working, 🔧 built but broken (root cause), ⚙️ partial, ❌ not built — plus a "direction mismatch" flag.

I already have most of the data from the prior three audits. What's new here is the **PRD-filtered scope** and the **per-user-story granularity** (not per-thread). Many PRD stories don't map 1:1 to existing threads — e.g., Gmail "semantic search thread" doesn't exist as a thread, only as the email-dump on-demand search; Instagram "native share extension" is a mobile share-target feature that I need to verify exists; iOS MusicKit / Apple Health / CalendarKit / Eventbrite / Google Contacts / OneDrive may be entirely absent.

### What I need to verify (read-only)
1. `src/data/threads.ts` — confirmed inventory (38 items), already known
2. Search for evidence of:
   - **Instagram stories sync** — likely ❌ (constraint memory says unsupported)
   - **Native share extension** — search for `share-target`, Despia share intent, manifest share_target
   - **Gmail semantic search thread** (recurring, not on-demand) — vs `email-dump` (on-demand). Likely ⚙️ partial
   - **Google Contacts** — search for `googlecontacts`, `GOOGLE_CONTACTS_*`
   - **Eventbrite** — search for `eventbrite`
   - **OneDrive** — search for `onedrive`
   - **iOS MusicKit / CalendarKit / Apple Health** — search for `musickit`, `healthkit`, `calendarkit`, despia native bridges
   - **Twitter bookmarks** — vs likes (twitter-sync covers likes/retweets/replies — bookmarks may be missing)
   - **Facebook friends life updates** — distinct from page posts / own posts
   - **YouTube watch history** — youtube-sync claims it; verify
   - **Spotify "previous songs" grab + liked songs grab** — spotify-music-finder is a different feature (AI playlist builder); the PRD asks for raw liked-song dumps. Likely **direction mismatch**
   - **Discord per-channel thread without trigger word** — discord-tracker covers it; verify
   - **Slack per-channel without trigger word** — slack-messages-sync covers it; verify
   - **Coinbase wallet changes with interval** — current is trades; PRD asks for wallet listing + balance changes. Possible direction mismatch
3. Quick file searches to confirm presence/absence — no DB queries needed since prior audits established memory-write telemetry.

### Output structure
For each of the 21 integrations, a sub-table:

| User Story | Status | Notes / Root Cause / Direction Mismatch |
|---|---|---|

Status icons: ✅ working · 🔧 broken (root cause) · ⚙️ partial · ❌ not built · ⚠️ direction mismatch

End with:
- **Summary scoreboard** (counts per bucket across all stories)
- **Direction mismatches** (Spotify Music Finder vs liked-songs grab, Coinbase trades vs wallet listing, possibly others)
- **Biggest gaps** (Eventbrite, Google Contacts, OneDrive, Apple Health, iOS MusicKit, Native share extension, Instagram stories)

### Investigation steps before writing the report
A handful of parallel `code--search_files` calls to confirm presence/absence of: share-target manifest, googlecontacts, eventbrite, onedrive, musickit, healthkit, twitter bookmarks, youtube watch history endpoint, facebook friends API. ~5–8 search calls + 2–3 file reads. No DB queries (already done). No code changes.

Output: ~300–450 line markdown report.
