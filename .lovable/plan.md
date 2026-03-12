
Investigation complete (read-only). I traced `/flow/instagram-sync` end-to-end through UI hook, edge function, DB state, and edge logs.

### What I verified

1. **Flow path used by the page**
   - `/flow/instagram-sync` → `useInstagramSync.syncNow()` → `instagram-sync` edge function (`action: "sync"`).
   - In edge function, post creation is gated by dedupe from `instagram_synced_posts`.

2. **Latest sync run evidence (from `instagram-sync` logs)**
   - `Config — posts: true, comments: true, stories: true`
   - `21 previously synced items`
   - `Normalized 21 posts`
   - Final: `posts: {"fetched":21,"saved":0,"skipped":21,"failed":0}`

3. **DB state for the same user (`327c3c6a-...`)**
   - `instagram_synced_posts`: **21 rows total**, all treated as synced markers.
   - `instagram_synced_post_content`: **21 rows** (local post snapshots exist).
   - `instagram_sync_config`: `posts_synced_count=21`, `memories_created_count=21`, last sync updated.
   - `user_integrations`: Instagram status is `connected`.
   - `user_api_keys`: all required keys present.

### Failures recorded + exact reasons

1. **Primary failure (posts not newly generated)**
   - **Observed behavior:** posts are detected (21 fetched) but no memories are generated in current runs.
   - **Reason (certain):** every fetched post is deduped by `instagram_synced_posts.instagram_post_id` before memory creation is attempted.
   - **Code path:** `isDuplicate(syncedIds, item.externalId)` short-circuits all 21 items; therefore `createMemory(...)` is never reached for posts in this run.

2. **Stories failure (known integration limitation)**
   - **Observed behavior:** stories always 0.
   - **Reason (certain):** Composio returns missing tool for `INSTAGRAM_GET_IG_USER_STORIES`; function now skips gracefully (no crash), so story sync does not produce data.

3. **Comments behavior**
   - **Observed behavior:** comments are attempted per post but skipped due missing Composio comments tool (`INSTAGRAM_GET_IG_MEDIA_COMMENTS`).
   - **Reason (certain):** integration endpoint not available; handled as skip.

### Patterns/anomalies

1. **Dedupe marker and actual memory creation are not strongly linked**
   - `instagram_synced_posts` is the sole dedupe source.
   - Once a post ID exists there, future runs skip it regardless of whether re-generation is desired.

2. **Historical counters can appear successful while current run creates nothing**
   - Config shows `memories_created_count=21`, but latest run created `0`.
   - This can make the UI look “already synced” while current sync does no creation work.

3. **No force-reset observed in recent `instagram-sync` logs**
   - No `action: force-reset-sync` entry in the captured recent logs.
   - Current dedupe set remained intact during the failing run.

### Root cause (with certainty)

For the current unresolved issue in `/flow/instagram-sync`, the root cause is:
- **All detected posts are being skipped by dedupe because they already exist in `instagram_synced_posts`; therefore post memory creation is not executed at all in current sync runs.**

This is directly proven by logs (`fetched 21 / skipped 21 / saved 0`), code flow (dedupe before create), and DB state (21 sync markers present).

### Initial solution options (evidence-based)

1. **Operational reset path (no code behavior change)**
   - Clear dedupe markers (`force-reset-sync`) and run sync again so posts are processed and memory creation executes.

2. **Code hardening path (prevents repeat of this class of issue)**
   - Make dedupe depend on a stronger “success marker” (e.g., confirmed memory linkage) rather than only external ID presence.

3. **Observability improvement**
   - Add explicit run-level reporting for “skipped due existing marker” vs “created now” in UI copy to avoid false perception of active generation.
