# Spotify Music Finder Thread — Implementation Plan

## Overview

A new thread that reads the user's memories to discover their mood and themes, finds a matching song on Spotify, and adds it to a chosen playlist on a recurring basis. After adding, it writes a memory back to LIAM documenting the recommendation (also serving as deduplication).

## Architecture

```text
┌─────────────────────────────────────────────┐
│  Frontend (React)                           │
│  ┌─────────────────────────────────────┐    │
│  │ SpotifyMusicFinderFlow              │    │
│  │  Phase: auth-check → configure →    │    │
│  │         activating → active         │    │
│  └──────────────┬──────────────────────┘    │
│                 │ supabase.functions.invoke  │
│  ┌──────────────┴──────────────────────┐    │
│  │ useSpotifyMusicFinder (hook)        │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────┐
│  Edge Function: spotify-music-finder        │
│  Actions: activate, deactivate, manual-poll,│
│           stats, list-playlists, cron-poll   │
│                                             │
│  1. Fetch recent memories (LIAM list)       │
│  2. LLM call → generate search query        │
│  3. SPOTIFY_SEARCH_FOR_ITEM via Composio    │
│  4. SPOTIFY_ADD_ITEMS_TO_PLAYLIST           │
│  5. Write memory back to LIAM              │
└─────────────────────────────────────────────┘

```

## Database

**New table:** `spotify_music_finder_config`

- `id` uuid PK
- `user_id` uuid (references auth.users, unique)
- `playlist_id` text not null
- `playlist_name` text
- `frequency` text default 'daily' (daily | weekly)
- `is_active` boolean default false
- `songs_added` integer default 0
- `last_polled_at` timestamptz
- `created_at` / `updated_at` timestamptz

RLS: users can only read/write their own rows.

## Files to Create/Modify

### 1. Thread Registration

- `src/data/threads.ts` — Add `spotify-music-finder` thread entry in `mainThreads` with `icon: Music`, `gradient: "teal"`, `integrations: ["spotify"]`, `triggerType: "automatic"`, `flowMode: "thread"`.
- `src/pages/Threads.tsx` — Add `'spotify-music-finder'` to `flowEnabledThreads` array.
- `src/components/ThreadCard.tsx` — Add `spotify` to `integrationColors` with green Spotify brand colors (`#1DB954`).

### 2. Flow Config + Type Registration

- `src/types/flows.ts` — Add `isSpotifyMusicFinderFlow?: boolean`.
- `src/data/flowConfigs.ts` — Add `"spotify-music-finder"` config with `isSpotifyMusicFinderFlow: true`.
- `src/data/threadConfigs.ts` — Add thread detail sheet config with 3 steps (Connect Spotify, Select Playlist & Frequency, Always-On Discovery).

### 3. Frontend Flow Components

- `src/components/flows/spotify-music-finder/SpotifyMusicFinderFlow.tsx` — Main flow component following the Instagram automation pattern: auth-check → configure → activating → active. Uses `useComposio('SPOTIFY')` for auth gating and the sessionStorage redirect pattern.
- `src/components/flows/spotify-music-finder/SpotifyMusicFinderConfig.tsx` — Config screen: playlist selector dropdown (fetched via edge function `list-playlists` action), frequency toggle (daily/weekly), and "Start Discovery" button.
- `src/components/flows/spotify-music-finder/SpotifyMusicFinderActive.tsx` — Active monitoring screen showing songs added count, last checked time, check now / pause buttons. Matches `ActiveMonitoring` pattern.
- `src/components/flows/spotify-music-finder/ActivatingScreen.tsx` — Simple loading screen, same pattern as Instagram's.
- `src/components/flows/spotify-music-finder/index.ts` — Barrel export.

### 4. React Hook

- `src/hooks/useSpotifyMusicFinder.ts` — Manages phase state, config CRUD against `spotify_music_finder_config`, activate/deactivate/manual-poll/stats actions via the edge function. Direct clone of `useInstagramAutomation` adapted for Spotify fields (playlistId, frequency, songsAdded).

### 5. FlowPage Integration

- `src/pages/FlowPage.tsx` — Import `SpotifyMusicFinderFlow`, add `if (config.isSpotifyMusicFinderFlow) return <SpotifyMusicFinderFlow />`.

### 6. Composio Config

- `supabase/functions/composio-connect/index.ts` — Add `spotify: "ac_VEoX-dA2CYrF"` to `AUTH_CONFIGS` and `"spotify"` to `VALID_TOOLKITS`.

### 7. Edge Function

- `supabase/functions/spotify-music-finder/index.ts` — Core backend logic:
  - `list-playlists`: Calls `SPOTIFY_GET_CURRENT_USER_S_PLAYLISTS` via Composio. Must handle pagination — some users have hundreds of playlists, so loop through all pages and return the full playlist id/name array.
  - `activate`: Sets `is_active: true` in config.
  - `deactivate`: Sets `is_active: false`.
  - `manual-poll` and `cron-poll`: The main discovery logic:
    1. Fetch recent memories from LIAM (`/memory/list`).
    2. Call LLM with memories as context to generate a Spotify search query capturing mood/themes. Use whichever LLM call pattern already exists in the codebase (e.g. Anthropic via `ANTHROPIC_API_KEY` in Supabase secrets) — do not introduce a new LLM provider.
    3. Call `SPOTIFY_SEARCH_FOR_ITEM` via Composio with the query. If zero results are returned, retry once with a broader/simplified query. If still zero, skip gracefully and try again next cycle.
    4. Pick the top track not already in memories (dedup via LIAM tag search for `SPOTIFY`). As an additional check, call `SPOTIFY_GET_PLAYLIST_ITEMS` on the target playlist to ensure the track isn't already present — the user may have added songs manually outside of Weave.
    5. Call `SPOTIFY_ADD_ITEMS_TO_PLAYLIST` via Composio.
    6. Write a memory back to LIAM with tag `SPOTIFY` documenting the song, artist, and reasoning.
    7. Increment `songs_added`, update `last_polled_at`.
  - `stats`: Returns current config stats.
  - Uses the same LIAM signing pattern, Composio tool execution pattern, and cron auth pattern as existing functions.

### 8. Cron Job

- Schedule via `cron.schedule` SQL insert: run `spotify-music-finder` edge function with `cron-poll` action daily (or check frequency per-user inside the function). Use the existing `CRON_SECRET` pattern.

## Key Design Decisions

- Reuses `useComposio` for Spotify OAuth with the existing Composio connect flow.
- LLM call inside the edge function must match the existing LLM call pattern in the codebase — do not introduce OpenRouter or any new LLM dependency.
- Deduplication: the memory written back after each song add (tagged `SPOTIFY`) doubles as the dedup list — before adding, query LIAM for existing `SPOTIFY` memories and exclude those tracks. Additionally, check the target playlist itself via `SPOTIFY_GET_PLAYLIST_ITEMS` to catch songs the user added manually.
- Frequency is stored per-user; the cron runs daily, but skips weekly users unless it's their day.