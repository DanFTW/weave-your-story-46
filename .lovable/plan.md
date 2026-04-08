

## Full RLS Audit — All Public Tables

### Summary

RLS is **enabled** on all 60 public tables. No table is missing RLS entirely. However, several tables are missing policies for specific operations, and one table (`app_settings`) has **zero policies** — meaning RLS is on but nothing can be read or written through the client at all.

### Categorized Findings

#### 1. `app_settings` — NO POLICIES AT ALL
This table has no `user_id` column (just `key`, `value`, `created_at`). It's a global settings table. With RLS on and zero policies, it's effectively locked from the client. This is likely intentional (service-role only access). **No action needed** unless client-side reads are required.

#### 2. Config tables missing DELETE policy
Per the thread-gate-pattern architecture, config tables need DELETE for `resetConfig`. These are missing it:

| Table | Has S | Has I | Has U | Missing |
|---|---|---|---|---|
| `birthday_reminder_config` | Y | Y | Y | **DELETE** |
| `calendar_event_sync_config` | Y | Y | Y | **DELETE** |
| `coinbase_trades_config` | Y | Y | Y | **DELETE** |
| `email_receipt_sheet_config` | Y | Y | Y | **DELETE** |
| `email_text_alert_config` | Y | Y | Y | **DELETE** |
| `facebook_page_posts_config` | Y | Y | Y | **DELETE** |
| `fireflies_automation_config` | Y | Y | Y | **DELETE** |
| `googledrive_automation_config` | Y | Y | Y | **DELETE** |
| `grocery_sheet_config` | Y | Y | Y | **DELETE** |
| `instagram_analytics_config` | Y | Y | Y | **DELETE** |
| `profiles` | Y | Y | Y | **DELETE** |
| `restaurant_bookmark_config` | Y | Y | Y | **DELETE** |
| `spotify_music_finder_config` | Y | Y | Y | **DELETE** |
| `todoist_automation_config` | Y | Y | Y | **DELETE** |
| `user_api_keys` | Y | Y | Y | **DELETE** |
| `weekly_event_finder_config` | Y | Y | Y | **DELETE** |

#### 3. Processed/log tables missing INSERT (edge-function only)
- `fireflies_processed_transcripts` — only has SELECT. INSERT is done by edge function with service role. **By design, no fix needed.**

#### 4. Tables that are fully covered (all 4 ops or intentionally append-only)
All remaining tables have the appropriate policies for their use case. Processed/log tables intentionally lack UPDATE/DELETE.

### Plan

Run a single migration adding DELETE policies to the 16 config tables listed above. Each policy follows the standard pattern:

```sql
CREATE POLICY "Users can delete own <table>" 
ON public.<table> FOR DELETE 
TO authenticated USING (auth.uid() = user_id);
```

For `profiles`, the column is `id` not `user_id`, so its policy uses `auth.uid() = id`.

No code changes needed — this is purely a database migration.

### Tables intentionally left without changes
- `app_settings` — no `user_id`, global config, service-role only access
- `fireflies_processed_transcripts` — INSERT done by service role only
- All `_processed` / `_sent` / `_synced` tables — append-only by design, no client DELETE/UPDATE needed

