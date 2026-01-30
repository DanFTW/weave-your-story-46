

# LinkedIn Auto-Capture: Chrome Extension Solution

## Overview

Since LinkedIn's Connections API requires Partner-only OAuth scopes, server-side polling cannot detect new connections. The solution is a lightweight Chrome Extension (Manifest V3) that runs on `linkedin.com`, detects connection events via DOM observation, and posts them to a dedicated Weave backend endpoint for idempotent memory creation.

---

## Architecture

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                                     │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              Chrome Extension (MV3)                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  Content Script (linkedin.com/*)                            │   │   │
│  │  │  • MutationObserver on DOM                                  │   │   │
│  │  │  • Detects "Connected" toasts & button state changes        │   │   │
│  │  │  • Extracts profile data from page                          │   │   │
│  │  │  • Client-side throttle (5min per profile_url)              │   │   │
│  │  └──────────────────────┬──────────────────────────────────────┘   │   │
│  │                         │                                          │   │
│  │  ┌──────────────────────▼──────────────────────────────────────┐   │   │
│  │  │  Background Service Worker                                  │   │   │
│  │  │  • Manages auth token from Weave webapp                     │   │   │
│  │  │  • Queues events with retry logic                           │   │   │
│  │  │  • Sends POST to Weave backend                              │   │   │
│  │  └──────────────────────┬──────────────────────────────────────┘   │   │
│  └─────────────────────────┼──────────────────────────────────────────┘   │
└────────────────────────────┼──────────────────────────────────────────────┘
                             │
                             │ POST /functions/v1/linkedin-connection-event
                             │ Authorization: Bearer <weave_jwt>
                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          SUPABASE BACKEND                                   │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  linkedin-connection-event Edge Function                            │   │
│  │  • Validates JWT → user_id                                          │   │
│  │  • Normalizes profile_url                                           │   │
│  │  • Dedupe: linkedin:contact:<user_id>:<profile_url>                │   │
│  │  • Upserts to linkedin_processed_connections                        │   │
│  │  • Creates memory via LIAM API (if new)                             │   │
│  │  • Updates linkedin_automation_config stats                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  linkedin_extension_events Table (new)                              │   │
│  │  • user_id, profile_url, full_name, received_at, status             │   │
│  │  • For debugging/audit trail                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Components

### 1. Chrome Extension (New Directory: `extension/`)

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest with permissions for `linkedin.com` |
| `content.js` | Content script: DOM observation + data extraction |
| `background.js` | Service worker: auth management + API calls |
| `popup.html/js` | Status UI + login flow trigger |
| `icons/` | Extension icons (16, 48, 128px) |

**Key Features:**
- MutationObserver targeting:
  - Toast notifications ("You're now connected with...")
  - Profile page Connect → Message button transitions
  - My Network "Connected" confirmations
- Data extraction from DOM:
  - `profile_url` from page URL or anchor href
  - `public_identifier` parsed from URL
  - Name, headline, company, location, avatar from visible elements
- 5-minute client-side throttle per `profile_url` using chrome.storage.local
- Queued retry with exponential backoff for failed sends

### 2. Backend Edge Function (New)

**File:** `supabase/functions/linkedin-connection-event/index.ts`

| Endpoint | Method | Auth |
|----------|--------|------|
| `/linkedin-connection-event` | POST | JWT required |

**Request Payload:**
```json
{
  "source": "linkedin_extension",
  "event": "connection_added",
  "profile_url": "https://www.linkedin.com/in/johndoe/",
  "public_identifier": "johndoe",
  "full_name": "John Doe",
  "headline": "Product Manager at Acme Corp",
  "company": "Acme Corp",
  "location": "San Francisco, CA",
  "avatar_url": "https://media.licdn.com/...",
  "occurred_at": "2026-01-30T12:34:56.789Z"
}
```

**Response:**
- `{ saved: true, memory_id: "..." }` - New contact saved
- `{ saved: false, reason: "duplicate" }` - Already exists
- `{ error: "..." }` - Validation/auth failure

**Dedupe Key:** `linkedin:contact:<user_id>:<normalized_profile_url>`

### 3. Database Changes

**New Table:** `linkedin_extension_events`
```sql
CREATE TABLE linkedin_extension_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  profile_url TEXT NOT NULL,
  public_identifier TEXT,
  full_name TEXT,
  headline TEXT,
  company TEXT,
  location TEXT,
  avatar_url TEXT,
  occurred_at TIMESTAMPTZ,
  status TEXT DEFAULT 'received', -- received, saved, duplicate, error
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_linkedin_ext_events_user ON linkedin_extension_events(user_id);
CREATE INDEX idx_linkedin_ext_events_profile ON linkedin_extension_events(user_id, profile_url);
```

**Add Column:** `linkedin_automation_config.extension_last_event_at`
```sql
ALTER TABLE linkedin_automation_config 
ADD COLUMN extension_last_event_at TIMESTAMPTZ,
ADD COLUMN extension_enabled BOOLEAN DEFAULT false;
```

### 4. UI Updates

**File:** `src/components/flows/linkedin-automation/ActiveMonitoring.tsx`

Replace fake "Background Sync Active" with:

| State | Display |
|-------|---------|
| Extension events received in last 5 min | ✅ "Extension Active" (green badge) |
| No recent events but config enabled | ⚠️ "Extension Not Detected" + setup CTA |
| Extension disabled | Setup instructions + Chrome Web Store link |

**New Components:**
- `ExtensionStatus.tsx` - Real-time extension health indicator
- `ExtensionSetupGuide.tsx` - Installation instructions drawer

**Update Hook:** `useLinkedInAutomation.ts`
- Query `extension_last_event_at` to determine extension health
- Remove/hide "Sync Now" button (no longer applicable)
- Add `isExtensionActive` computed property

---

## Files to Create/Modify

| Path | Action | Description |
|------|--------|-------------|
| `extension/manifest.json` | CREATE | Chrome extension manifest (MV3) |
| `extension/content.js` | CREATE | LinkedIn DOM observer script |
| `extension/background.js` | CREATE | Service worker for API calls |
| `extension/popup.html` | CREATE | Extension popup UI |
| `extension/popup.js` | CREATE | Popup logic |
| `supabase/functions/linkedin-connection-event/index.ts` | CREATE | New edge function |
| `supabase/config.toml` | MODIFY | Add function config |
| `src/components/flows/linkedin-automation/ActiveMonitoring.tsx` | MODIFY | Show extension status |
| `src/components/flows/linkedin-automation/ExtensionStatus.tsx` | CREATE | Extension health component |
| `src/components/flows/linkedin-automation/ExtensionSetupGuide.tsx` | CREATE | Setup instructions |
| `src/hooks/useLinkedInAutomation.ts` | MODIFY | Add extension status logic |
| `src/types/linkedinAutomation.ts` | MODIFY | Add extension-related types |
| Database | MODIFY | New table + column additions |

---

## Technical Details

### Content Script Detection Patterns

```javascript
// Pattern 1: Toast notifications
const toastSelectors = [
  '[data-test-artdeco-toast-item]',
  '.artdeco-toast-item',
  '.msg-overlay-bubble-header',
];

// Pattern 2: Profile page "Message" button (indicates connected)
const connectedIndicators = [
  'button[aria-label*="Message"]',
  '.pv-top-card--list .connected',
];

// Pattern 3: URL patterns
const profileUrlPattern = /linkedin\.com\/in\/([^\/\?]+)/;
```

### Auth Flow (Extension ↔ Webapp)

1. User opens extension popup
2. If not authenticated, popup shows "Login to Weave" button
3. Button opens Weave login page in new tab
4. After login, webapp sends auth token to extension via `chrome.runtime.sendMessage`
5. Extension stores token in `chrome.storage.local`
6. Token auto-refreshes before expiry

### Rate Limiting

- Client-side: 1 event per profile_url per 5 minutes
- Server-side: 100 events per user per hour
- Structured logging for all events (received, saved, duplicate, rate_limited)

---

## Acceptance Criteria Verification

| Requirement | Implementation |
|-------------|----------------|
| Automatic memory creation on new connection | ✅ Content script detects, background sends, edge function creates |
| Zero manual input in Weave | ✅ Extension runs passively in background |
| No duplicates | ✅ Server-side dedupe by normalized profile_url per user |
| Correct user attribution | ✅ JWT auth maps to user_id |
| Accurate UI status | ✅ Based on `extension_last_event_at` timestamp |

---

## Deployment Notes

1. Extension will be distributed as unpacked for testing, then Chrome Web Store for production
2. Users install extension and authenticate once
3. Extension works silently in background whenever LinkedIn is open
4. No changes needed to existing OAuth/Composio integration (extension is additive)

