# Plan: Facebook Posts Dump Thread

## Overview

Build a new "Facebook Dump" thread following the exact same architecture as the existing Twitter Dump thread (`twitter-sync`). Users connect Facebook, then import all their Facebook Page posts into LIAM as lead memories.

## Database Migrations

Two new tables:

`facebook_sync_config` — mirrors `twitter_sync_config`:

- `id` UUID PK
- `user_id` UUID NOT NULL (unique)
- `sync_posts` boolean DEFAULT true
- `is_active` boolean DEFAULT false
- `last_sync_at` timestamptz NULL
- `last_synced_post_id` text NULL
- `posts_synced_count` integer DEFAULT 0
- `memories_created_count` integer DEFAULT 0
- `created_at` / `updated_at` timestamptz

`facebook_synced_posts` — dedup table, mirrors `twitter_synced_posts`:

- `id` UUID PK
- `user_id` UUID NOT NULL
- `facebook_post_id` text NOT NULL
- `synced_at` timestamptz DEFAULT now()
- UNIQUE constraint on `(user_id, facebook_post_id)`

RLS: standard user-owns-row policies (SELECT, INSERT, UPDATE, DELETE) on both. Trigger for `updated_at` on config table.

## Frontend Changes

### 1. Thread entry (`src/data/threads.ts`)

Add new thread object:

```
id: "facebook-sync"
title: "Facebook Dump"
description: "Save your Facebook posts as memories"
icon: Facebook (from lucide-react, or use existing icon)
gradient: "blue"
flowMode: "dump"
integrations: ["facebook"]
triggerType: "manual"

```

### 2. Flow config (`src/data/flowConfigs.ts`)

Add entry with `isFacebookSyncFlow: true` flag.

### 3. Thread config (`src/data/threadConfigs.ts`)

Add a `facebook-sync` config with steps describing the flow.

### 4. Register in routing

- Add `'facebook-sync'` to `flowEnabledThreads` in `Threads.tsx` and `ThreadOverview.tsx`
- Add `FacebookSyncFlow` import and `if (config.isFacebookSyncFlow) return <FacebookSyncFlow />` in `FlowPage.tsx`

### 5. Flow UI (`src/components/flows/facebook-sync/`)

Three components following Twitter Dump pattern:

`FacebookSyncFlow.tsx` — main orchestrator:

- Uses `useComposio('FACEBOOK')` to check connection
- Uses `useFacebookSync()` hook for state
- Redirects to `/integration/facebook` if not connected
- Renders header with blue gradient + Facebook icon
- Routes to `FacebookSyncConfig` or `FacebookSyncActive` based on phase

`FacebookSyncConfig.tsx` — initial setup:

- Explanation card: "Import your Facebook posts as memories"
- Primary button: "Dump posts now"

`FacebookSyncActive.tsx` — post-sync dashboard:

- Stats: last synced time, posts imported count, memories created
- "Sync now" button for incremental sync
- Configure / Reset options
- Shows sync result summary after each sync

### 6. Hook (`src/hooks/useFacebookSync.ts`)

Mirrors `useTwitterSync.ts`:

- Phases: `auth-check`, `configure`, `syncing`, `active`
- `loadConfig()` — reads from `facebook_sync_config`
- `saveConfig()` — upserts config
- `syncNow()` — invokes `facebook-sync` edge function with action `sync`
- `resetSync()` — invokes with action `reset-sync`
- State: `syncConfig`, `isSyncing`, `isLoading`, `lastSyncResult`

### 7. Types (`src/types/facebookSync.ts`)

```ts
type FacebookSyncPhase = 'auth-check' | 'configure' | 'syncing' | 'active';
interface FacebookSyncConfig { ... }
interface FacebookPost { id, message, createdTime, permalink, ... }
interface FacebookSyncResult { success, postsSynced, memoriesCreated }

```

## Backend: Edge Function

### `supabase/functions/facebook-sync/index.ts`

Mirrors `twitter-sync/index.ts` structure:

**Actions:**

- `sync` — main sync/dump action
- `reset-sync` — clears synced posts + resets config

**Sync logic:**

1. Auth check (JWT → user)
2. Get user's Facebook integration from `user_integrations` (integration_id = `facebook`)
3. Fetch Facebook Page posts via Composio tool `FACEBOOK_GET_PAGE_POSTS`
4. Load already-synced post IDs from `facebook_synced_posts`
5. Filter to only unseen posts
6. For each new post:
  - Format as memory content (post text, date, URL, metadata)
  - Create LIAM memory with tag `FACEBOOK` using same signing pattern as twitter-sync
  - Insert into `facebook_synced_posts` for dedup
7. Update `facebook_sync_config` with counts and timestamps
8. Return result summary

**Memory format:**

```
Facebook Post
Posted on March 10, 2026

[post text/message]

Source: Facebook | Post ID: 123456 | URL: https://facebook.com/...

```

**Facebook data fetching:**

- Use Composio tool `FACEBOOK_GET_PAGE_POSTS` to retrieve posts
- Request fields: `id, message, created_time, permalink_url, type, status_type`
- Paginate through all results for initial dump
- For incremental: compare against last synced post ID

## Config.toml

Add `[functions.facebook-sync]` with `verify_jwt = false` (auth handled in code).

## Files Created/Modified

**New files:**

- `src/types/facebookSync.ts`
- `src/hooks/useFacebookSync.ts`
- `src/components/flows/facebook-sync/FacebookSyncFlow.tsx`
- `src/components/flows/facebook-sync/FacebookSyncConfig.tsx`
- `src/components/flows/facebook-sync/FacebookSyncActive.tsx`
- `src/components/flows/facebook-sync/SyncingScreen.tsx`
- `src/components/flows/facebook-sync/index.ts`
- `supabase/functions/facebook-sync/index.ts`
- DB migration for the two tables

**Modified files:**

- `src/data/threads.ts` — add facebook-sync entry
- `src/data/flowConfigs.ts` — add facebook-sync config
- `src/data/threadConfigs.ts` — add facebook-sync config
- `src/pages/FlowPage.tsx` — add import + routing
- `src/pages/Threads.tsx` — add to `flowEnabledThreads`
- `src/pages/ThreadOverview.tsx` — add to `flowEnabledThreads`
- `supabase/config.toml` — add function entry