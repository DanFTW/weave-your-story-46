

## Weekly Event Finder Thread

A new thread that fetches user memories (interests, location) from LIAM, searches for local events via Composio, curates results with an LLM, and delivers via email (Gmail) or text (stubbed). Follows the email-text-alert pattern exactly.

### Files to Create

**1. `src/types/weeklyEventFinder.ts`** — Types mirroring `emailTextAlert.ts`
- `WeeklyEventFinderPhase`: `"auth-check" | "configure" | "activating" | "active"`
- `WeeklyEventFinderConfig`: id, userId, isActive, interests, location, frequency (`"weekly" | "daily"`), deliveryMethod (`"email" | "text"`), email, eventsFound count, timestamps
- `WeeklyEventFinderStats`: eventsFound, isActive

**2. `src/hooks/useWeeklyEventFinder.ts`** — Hook mirroring `useEmailTextAlert.ts`
- Manages phase, config, loading states
- `loadConfig`: reads from `weekly_event_finder_config` table, creates row if missing
- `updateConfig`: updates interests, location, frequency, delivery method, email
- `activate` / `deactivate`: invoke edge function
- `manualSync`: invoke edge function with `action: "manual-sync"`
- Pre-fills interests/location from LIAM memories via `useLiamMemory().listMemories()`

**3. `src/components/flows/weekly-event-finder/EventFinderConfig.tsx`** — Config screen
- Input fields for interests (pre-filled from LIAM memories tagged INTEREST/HOBBY) and location (pre-filled from LOCATION memories)
- If no memories found, user adds manually
- Frequency picker: weekly (default) / daily
- Delivery method: email (default) / text
- Email input (shown when delivery=email)
- Activate button

**4. `src/components/flows/weekly-event-finder/ActiveMonitoring.tsx`** — Active state
- Shows status, config summary, stats, sync now button, pause button
- Mirrors email-text-alert ActiveMonitoring

**5. `src/components/flows/weekly-event-finder/ActivatingScreen.tsx`** — Loading animation

**6. `src/components/flows/weekly-event-finder/WeeklyEventFinderFlow.tsx`** — Main flow component
- Gmail auth gate (when delivery=email), mirrors EmailTextAlertFlow pattern
- Renders EventFinderConfig or ActiveMonitoring based on phase

**7. `supabase/functions/weekly-event-finder/index.ts`** — Edge function
- Actions: `activate`, `deactivate`, `update-config`, `manual-sync`, `prefill`
- `prefill`: fetches LIAM memories, extracts interests/location, returns them
- `manual-sync`:
  1. Load config (interests, location, frequency)
  2. Search events via Composio `COMPOSIO_SEARCH_EVENT` (no auth — uses `COMPOSIO_API_KEY` only, no `connected_account_id`)
  3. Curate/rank results via LLM (Gemini Flash) based on user interests
  4. Deliver: email via Gmail (Composio `GMAIL_SEND_EMAIL`, using auth config `ac_IlbziSKZknmH`), or text via `console.log` stub
  5. Track in `weekly_event_finder_processed` table for dedup
  6. Update `events_found` counter

### Files to Modify

**8. `src/data/threads.ts`** — Add thread entry in `mainThreads`
- id: `"weekly-event-finder"`, title: `"Weekly Event Finder"`, icon: `Calendar`, gradient: `"purple"`, flowMode: `"thread"`, triggerType: `"automatic"`, integrations: `["gmail"]`

**9. `src/data/threadConfigs.ts`** — Add thread config
- Steps: Connect Gmail → Configure Preferences → Always-On Monitoring

**10. `src/data/flowConfigs.ts`** — Add flow config
- `isWeeklyEventFinderFlow: true`

**11. `src/types/flows.ts`** — Add `isWeeklyEventFinderFlow?: boolean`

**12. `src/pages/FlowPage.tsx`** — Add import + conditional render for `WeeklyEventFinderFlow`

**13. `src/pages/Threads.tsx`** — Add `"weekly-event-finder"` to `flowEnabledThreads`

**14. `src/pages/ThreadOverview.tsx`** — Add `"weekly-event-finder"` to `flowEnabledThreads`

### Database Migration

**Table: `weekly_event_finder_config`**
- id (uuid PK), user_id (uuid NOT NULL, references auth.users), is_active (boolean default false), interests (text), location (text), frequency (text default 'weekly'), delivery_method (text default 'email'), email (text), events_found (int default 0), created_at, updated_at
- RLS: users can select/insert/update their own rows

**Table: `weekly_event_finder_processed`**
- id (uuid PK), user_id (uuid NOT NULL), event_id (text), event_title (text), processed_at (timestamptz default now())
- Unique on (user_id, event_id)
- RLS: users can select their own rows

