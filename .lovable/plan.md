
# Twitter Alpha Tracker Implementation Plan

## Overview

Create a new thread called "Twitter Alpha Tracker" that monitors selected external Twitter accounts (not the user's own account) and creates memories whenever those accounts post new tweets.

## Architecture Pattern

Following the existing Trello Tracker pattern (which has multi-step account/board selection), combined with the Twitter polling infrastructure.

## Flow Steps

1. **Connect to Twitter** - Verify Twitter OAuth connection via Composio
2. **Select Account to Track** - Search and select a Twitter account by username
3. **Toggle Tracker On/Off** - Enable/disable monitoring with active dashboard

## Database Schema

### New Table: `twitter_alpha_tracker_config`
```sql
CREATE TABLE twitter_alpha_tracker_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracked_username TEXT NOT NULL,
  tracked_user_id TEXT NOT NULL,
  tracked_display_name TEXT,
  tracked_avatar_url TEXT,
  is_active BOOLEAN DEFAULT false,
  posts_tracked INTEGER DEFAULT 0,
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### New Table: `twitter_alpha_processed_posts`
```sql
CREATE TABLE twitter_alpha_processed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tweet_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tweet_id)
);
```

## Frontend Components

### 1. Thread Registration

**File: `src/data/threads.ts`**
Add new thread entry:
```typescript
{
  id: "twitter-alpha-tracker",
  title: "Twitter Alpha Tracker",
  description: "Track posts from any Twitter account as memories",
  icon: Twitter,
  gradient: "blue",
  status: "active",
  type: "automation",
  category: "social",
}
```

**File: `src/data/flowConfigs.ts`**
Add flow config:
```typescript
"twitter-alpha-tracker": {
  id: "twitter-alpha-tracker",
  title: "Twitter Alpha Tracker",
  subtitle: "Monitor any Twitter account",
  description: "Get notified when selected accounts post new tweets.",
  gradient: "blue",
  icon: Twitter,
  entryName: "post",
  entryNamePlural: "posts",
  memoryTag: "TWITTER",
  fields: [],
  isTwitterAlphaTrackerFlow: true,
}
```

**File: `src/types/flows.ts`**
Add type flag:
```typescript
isTwitterAlphaTrackerFlow?: boolean;
```

**Files: `src/pages/Threads.tsx` and `src/pages/ThreadOverview.tsx`**
Add `'twitter-alpha-tracker'` to the `flowEnabledThreads` array.

### 2. Type Definitions

**New File: `src/types/twitterAlphaTracker.ts`**
```typescript
export type TwitterAlphaTrackerPhase = 
  | 'auth-check'
  | 'select-account'
  | 'configure'
  | 'activating'
  | 'active';

