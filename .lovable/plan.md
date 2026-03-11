# Plan: "LinkedIn Profile to Memory" Thread

## Overview

Create a new manual flow thread that lets users paste a LinkedIn profile URL, scrape it via the Apify actor `dev_fusion/linkedin-profile-scraper`, extract memory-worthy profile data, and review/save as LIAM memories. This follows the identical architecture as the existing "Website Link to Memory" thread.

## Architecture

User pastes LinkedIn profile URL  
-> Edge function: linkedin-profile-scrape  
-> Apify actor: dev_fusion/linkedin-profile-scraper  
-> Returns structured profile JSON  
-> Edge function: generate-memories (existing)  
-> AI extracts discrete memory statements from profile data  
-> Frontend: Preview phase (existing MemoryPreviewCard pattern)  
-> User reviews, edits, deletes memories  
-> useLiamMemory.createMemory (existing)  
-> Saves each confirmed memory with tag 'LINKEDIN'

## Secret Required

An **Apify API token** is needed to call the actor. No `APIFY_TOKEN` secret currently exists — we will need to add one before the edge function can work.

## Files to Create

### 1. Edge Function: `supabase/functions/linkedin-profile-scrape/index.ts`

- Accepts `{ url: string }` in request body
- Validates that the URL is a LinkedIn profile URL (`linkedin.com/in/...`)
- Calls the Apify actor `dev_fusion/linkedin-profile-scraper` via the Apify API (`POST https://api.apify.com/v2/acts/dev_fusion~linkedin-profile-scraper/run-sync-get-dataset-items`)
- Uses `APIFY_TOKEN` from env
- Formats the structured profile JSON (name, headline, summary, experience, education, skills, etc.) into a clean text block suitable for memory generation
- Returns the formatted content and the person's name as title

### 2. Types: `src/types/linkedinProfileScrape.ts`

- `LinkedInProfileScrapePhase`: `'input' | 'scraping' | 'generating' | 'preview' | 'success'` (mirrors `WebsiteScrapePhase`)
- `LinkedInProfileScrapeResult`: `{ url, name, memoryCount }`

### 3. Hook: `src/hooks/useLinkedInProfileScrape.ts`

- Same state machine pattern as `useWebsiteScrape`
- `scrapeAndGenerate(url)`: invokes `linkedin-profile-scrape` edge function, then `generate-memories` with flowType `'linkedin-profile'` and memoryTag `'LINKEDIN'`
- `confirmMemories()`: saves via `createMemory` with tag `'LINKEDIN'`
- Manages `generatedMemories`, `isSaving`, `phase`, `lastResult`, `reset`

### 4. Flow Components: `src/components/flows/linkedin-profile-scrape/`

All components mirror the website-scrape counterparts with LinkedIn-specific copy and the `blue` gradient (matching the existing LinkedIn thread styling):

- `LinkedInProfileScrapeFlow.tsx`: Main component with `thread-gradient-blue` header, circular back button, preview phase with `MemoryPreviewCard` list and fixed confirm button. Identical structure to `WebsiteScrapeFlow`.
- `LinkedInUrlInput.tsx`: URL input with LinkedIn icon, validation for `linkedin.com/in/` URLs, paste button, "Extract Profile" CTA. Same layout as `WebsiteUrlInput`.
- `LinkedInScrapingScreen.tsx`: Full-screen `thread-gradient-blue` loading screen with LinkedIn icon. Same pattern as `ScrapingScreen`.
- `LinkedInProfileSuccess.tsx`: Success screen with person's name, memory count, "Scrape Another" and "Done" buttons. Same pattern as `WebsiteScrapeSuccess`.
- `index.ts`: Barrel export.

## Files to Modify

### 5. Registration

- `src/types/flows.ts`: Add `isLinkedInProfileScrapeFlow?: boolean`
- `src/data/threads.ts`: Add thread entry `{ id: "linkedin-profile-scrape", title: "LinkedIn Profile to Memory", description: "Extract memory-like information from a LinkedIn profile", icon: UserPlus, gradient: "blue", flowMode: "flow", triggerType: "manual", type: "flow", category: "professional", integrations: ["linkedin"], status: "active" }`
- `src/data/threadConfigs.ts`: Add `"linkedin-profile-scrape"` config with 3 steps: Enter Profile URL (setup), Extract Profile (setup), Save to Memory (save)
- `src/data/flowConfigs.ts`: Add `"linkedin-profile-scrape"` entry with `isLinkedInProfileScrapeFlow: true`, `memoryTag: "LINKEDIN"`
- `src/pages/Threads.tsx`: Add `'linkedin-profile-scrape'` to `flowEnabledThreads`
- `src/pages/ThreadOverview.tsx`: Add `'linkedin-profile-scrape'` to `flowEnabledThreads`
- `src/pages/FlowPage.tsx`: Import `LinkedInProfileScrapeFlow`, add render block for `config.isLinkedInProfileScrapeFlow`
- `supabase/config.toml`: Add `[functions.linkedin-profile-scrape] verify_jwt = false`

## Technical Notes

- **Apify API pattern**: `POST https://api.apify.com/v2/acts/dev_fusion~linkedin-profile-scraper/run-sync-get-dataset-items?token={APIFY_TOKEN}` with body `{ "profileUrls": ["https://linkedin.com/in/..."] }`. Returns an array of profile objects.
- **Content formatting for LIAM**: The edge function will compose a clean text summary from the structured profile data (name, headline, summary, experience entries, education, skills) — following the content policy of sending only primary text, no metadata footers.
- **No database tables needed** — stateless manual flow, same as website-scrape.
- **No user OAuth required** — uses the project's Apify API token.