
This is a deep-dive research/audit task — no code changes. I need to investigate root causes across ~10 specific threads. Let me lay out the investigation plan tightly.

## Investigation Plan: Root-Cause Deep Dive on Flagged Threads

### Files I need to read (parallel)
1. `supabase/functions/coinbase-trades-poll/index.ts` — every Composio slug attempted, full call sequence, return shapes
2. `supabase/functions/trello-automation-triggers/index.ts` + `src/components/flows/trello-automation/*` (BoardPicker, BoardOverview, ActiveMonitoring) + `useTrelloAutomation.ts` — find where setup stalls
3. `supabase/functions/calendar-event-sync/index.ts` — trace `events_created++` vs `pending_calendar_events` insert/delete lifecycle
4. `supabase/functions/facebook-page-posts/index.ts` — confirm `pollPagePosts` writes to `facebook_synced_posts` (the dedupe table) and whether `posts_synced++` happens regardless
5. `supabase/functions/twitter-sync/index.ts` — locate the missing `memories_created_count` increment
6. `supabase/functions/spotify-music-finder/index.ts` + `useSpotifyMusicFinder.ts` — capture path
7. `supabase/functions/google-photos-sync/index.ts` — `listPhotos` API coverage + sync logic
8. `supabase/functions/twitter-alpha-tracker/index.ts` — capture path for `twitter_alpha_posts`
9. `supabase/functions/linkedin-*` (find the function name) + `linkedin_extension_events` table flow

### DB queries (read-only) to verify telemetry
- `SELECT COUNT(*), MAX(created_at) FROM pending_calendar_events` — does it ever populate?
- `SELECT COUNT(*), MAX(synced_at) FROM facebook_synced_posts` — confirm dedupe table writes
- `SELECT COUNT(*) FROM coinbase_processed_trades` — has any trade ever landed?
- `SELECT COUNT(*), MAX(processed_at) FROM twitter_alpha_posts` — capture activity
- `SELECT COUNT(*), MAX(created_at) FROM linkedin_extension_events` — extension activity
- `SELECT memories_created_count, posts_synced_count FROM twitter_sync_config WHERE posts_synced_count > 0` — confirm the counter gap
- `SELECT events_created, (SELECT COUNT(*) FROM pending_calendar_events p WHERE p.user_id = c.user_id) FROM calendar_event_sync_config c WHERE events_created > 0` — verify pipeline integrity

### Composio Proxy / brokerage fills check
For coinbase specifically, I'll grep for `COINBASE_*` slugs, `proxy/execute`, and `/api/v3/brokerage/orders/historical/fills` references across the function and any related files. I'll determine:
- Which slugs are tried (account list, transactions list, etc.)
- Whether `coinbase_processed_trades` is ever written
- Whether the brokerage historical fills endpoint is reachable via Composio Proxy and whether we attempt it

### Output format

A single research report (no plan, no code) with these sections:

1. **Coinbase-trades deep dive** — full slug-by-slug walkthrough with returned shapes, proxy verdict, and "API gap vs wiring bug" classification
2. **Trello-tracker setup stall** — exact UI step or backend call that breaks completion
3. **Calendar-event-sync 35-counter integrity** — does `pending_calendar_events` get deleted on success or never inserted to begin with
4. **Facebook-page-posts counter vs dedupe** — verifies whether `facebook_synced_posts` writes happen and whether counter increments without them
5. **Twitter-sync increment bug** — exact line + reason
6. **Recently-shipped vs broken vs limited** for spotify-music-finder, google-photos-sync, twitter-alpha-tracker, linkedin-live — each tagged with one of three categories
7. **Status table** — every audited thread tagged as: ✅ solid & tested, 🔧 known root cause + fix path, or ⚠️ direction mismatch vs PRD

No file changes. Pure research output, ~300-500 lines.