export interface TrackedTwitterAccount {
  username: string;
  userId: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface TwitterAlphaTrackerConfig {
  id: string;
  userId: string;
  trackedUsername: string;
  trackedUserId: string;
  trackedDisplayName?: string;
  trackedAvatarUrl?: string;
  isActive: boolean;
  postsTracked: number;
  lastPolledAt: string | null;
}

export interface TwitterAlphaTrackerStats {
  postsTracked: number;
  isActive: boolean;
  lastChecked: string | null;
  trackedAccount: TrackedTwitterAccount | null;
}
```

### 3. Custom Hook

**New File: `src/hooks/useTwitterAlphaTracker.ts`**

Key responsibilities:
- Manage phase state (`auth-check` → `select-account` → `configure` → `active`)
- Search Twitter users via edge function
- Select and store tracked account
- Activate/deactivate monitoring
- Trigger manual polls
- Load and display stats

### 4. UI Components

**New Directory: `src/components/flows/twitter-alpha-tracker/`**

| Component | Purpose |
|-----------|---------|
| `TwitterAlphaTrackerFlow.tsx` | Main flow orchestrator (like TrelloAutomationFlow) |
| `AccountSearch.tsx` | Search input + results for finding Twitter accounts |
| `AutomationConfig.tsx` | Enable/activate tracking toggle |
| `ActiveMonitoring.tsx` | Dashboard showing tracked posts, pause button |
| `ActivatingScreen.tsx` | Loading screen during activation |
| `index.ts` | Barrel export |

### 5. FlowPage Integration

**File: `src/pages/FlowPage.tsx`**
Add import and conditional render:
```typescript
import { TwitterAlphaTrackerFlow } from "@/components/flows/twitter-alpha-tracker";

// In component body:
if (config.isTwitterAlphaTrackerFlow) {
  return <TwitterAlphaTrackerFlow />;
}
```

## Backend Edge Function

**New File: `supabase/functions/twitter-alpha-tracker/index.ts`**

### Actions Supported

| Action | Description |
|--------|-------------|
| `search-user` | Search Twitter for username, return profile info |
| `select-account` | Save tracked account to config table |
| `activate` | Enable background polling |
| `deactivate` | Disable polling |
| `manual-poll` | Check for new posts immediately |
| `cron-poll` | Background poll for all active users (called by pg_cron) |

### Composio API Integration

**User Lookup by Username:**
```typescript
// Using Composio v3 tool execution
POST https://backend.composio.dev/api/v3/tools/execute/TWITTER_USER_LOOKUP_BY_USERNAME
{
  "connected_account_id": connectionId,
  "arguments": {
    "username": "elonmusk"
  }
}
```

**Fetch User Tweets:**
```typescript
// Using Twitter recent search with author filter
POST https://backend.composio.dev/api/v3/tools/execute/TWITTER_RECENT_SEARCH
{
  "connected_account_id": connectionId,
  "arguments": {
    "query": "from:trackedUsername",
    "max_results": 50,
    "tweet.fields": "created_at,public_metrics"
  }
}
```

### Memory Creation

Follows existing LIAM API pattern:
- Fetch user's API keys from `user_api_keys` table
- Sign request with ECDSA P-256 (PKCS#8 format)
- POST to `https://web.askbuddy.ai/devspacexdb/api/memory/create`

Memory format:
```
Twitter Post from @elonmusk
January 28, 2026

{tweet text}

A post from an account you're tracking.
```

## Database Migration

**New File: `supabase/migrations/YYYYMMDD_twitter_alpha_tracker.sql`**

Creates:
- `twitter_alpha_tracker_config` table with RLS
- `twitter_alpha_processed_posts` table with RLS
- Policies for user-owned rows only

## UI/UX Flow

```text
┌──────────────────────────────────────────────┐
│ 1. Auth Check                                │
│    └─ If not connected → redirect to         │
│       /integration/twitter                   │
└──────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ 2. Select Account                            │
│    ┌─────────────────────────────────────┐   │
│    │ 🔍 Search Twitter accounts...       │   │
│    └─────────────────────────────────────┘   │
│    ┌─────────────────────────────────────┐   │
│    │ 👤 @elonmusk                        │   │
│    │    Elon Musk                        │   │
│    └─────────────────────────────────────┘   │
│    ┌─────────────────────────────────────┐   │
│    │ 👤 @sama                            │   │
│    │    Sam Altman                       │   │
│    └─────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ 3. Configure                                 │
│    Tracking @elonmusk                        │
│    ┌─────────────────────────────────────┐   │
│    │ [  Start Tracking  ]                │   │
│    └─────────────────────────────────────┘   │
│    [ Change Account ]                        │
└──────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ 4. Active Dashboard                          │
│    ┌─────────────────────────────────────┐   │
│    │ ● Tracking Active                   │   │
│    │   @elonmusk                         │   │
│    │   Posts Tracked: 24                 │   │
│    │   Last checked: 5 mins ago          │   │
│    └─────────────────────────────────────┘   │
│    [ Check Now ]  [ Pause ]  [ Change ]      │
└──────────────────────────────────────────────┘
```

## Files Summary

| Category | File | Action |
|----------|------|--------|
| Types | `src/types/twitterAlphaTracker.ts` | Create |
| Types | `src/types/flows.ts` | Edit (add flag) |
| Data | `src/data/threads.ts` | Edit (add thread) |
| Data | `src/data/flowConfigs.ts` | Edit (add config) |
| Pages | `src/pages/Threads.tsx` | Edit (add to flowEnabledThreads) |
| Pages | `src/pages/ThreadOverview.tsx` | Edit (add to flowEnabledThreads) |
| Pages | `src/pages/FlowPage.tsx` | Edit (add flow render) |
| Hook | `src/hooks/useTwitterAlphaTracker.ts` | Create |
| Components | `src/components/flows/twitter-alpha-tracker/*.tsx` | Create (6 files) |
| Edge Function | `supabase/functions/twitter-alpha-tracker/index.ts` | Create |
| Migration | `supabase/migrations/YYYYMMDD_twitter_alpha_tracker.sql` | Create |

## Implementation Order

1. Database migration (tables + RLS policies)
2. Type definitions
3. Thread and flow config registration
4. Edge function (search, select, poll, memory creation)
5. Custom hook
6. UI components
7. FlowPage integration
8. Testing
