

# Multi-Account Twitter Alpha Tracker Implementation Plan

## Problem Summary

The current Twitter Alpha Tracker only supports tracking one account at a time. Users must use "Change Account" to switch between accounts. The requirement is to allow tracking **multiple accounts simultaneously**.

## Architecture Changes

### 1. Database Schema

**New Table: `twitter_alpha_tracked_accounts`**

This junction table stores multiple tracked accounts per user:

```sql
CREATE TABLE twitter_alpha_tracked_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  user_id_twitter TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  posts_tracked INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, username)
);
```

**Modified Table: `twitter_alpha_tracker_config`**

Remove single-account columns, keep global settings:
- Remove: `tracked_username`, `tracked_user_id`, `tracked_display_name`, `tracked_avatar_url`
- Keep: `is_active` (master toggle), `posts_tracked` (total), `last_polled_at`

### 2. Type Definitions

**File: `src/types/twitterAlphaTracker.ts`**

```typescript
// New interface for tracked account with individual stats
export interface TrackedTwitterAccountWithStats extends TrackedTwitterAccount {
  id: string;
  postsTracked: number;
}

// Updated stats interface
export interface TwitterAlphaTrackerStats {
  totalPostsTracked: number;
  isActive: boolean;
  lastChecked: string | null;
  trackedAccounts: TrackedTwitterAccountWithStats[]; // Array instead of single
}
```

### 3. Frontend Hook Changes

**File: `src/hooks/useTwitterAlphaTracker.ts`**

| Current | Updated |
|---------|---------|
| `selectedAccount: TrackedTwitterAccount \| null` | `selectedAccounts: TrackedTwitterAccount[]` |
| `selectAccount(account)` replaces | `addAccount(account)` adds to array |
| - | `removeAccount(username)` removes from array |
| - | `confirmAccountSelection()` saves batch |
| `stats.trackedAccount` single | `stats.trackedAccounts` array |

### 4. UI Component Changes

**AccountSearch.tsx - Multi-Select Mode**

```text
┌──────────────────────────────────────────────┐
│ 🔍 Search Twitter accounts...         [Search]│
└──────────────────────────────────────────────┘

Selected (2):
┌──────────────────────────────────────────────┐
│ ✓ @elonmusk                              ✕   │
│ ✓ @sama                                  ✕   │
└──────────────────────────────────────────────┘

Search Results:
┌──────────────────────────────────────────────┐
│ ☐ @vitalikbuterin                            │
│    Vitalik Buterin                           │
└──────────────────────────────────────────────┘

         [ Continue with 2 accounts ]
```

- Shows selected accounts as chips/tags with remove button
- Search results show checkbox state
- "Continue" button when at least 1 account selected

**ActiveMonitoring.tsx - Multi-Account Dashboard**

```text
┌──────────────────────────────────────────────┐
│ ● Tracking Active                            │
│   3 accounts monitored                       │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ 👤 @elonmusk         12 posts          [ ✕ ] │
│ 👤 @sama              8 posts          [ ✕ ] │
│ 👤 @vitalikbuterin    5 posts          [ ✕ ] │
└──────────────────────────────────────────────┘

Stats:
┌─────────────┬─────────────┐
│ 25          │ 5 min ago   │
│ Total Posts │ Last Check  │
└─────────────┴─────────────┘

[ Check Now ]  [ Pause All ]  [ + Add Account ]
```

- Lists all tracked accounts with individual post counts
- Remove button per account
- "Add Account" button returns to search phase (preserving existing accounts)

**AutomationConfig.tsx - Confirm Multiple Accounts**

Shows all selected accounts before activation, with option to add more or start tracking.

### 5. Edge Function Updates

**File: `supabase/functions/twitter-alpha-tracker/index.ts`**

**New Actions:**

| Action | Description |
|--------|-------------|
| `add-accounts` | Batch insert new accounts to tracked list |
| `remove-account` | Remove specific account by username |
| `get-tracked-accounts` | Fetch all tracked accounts for user |

**Updated Polling Logic:**

```typescript
// Before (single account):
const query = `from:${trackedUsername}`;

// After (multiple accounts):
const usernames = trackedAccounts.map(a => a.username);
const query = usernames.map(u => `from:${u}`).join(' OR ');
// Result: "from:elonmusk OR from:sama OR from:vitalikbuterin"
```

## Files to Modify

| Category | File | Changes |
|----------|------|---------|
| Migration | `supabase/migrations/xxx_multi_account.sql` | Create `twitter_alpha_tracked_accounts` table |
| Types | `src/types/twitterAlphaTracker.ts` | Add `TrackedTwitterAccountWithStats`, update `TwitterAlphaTrackerStats` |
| Hook | `src/hooks/useTwitterAlphaTracker.ts` | Multi-select state, batch operations |
| UI | `src/components/flows/twitter-alpha-tracker/AccountSearch.tsx` | Multi-select chips, continue button |
| UI | `src/components/flows/twitter-alpha-tracker/ActiveMonitoring.tsx` | Account list, individual remove |
| UI | `src/components/flows/twitter-alpha-tracker/AutomationConfig.tsx` | Show multiple accounts |
| Edge | `supabase/functions/twitter-alpha-tracker/index.ts` | New actions, multi-account polling |
| Supabase Types | `src/integrations/supabase/types.ts` | Add new table type |

## User Flow

```text
1. Search & Select Multiple Accounts
   ├── Search for account → Add to selection
   ├── Search for another → Add to selection
   ├── Remove from selection if needed
   └── Click "Continue" when ready

2. Configure & Activate
   ├── Review all selected accounts
   ├── Optionally add more
   └── Click "Start Tracking"

3. Active Dashboard
   ├── View all tracked accounts with stats
   ├── Remove individual accounts
   ├── Add new accounts (returns to search with existing preserved)
   ├── Pause/Resume all tracking
   └── Manual "Check Now" for all accounts
```

## Technical Considerations

1. **Twitter API Rate Limits**: With multiple accounts, the search query `from:user1 OR from:user2...` is more efficient than separate API calls per account

2. **Posts Per Account Stats**: Track `posts_tracked` per account in `twitter_alpha_tracked_accounts` for granular stats

3. **Deduplication**: The existing `twitter_alpha_processed_posts` table handles tweet deduplication across all tracked accounts

4. **Backward Compatibility**: Migrate existing single-account configs to the new multi-account structure

