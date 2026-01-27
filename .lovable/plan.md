
# HubSpot Contact Tracker Thread Implementation

## Overview

Create a new "HubSpot Contact Tracker" thread that automatically saves new HubSpot contacts as memories using the Composio `HUBSPOT_CONTACT_CREATED_TRIGGER` webhook trigger.

## Flow Design

The flow is simpler than Trello (no board/list selection needed):

```text
1. Connect HubSpot → 2. Monitoring Toggle (On/Off)
```

**Phases:**
- `auth-check` - Verify HubSpot is connected
- `configure` - Toggle monitoring on/off
- `activating` - Setting up the webhook trigger
- `active` - Dashboard showing stats

---

## Technical Implementation

### 1. Database Schema

Create a new migration for HubSpot automation config table:

```sql
CREATE TABLE hubspot_automation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monitor_new_contacts BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT false,
  trigger_id TEXT,              -- Composio trigger instance ID
  contacts_tracked INTEGER DEFAULT 0,
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE hubspot_automation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own config"
  ON hubspot_automation_config FOR ALL
  USING (auth.uid() = user_id);

-- Processed contacts table for deduplication
CREATE TABLE hubspot_processed_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hubspot_contact_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, hubspot_contact_id)
);

ALTER TABLE hubspot_processed_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own processed contacts"
  ON hubspot_processed_contacts FOR ALL
  USING (auth.uid() = user_id);
```

---

### 2. TypeScript Types

**File: `src/types/hubspotAutomation.ts`**

```typescript
export type HubSpotAutomationPhase = 
  | 'auth-check'
  | 'configure'
  | 'activating'
  | 'active';

export interface HubSpotAutomationConfig {
  id: string;
  userId: string;
  monitorNewContacts: boolean;
  isActive: boolean;
  triggerId: string | null;
  contactsTracked: number;
  lastPolledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotContactStats {
  contactsTracked: number;
  lastChecked: string | null;
  isActive: boolean;
}
```

---

### 3. Frontend Components

**Directory: `src/components/flows/hubspot-automation/`**

| File | Purpose |
|------|---------|
| `HubSpotAutomationFlow.tsx` | Main flow container with auth gating |
| `AutomationConfig.tsx` | Toggle for "Monitor New Contacts" + Activate button |
| `ActiveMonitoring.tsx` | Dashboard with stats, Sync Now, Pause buttons |
| `ActivatingScreen.tsx` | Loading screen while creating trigger |
| `index.ts` | Barrel export |

**Key Pattern (from LinkedIn flow):**
- Use `useComposio('HUBSPOT')` for connection checking
- Gate auth with `isCheckingAuth` state
- Store return path before redirect: `sessionStorage.setItem('returnAfterHubspotConnect', '/flow/hubspot-tracker')`

---

### 4. Custom Hook

**File: `src/hooks/useHubSpotAutomation.ts`**

Similar to `useLinkedInAutomation.ts`:
- `loadConfig()` - Load/create user config
- `updateConfig()` - Update toggle state
- `activateMonitoring()` - Create Composio trigger via edge function
- `deactivateMonitoring()` - Disable trigger via edge function
- `triggerManualPoll()` - Optional: manual check

---

### 5. Edge Functions

#### A. Trigger Management: `supabase/functions/hubspot-automation-triggers/index.ts`

Handles:
- `activate` action - Create `HUBSPOT_CONTACT_CREATED_TRIGGER` via Composio v3 API
- `deactivate` action - Disable trigger via PATCH

```typescript
// Create trigger using Composio v3 API
const response = await fetch(
  "https://backend.composio.dev/api/v3/trigger_instances/HUBSPOT_CONTACT_CREATED_TRIGGER/upsert",
  {
    method: "POST",
    headers: {
      "x-api-key": COMPOSIO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connected_account_id: connectionId,
      trigger_config: {},  // No config needed for contact trigger
      webhook_url: `${SUPABASE_URL}/functions/v1/hubspot-automation-webhook`,
    }),
  }
);
```

#### B. Webhook Handler: `supabase/functions/hubspot-automation-webhook/index.ts`

Receives webhook payloads when new contacts are created:
- Look up user by trigger ID
- Check for duplicate processing
- Create memory via LIAM API
- Update stats

**Memory Format:**
```text
🧑‍💼 New HubSpot Contact

Name: John Smith
Email: john@example.com
Company: Acme Corp
Phone: +1 555-1234
Created: January 27, 2026

A new contact was added to your CRM.
```

---

### 6. Thread & Flow Registration

#### A. Thread Definition (`src/data/threads.ts`)

```typescript
{
  id: "hubspot-tracker",
  title: "HubSpot Contact Tracker",
  description: "Automatically save new CRM contacts as memories",
  icon: UserPlus,  // or use a custom HubSpot-related icon
  gradient: "orange",  // HubSpot brand color
  status: "active",
  type: "automation",
  category: "crm",
}
```

#### B. Flow Config (`src/data/flowConfigs.ts`)

