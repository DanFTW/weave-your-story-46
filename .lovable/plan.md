

# Facebook Page Posts Thread

## Overview
Add a new "Facebook Page Posts" thread that provides ongoing automated sync of Facebook Page posts (toggle-based), with post cards below the toggle. Follows the exact same patterns as Google Drive Automation and Instagram Analytics flows.

## Architecture

```text
Thread Card (threads.ts)
  → Thread Overview (threadConfigs.ts) 
    → Flow Page (flowConfigs.ts + FlowPage.tsx)
      → FacebookPagePostsFlow component
        ├── Auth gate (useComposio 'FACEBOOK')
        ├── MonitorToggle (reuse pattern from GoogleDrive)
        ├── Post cards list (fetched from facebook_synced_posts)
        └── Hook: useFacebookPagePosts
```

## Changes

### 1. New DB table: `facebook_page_posts_config`
Migration to create a config table for this separate automation (not reusing `facebook_sync_config` to avoid coupling with Facebook Dump):
- `id`, `user_id`, `is_active`, `posts_synced`, `last_polled_at`, `created_at`, `updated_at`
- RLS policies for user-scoped CRUD

### 2. New edge function: `facebook-page-posts`
A new edge function (separate from `facebook-sync`) that:
- Supports `action: 'poll'` — fetches page posts via `/me/accounts` → `/{pageId}/posts` (same Graph API pattern already in `facebook-sync`)
- Deduplicates using `facebook_synced_posts` table (same table, same logic)
- Creates memories via LIAM API (same crypto signing pattern)
- Supports `action: 'activate'` / `action: 'deactivate'` to toggle `is_active`
- Also supports cron-based invocation with `x-cron-secret` header for scheduled polling

### 3. Data files updates
- **`src/data/threads.ts`**: Add new thread entry `facebook-page-posts` with `flowMode: "thread"`, `triggerType: "automatic"`, `integrations: ["facebook"]`
- **`src/data/threadConfigs.ts`**: Add config with steps (Connect Facebook, Enable Monitoring, Always-On Monitoring)
- **`src/data/flowConfigs.ts`**: Add config with `isFacebookPagePostsFlow: true`
- **`src/pages/Threads.tsx`**: Add `'facebook-page-posts'` to `flowEnabledThreads`
- **`src/pages/ThreadOverview.tsx`**: Already handles it via `flowEnabledThreads` (add there too)

### 4. Types
- **`src/types/flows.ts`**: Add `isFacebookPagePostsFlow?: boolean`
- **`src/types/facebookPagePosts.ts`**: New file with phase, config, and stats types

### 5. Hook: `src/hooks/useFacebookPagePosts.ts`
Follows `useInstagramAnalytics` pattern:
- `loadConfig()` — reads from `facebook_page_posts_config`
- `activateMonitoring()` — calls edge function with `action: 'activate'`
- `deactivateMonitoring()` — calls edge function with `action: 'deactivate'`
- `manualPoll()` — calls edge function with `action: 'poll'`
- `loadSyncedPosts()` — fetches from `facebook_synced_posts` where user matches
- Returns `phase`, `config`, `stats`, `syncedPosts`, loading states

### 6. UI Components: `src/components/flows/facebook-page-posts/`
- **`FacebookPagePostsFlow.tsx`**: Main flow component (follows GoogleDrive/InstagramAnalytics pattern)
  - Auth gate via `useComposio('FACEBOOK')`
  - If not connected → redirect to `/integration/facebook`
  - Header with gradient + back button
  - MonitorToggle card with Switch
  - Post cards list below
- **`PagePostCard.tsx`**: Individual post card showing message text, formatted date, and permalink
- **`index.ts`**: Barrel export

### 7. FlowPage.tsx routing
Add `isFacebookPagePostsFlow` check before existing Facebook Sync check, rendering `<FacebookPagePostsFlow />`

### Key Decisions
- **Separate edge function**: Does not modify `facebook-sync` as instructed
- **Shares `facebook_synced_posts` table**: Same dedup table ensures no duplicate memories across both flows
- **Separate config table**: Keeps Facebook Dump and Facebook Page Posts independent

