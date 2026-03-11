# Plan: "Website Link to Memory" Thread

## Overview

Create a new thread that lets users paste a website URL, retrieve its content via Composio Search using Composio's FIRECRAWL tool, extract memory-worthy content, and review/save as LIAM memories.

## Architecture

```text
User pastes URL
  -> Edge function: website-scrape
     -> Composio FIRECRAWL_SCRAPE_URL tool (via tools/execute API)
     -> Returns markdown content
  -> Edge function: generate-memories (existing)
     -> AI extracts discrete memory statements from markdown
  -> Frontend: FlowPreview (existing component)
     -> User reviews, edits, deletes memories
  -> useLiamMemory.createMemory (existing)
     -> Saves each confirmed memory with tag 'WEBSITE'

```

## Files to Create

### 1. Edge Function: `supabase/functions/website-scrape/index.ts`

- Accepts `{ url: string }` in request body
- Validates URL format server-side
- Calls `https://backend.composio.dev/api/v3/tools/execute/FIRECRAWL_SCRAPE_URL` with COMPOSIO_API_KEY
- No `connected_account_id` needed (Firecrawl is an API-key tool via Composio, not user-OAuth)
- Returns scraped markdown content
- Add `[functions.website-scrape] verify_jwt = false` to config.toml

### 2. Types: `src/types/websiteScrape.ts`

- `WebsiteScrapePhase`: `'input' | 'scraping' | 'generating' | 'preview' | 'success'`
- `WebsiteScrapeResult`: `{ url, title, content, memoryCount }`

### 3. Hook: `src/hooks/useWebsiteScrape.ts`

- Manages phase state machine
- `scrapeUrl(url)`: invokes `website-scrape` edge function, returns markdown
- `generateMemories(content)`: calls existing `generate-memories` edge function to extract memory statements from the scraped markdown
- `confirmMemories()`: iterates through confirmed memories, calls `createMemory` from `useLiamMemory` with tag `'WEBSITE'`
- Manages `generatedMemories: GeneratedMemory[]` state for preview

### 4. Flow Components: `src/components/flows/website-scrape/`

- `WebsiteScrapeFlow.tsx`: Main component. Header with teal gradient, back button to `/threads`. Renders phase-appropriate child component. No auth gating needed (Firecrawl via Composio doesn't require user OAuth).
- `WebsiteUrlInput.tsx`: URL input field with validation, paste button, and "Extract Memories" CTA button.
- `ScrapingScreen.tsx`: Animated loading screen while scraping + generating (reuses pattern from SyncingScreen).
- `WebsiteScrapeSuccess.tsx`: Success screen showing count of saved memories with "Done" and "Scrape Another" buttons.
- `index.ts`: Barrel export.

The preview/review phase reuses the existing `FlowPreview` component pattern (with `MemoryPreviewCard` for swipe-to-delete and tap-to-edit).

## Files to Modify

### 5. Registration (minimal touchpoints)

- `src/types/threads.ts`: No changes needed (existing types suffice)
- `src/types/flows.ts`: Add `isWebsiteScrapeFlow?: boolean`
- `src/data/threads.ts`: Add thread entry `{ id: "website-scrape", title: "Website Link to Memory", icon: Globe, gradient: "teal", flowMode: "flow", triggerType: "manual", ... }`
- `src/data/threadConfigs.ts`: Add `"website-scrape"` config with 3 steps: Paste Link (setup), Extract Memories (setup), Review & Save (save)
- `src/data/flowConfigs.ts`: Add `"website-scrape"` entry with `isWebsiteScrapeFlow: true`, `memoryTag: "WEBSITE"`
- `src/pages/Threads.tsx`: Add `'website-scrape'` to `flowEnabledThreads` array
- `src/pages/ThreadOverview.tsx`: Add `'website-scrape'` to `flowEnabledThreads` array
- `src/pages/FlowPage.tsx`: Import `WebsiteScrapeFlow`, add render block: `if (config.isWebsiteScrapeFlow) return <WebsiteScrapeFlow />;`
- `supabase/config.toml`: Add `[functions.website-scrape]` entry

## Technical Notes

- **No database tables needed** — this is a stateless scrape-and-save manual flow inside `/threads` (no sync config, no dedup tracking, no monitoring state). Memories go directly to LIAM.
- **No user OAuth required** — Firecrawl via Composio uses the project's COMPOSIO_API_KEY, not per-user connections.
- **Content policy** — Only the extracted memory text goes to LIAM. Source URL is not embedded in memory content (per LIAM content policy). The URL could optionally be shown in the review/success UI as reference metadata, but not stored in the main LIAM content body.
- **Composio FIRECRAWL tool call pattern** — Same as other Composio tools/execute calls in the project, but without `connected_account_id` (Firecrawl is a managed API key tool used here as the retrieval layer for the Website Link to Memory flow).