```typescript
"hubspot-tracker": {
  id: "hubspot-tracker",
  title: "HubSpot Contact Tracker",
  subtitle: "CRM contact monitoring",
  description: "Automatically save new HubSpot contacts as memories.",
  gradient: "orange",
  icon: UserPlus,
  entryName: "contact",
  entryNamePlural: "contacts",
  memoryTag: "HUBSPOT",
  fields: [],
  isHubSpotAutomationFlow: true,  // New flag
}
```

#### C. Thread Config (`src/data/threadConfigs.ts`)

```typescript
"hubspot-tracker": {
  id: "hubspot-tracker",
  title: "HubSpot Contact Tracker",
  subtitle: "CRM contact memories",
  description: "Monitor your HubSpot CRM and automatically save new contacts as memories.",
  gradient: "orange",
  icon: UserPlus,
  steps: [
    {
      id: "connect",
      type: "integration",
      title: "Connect HubSpot",
      description: "Authorize access to your CRM",
      iconUrl: "/src/assets/integrations/hubspot.svg", // Use local asset
    },
    {
      id: "configure",
      type: "setup",
      title: "Enable Monitoring",
      description: "Toggle new contact tracking",
      icon: Settings,
    },
    {
      id: "active",
      type: "save",
      title: "Always-On Monitoring",
      description: "Contacts saved automatically",
      icon: Wifi,
      badge: "LIVE",
    },
  ],
}
```

#### D. Navigation Registration

**`src/pages/Threads.tsx`** - Add to `flowEnabledThreads`:
```typescript
const flowEnabledThreads = ['family', ..., 'hubspot-tracker'];
```

**`src/pages/ThreadOverview.tsx`** - Add to `flowEnabledThreads`:
```typescript
const flowEnabledThreads = ['family', ..., 'hubspot-tracker'];
```

#### E. FlowPage Rendering (`src/pages/FlowPage.tsx`)

Add conditional render:
```typescript
import { HubSpotAutomationFlow } from "@/components/flows/hubspot-automation";

// Inside FlowPage component
if (config.isHubSpotAutomationFlow) {
  return <HubSpotAutomationFlow />;
}
```

#### F. Types Update (`src/types/flows.ts`)

Add to FlowConfig interface:
```typescript
isHubSpotAutomationFlow?: boolean;
```

---

### 7. Edge Function Config

**`supabase/config.toml`** - Add JWT verification bypass:
```toml
[functions.hubspot-automation-triggers]
verify_jwt = false

[functions.hubspot-automation-webhook]
verify_jwt = false
```

---

## Files to Create/Modify

| Operation | File |
|-----------|------|
| CREATE | `supabase/migrations/XXXXXXXX_hubspot_automation.sql` |
| CREATE | `src/types/hubspotAutomation.ts` |
| CREATE | `src/hooks/useHubSpotAutomation.ts` |
| CREATE | `src/components/flows/hubspot-automation/HubSpotAutomationFlow.tsx` |
| CREATE | `src/components/flows/hubspot-automation/AutomationConfig.tsx` |
| CREATE | `src/components/flows/hubspot-automation/ActiveMonitoring.tsx` |
| CREATE | `src/components/flows/hubspot-automation/ActivatingScreen.tsx` |
| CREATE | `src/components/flows/hubspot-automation/index.ts` |
| CREATE | `supabase/functions/hubspot-automation-triggers/index.ts` |
| CREATE | `supabase/functions/hubspot-automation-webhook/index.ts` |
| MODIFY | `src/data/threads.ts` - Add thread entry |
| MODIFY | `src/data/flowConfigs.ts` - Add flow config |
| MODIFY | `src/data/threadConfigs.ts` - Add thread config |
| MODIFY | `src/types/flows.ts` - Add isHubSpotAutomationFlow flag |
| MODIFY | `src/pages/FlowPage.tsx` - Add conditional render |
| MODIFY | `src/pages/Threads.tsx` - Add to flowEnabledThreads |
| MODIFY | `src/pages/ThreadOverview.tsx` - Add to flowEnabledThreads |
| MODIFY | `supabase/config.toml` - Add function configs |

---

## Styling Notes

- **Gradient**: Use `orange` (HubSpot brand color #FF7A59)
- **Icon**: Use `UserPlus` from lucide-react (matches contact tracking concept)
- **Color accents**: `#FF7A59` for HubSpot orange in UI elements
- **Badge**: "LIVE" on the active monitoring step

---

## Auth Flow

1. User clicks "Get Started" on `/thread/hubspot-tracker`
2. `HubSpotAutomationFlow` checks `useComposio('HUBSPOT')` connection
3. If not connected:
   - Store `sessionStorage.setItem('returnAfterHubspotConnect', '/flow/hubspot-tracker')`
   - Redirect to `/integration/hubspot`
4. User connects HubSpot
5. `IntegrationDetail.tsx` detects connection + return path → redirects back
6. Flow resumes at configure phase

---

## Composio Integration Details

From the memory context:
- **Auth Config ID**: `ac_1B61iXhr6Dil` (HubSpot)
- **Trigger**: `HUBSPOT_CONTACT_CREATED_TRIGGER` (official Composio trigger)
- **API Base**: `https://backend.composio.dev/api/v3`
- **Endpoint Pattern**: `/trigger_instances/{TRIGGER_SLUG}/upsert`

The trigger will automatically send webhook payloads when new contacts are created in the user's HubSpot account.
