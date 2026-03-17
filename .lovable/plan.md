## Problem

The HubSpot ActiveMonitoring page has no contact history section. The user wants a list of previously synced contacts showing name, company, and sync timestamp.

## Investigation

The `hubspot_processed_contacts` table currently only has: `id`, `user_id`, `hubspot_contact_id`, `processed_at`. It does **not** store contact name or company.

## Plan

### 1. DB Migration — add `contact_name` and `company` columns

Add two nullable text columns to `hubspot_processed_contacts`:

- `contact_name text`
- `company text`

These will be populated by the edge function in future syncs. Existing rows will show "Unknown Contact" as fallback.

### 2. Modify `ActiveMonitoring.tsx` — add Contact History section

- Add `useState` for `history` and `historyLoading`
- Add `useEffect` that fetches from `hubspot_processed_contacts` ordered by `processed_at desc`, limit 50
- Render a "Contact History" card between the "Monitoring" card and the action buttons
- Each entry shows: initials avatar, contact name in bold (fallback "Unknown Contact"), company below the name, and relative timestamp right-aligned
- Loading spinner and empty state included
- Import `useState`, `useEffect` from React, `supabase` client, and `Loader2`/`UserPlus` icons

### Files changed

- `hubspot_processed_contacts` table — 2 new columns (DB migration)
- `src/components/flows/hubspot-automation/ActiveMonitoring.tsx` — contact history UI