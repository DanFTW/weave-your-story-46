# Plan: Instagram Analytics to Memory Thread

## Summary

Create a new thread "Instagram Analytics to Memory" that uses `INSTAGRAM_GET_USER_INSIGHTS` via Composio to save Instagram analytics as memories. The flow: 1) Connect to Instagram, 2) Toggle analytics tracking on/off with a log of collected analytics memories.

**Note:** The user mentioned "Connect to Coinbase" in the flow description, but since this is an Instagram analytics thread, the connection step will be Instagram. Proceeding with that assumption.

## Files to Create

### 1. `src/types/instagramAnalytics.ts`

Type definitions following `coinbaseTradesAutomation.ts` pattern:

- `InstagramAnalyticsPhase`: `'auth-check' | 'configure' | 'activating' | 'active'`
- `InstagramAnalyticsConfig`: id, userId, isActive, insightsCollected, lastPolledAt, timestamps
- `InstagramAnalyticsStats`: insightsCollected, isActive, lastPolledAt

### 2. `src/hooks/useInstagramAnalytics.ts`

Hook following `useCoinbaseTradesAutomation.ts` pattern:

- Reads/creates config from `instagram_analytics_config` table
- `activateMonitoring()` / `deactivateMonitoring()` / `manualPoll()` calling edge function `instagram-analytics-poll`
- Phase management and toast feedback

### 3. `src/components/flows/instagram-analytics/InstagramAnalyticsFlow.tsx`

Main flow component following `CoinbaseTradesFlow.tsx` pattern:

- Uses `useComposio('INSTAGRAM')` for auth gate
- Uses `useInstagramAnalytics()` for state
- Redirects to `/integration/instagram` if not connected
- Renders AutomationConfig or ActiveMonitoring based on phase
- Reuse existing Instagram thread/integration styling patterns from the codebase

### 4. `src/components/flows/instagram-analytics/AutomationConfig.tsx`

Configure screen following Coinbase's `AutomationConfig.tsx`:

- Explains what gets tracked from the insights returned by `INSTAGRAM_GET_USER_INSIGHTS`
- Single "Activate Analytics Tracking" button

### 5. `src/components/flows/instagram-analytics/ActiveMonitoring.tsx`

Active state following Coinbase's `ActiveMonitoring.tsx`:

- Green pulse "Monitoring Active" indicator
- Stats card showing insights collected count
- Last polled timestamp
- Simple recent log of collected analytics memories
- Check Now / Pause buttons

### 6. `src/components/flows/instagram-analytics/ActivatingScreen.tsx`

Loading screen with Instagram-branded pink spinner

### 7. `src/components/flows/instagram-analytics/index.ts`

Barrel export file

### 8. `supabase/functions/instagram-analytics-poll/index.ts`

Edge function following `coinbase-trades-poll` pattern:

- Actions: `activate`, `deactivate`, `manual-poll`
- Uses `INSTAGRAM_GET_USER_INSIGHTS` via Composio tool execution
- Formats returned insights as structured memory text
- Deduplicates via `instagram_analytics_processed` table using a normalized insight snapshot/dedupe key
- Creates memories via LIAM API (same crypto signing pattern)

## Files to Modify

### 9. `src/data/threads.ts`

Add thread entry:

```
{ id: "instagram-analytics", title: "Instagram Analytics to Memory", description: "Save Instagram analytics like profile views, reach, and follower count as memories", icon: BarChart3, gradient: "pink", status: "active", type: "automation", category: "social", integrations: ["instagram"], triggerType: "automatic", flowMode: "thread" }

```

### 10. `src/pages/Threads.tsx`

Add `"instagram-analytics"` to `flowEnabledThreads` array

### 11. `src/data/flowConfigs.ts`

Add flow config entry with `isInstagramAnalyticsFlow: true`

### 12. `src/types/flows.ts`

Add `isInstagramAnalyticsFlow?: boolean` to `FlowConfig` interface

### 13. `src/data/threadConfigs.ts`

Add thread config with steps: Connect Instagram → Enable Monitoring → Always-On Monitoring

### 14. `src/pages/FlowPage.tsx`

- Import `InstagramAnalyticsFlow`
- Add conditional render block: `if (config.isInstagramAnalyticsFlow) return <InstagramAnalyticsFlow />;`

### 15. `supabase/config.toml`

Add `[functions.instagram-analytics-poll]` with auth configuration matching the project's established pattern for comparable functions

## Database Migration

Create table `instagram_analytics_config`:

- `id uuid PK default gen_random_uuid()`
- `user_id uuid NOT NULL`
- `is_active boolean NOT NULL DEFAULT false`
- `insights_collected integer NOT NULL DEFAULT 0`
- `last_polled_at timestamptz NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`
- RLS: user can SELECT/INSERT/UPDATE own rows

Create table `instagram_analytics_processed`:

- `id uuid PK default gen_random_uuid()`
- `user_id uuid NOT NULL`
- `dedupe_key text NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`
- RLS: user can SELECT/INSERT own rows

## Design Consistency

- Reuse existing Instagram thread/integration styling patterns from the codebase
- Same card/button patterns as Coinbase Trades flow
- Instagram icon from existing assets
- `BarChart3` lucide icon for the thread card (analytics-specific)