
# Trello Task Tracker Thread - Implementation Plan

## Overview

Create a **Trello Task Tracker** automation thread that uses **Composio's official triggers** to monitor Trello boards in real-time:

- **`TRELLO_NEW_CARD_TRIGGER`** - Fires when a new card is created on a board
- **`TRELLO_UPDATED_CARD_TRIGGER`** - Fires when a card is updated (moved to Done list)

This approach uses **event-driven webhooks** rather than polling, providing true real-time notifications.

| Item | Value |
|------|-------|
| Thread ID | `trello-tracker` |
| Display Name | Trello Task Tracker |
| Integration | Trello (Auth Config: `ac_1s6sLEKtkxuE`) |
| Architecture | Webhook-based (Composio Triggers) |
| Gradient | `blue` |
| Icon | `ClipboardList` |

---

## Architecture: Webhook-Based Triggers vs Polling

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    COMPOSIO TRIGGER ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   1. User selects board → Edge function creates triggers            │
│                                                                      │
│   2. Composio creates webhook subscription to Trello                │
│                                                                      │
│   3. When card created/updated → Trello sends webhook to Composio   │
│                                                                      │
│   4. Composio forwards event → Our webhook edge function            │
│                                                                      │
│   5. Webhook edge function → Creates memory via LIAM API            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Advantages over polling:**
- True real-time notifications (seconds vs minutes)
- No wasted API calls when nothing changes
- Lower load on infrastructure
- More reliable event capture

---

## Technical Implementation

### Step 1: Database Schema

```sql
-- Store Trello automation configuration per user
CREATE TABLE IF NOT EXISTS public.trello_automation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  board_id TEXT,
  board_name TEXT,
  done_list_id TEXT,
  done_list_name TEXT,
  monitor_new_cards BOOLEAN DEFAULT true,
  monitor_completed_cards BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT false,
  new_card_trigger_id TEXT,          -- Composio trigger instance ID
  updated_card_trigger_id TEXT,      -- Composio trigger instance ID
  cards_tracked INTEGER DEFAULT 0,
  completed_tracked INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Track processed cards to avoid duplicates
CREATE TABLE IF NOT EXISTS public.trello_processed_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  card_type TEXT NOT NULL,           -- 'new' or 'completed'
  trello_card_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, card_type, trello_card_id)
);

-- Enable RLS
ALTER TABLE public.trello_automation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trello_processed_cards ENABLE ROW LEVEL SECURITY;

-- RLS policies for user-scoped access
CREATE POLICY "Users can manage their own Trello config"
  ON public.trello_automation_config
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own processed cards"
  ON public.trello_processed_cards
  FOR ALL USING (auth.uid() = user_id);
```

---

### Step 2: Thread & Flow Registration

**File: `src/data/threads.ts`**
Add new thread entry:
```typescript
{
  id: "trello-tracker",
  title: "Trello Task Tracker",
  description: "Automatically save new and completed tasks as memories",
  icon: ClipboardList,
  gradient: "blue",
  status: "active",
  type: "automation",
  category: "productivity",
}
```

**File: `src/data/flowConfigs.ts`**
Add flow configuration:
```typescript
"trello-tracker": {
  id: "trello-tracker",
  title: "Trello Task Tracker",
  subtitle: "Task monitoring",
  description: "Automatically save new and completed Trello tasks as memories.",
  gradient: "blue",
  icon: ClipboardList,
  entryName: "task",
  entryNamePlural: "tasks",
  memoryTag: "TRELLO",
  fields: [],
  isTrelloAutomationFlow: true,
}
```

**File: `src/types/flows.ts`**
Add new flag:
```typescript
isTrelloAutomationFlow?: boolean;
```

**Files: `src/pages/Threads.tsx` & `src/pages/ThreadOverview.tsx`**
Add `'trello-tracker'` to `flowEnabledThreads` array.

**File: `src/data/threadConfigs.ts`**
Add thread configuration for the overview page.

---

### Step 3: TypeScript Types

**File: `src/types/trelloAutomation.ts`** (new)

```typescript
export type TrelloAutomationPhase = 
  | 'auth-check'
  | 'select-board'
  | 'select-done-list'
  | 'configure'
  | 'activating'
  | 'active';

export interface TrelloBoard {
  id: string;
  name: string;
  url?: string;
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
}

export interface TrelloAutomationConfig {
  id: string;
  userId: string;
  boardId: string | null;
  boardName: string | null;
  doneListId: string | null;
  doneListName: string | null;
  monitorNewCards: boolean;
  monitorCompletedCards: boolean;
  isActive: boolean;
  newCardTriggerId: string | null;
  updatedCardTriggerId: string | null;
  cardsTracked: number;
  completedTracked: number;
}

export interface TrelloAutomationStats {
  cardsTracked: number;
  completedTracked: number;
  isActive: boolean;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  idList: string;
  idBoard: string;
  due?: string;
  dueComplete?: boolean;
  labels?: Array<{ name: string; color: string }>;
  url?: string;
}
```

---

### Step 4: React Hook

**File: `src/hooks/useTrelloAutomation.ts`** (new)

Manages the flow state and communicates with edge functions:

```typescript
export function useTrelloAutomation(): UseTrelloAutomationReturn {
  // State
  const [phase, setPhase] = useState<TrelloAutomationPhase>('auth-check');
  const [config, setConfig] = useState<TrelloAutomationConfig | null>(null);
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Key functions:
  // - loadConfig(): Load or create user's automation config
  // - fetchBoards(): Get user's Trello boards via edge function
  // - fetchLists(boardId): Get lists for selected board
  // - selectBoard(board): Save selected board, move to list selection
  // - selectDoneList(list): Save "Done" list for completion detection
  // - activateMonitoring(): Create Composio triggers, set is_active=true
  // - deactivateMonitoring(): Disable/delete triggers, set is_active=false
}
```

---

### Step 5: UI Components

**Directory: `src/components/flows/trello-automation/`**

| Component | Description |
|-----------|-------------|
| `TrelloAutomationFlow.tsx` | Main orchestrator - renders correct phase component |
| `BoardPicker.tsx` | Grid of user's Trello boards to select from |
| `ListPicker.tsx` | Select which list represents "Done" tasks |
| `AutomationConfig.tsx` | Toggle switches for new cards / completed cards |
| `ActiveMonitoring.tsx` | Dashboard when active (stats, pause button) |
| `ActivatingScreen.tsx` | Loading animation during trigger setup |
| `index.ts` | Barrel export |

**User Flow:**
```text
1. Auth Check → If not connected → Redirect to /integration/trello

2. Select Board → User picks which Trello board to monitor

3. Select Done List → User picks which list = "completed" tasks

4. Configure → Toggle new card / completed card monitoring

5. Activating → Creating Composio triggers

6. Active → Dashboard with stats, sync status, pause button
```

---

### Step 6: Edge Function - Trigger Management

**File: `supabase/functions/trello-automation-triggers/index.ts`** (new)

Handles trigger lifecycle management via Composio v3 API:

**Actions:**

1. **`get-boards`** - Fetch user's Trello boards
   ```typescript
   // Execute Composio tool: TRELLO_GET_BOARDS
   // Returns list of boards with id, name, url
   ```

2. **`get-lists`** - Fetch lists for a board
   ```typescript
   // Execute Composio tool: TRELLO_GET_LISTS_BY_ID_BOARD
   // Returns lists with id, name, closed status
   ```

3. **`activate`** - Create Composio triggers
   ```typescript
   // Create TRELLO_NEW_CARD_TRIGGER
   const newCardTrigger = await fetch(
     `${COMPOSIO_API_BASE}/trigger_instances/TRELLO_NEW_CARD_TRIGGER/upsert`,
     {
       method: "POST",
       headers: { "x-api-key": COMPOSIO_API_KEY },
       body: JSON.stringify({
         connected_account_id: connectionId,
         trigger_config: {
           idBoard: boardId,  // Monitor this specific board
         },
         webhook_url: `${SUPABASE_URL}/functions/v1/trello-automation-webhook`,
       }),
     }
   );
   
   // Create TRELLO_UPDATED_CARD_TRIGGER
   const updatedCardTrigger = await fetch(
     `${COMPOSIO_API_BASE}/trigger_instances/TRELLO_UPDATED_CARD_TRIGGER/upsert`,
     // Same pattern with different slug
   );
   
   // Save trigger IDs to config
   // Update is_active = true
   ```

4. **`deactivate`** - Disable triggers
   ```typescript
   // Disable both triggers via Composio API
   await fetch(
     `${COMPOSIO_API_BASE}/trigger_instances/manage/${triggerId}`,
     { method: "PATCH", body: JSON.stringify({ enabled: false }) }
   );
   // Update is_active = false
   ```

---

### Step 7: Edge Function - Webhook Handler

**File: `supabase/functions/trello-automation-webhook/index.ts`** (new)

Receives webhook payloads from Composio when Trello events occur:

```typescript
serve(async (req) => {
  // Parse Composio webhook payload
  const payload = await req.json();
  
  const triggerSlug = payload.metadata?.trigger_slug;
  const triggerId = payload.metadata?.trigger_id;
  const cardData = payload.data;
  
  // Look up user by trigger ID
  const { data: config } = await supabase
    .from('trello_automation_config')
    .select('*')
    .or(`new_card_trigger_id.eq.${triggerId},updated_card_trigger_id.eq.${triggerId}`)
    .single();
  
  if (!config) return; // Trigger not registered
  
  // Determine event type
  if (triggerSlug === 'TRELLO_NEW_CARD_TRIGGER') {
    await handleNewCard(config, cardData);
  } else if (triggerSlug === 'TRELLO_UPDATED_CARD_TRIGGER') {
    await handleUpdatedCard(config, cardData);
  }
});

async function handleNewCard(config, cardData) {
  // Check if card already processed
  const dedupKey = `trello_new_${cardData.id}`;
  // If not processed, create memory and mark processed
  const memory = formatNewCardMemory(cardData);
  await createMemoryViaLiam(config.user_id, memory);
  // Update stats
}

async function handleUpdatedCard(config, cardData) {
  // Check if card was moved to the Done list
  if (cardData.idList === config.done_list_id) {
    // Check if already processed as completed
    const dedupKey = `trello_completed_${cardData.id}`;
    // If not processed, create completion memory
    const memory = formatCompletedCardMemory(cardData);
    await createMemoryViaLiam(config.user_id, memory);
    // Update stats
  }
}
```

---

### Step 8: Memory Formats

**New Card Memory:**
```text
📋 New Trello Task

Board: {boardName}
Card: {cardName}
List: {listName}
Due: {dueDate or "None"}
Description: {cardDesc or "No description"}

A new task was added to your board.
```

**Completed Card Memory:**
```text
✅ Trello Task Completed

Board: {boardName}
Card: {cardName}
Completed: {timestamp}
Was due: {dueDate or "No deadline"}

You finished this task!
```

---

### Step 9: FlowPage Integration

**File: `src/pages/FlowPage.tsx`**

Add import and render logic:
```typescript
// Import
import { TrelloAutomationFlow } from "@/components/flows/trello-automation";

// Add condition (after LinkedIn automation check)
if (config.isTrelloAutomationFlow) {
  return <TrelloAutomationFlow />;
}
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| New migration SQL | Create | Database tables with RLS |
| `src/types/trelloAutomation.ts` | Create | TypeScript type definitions |
| `src/types/flows.ts` | Edit | Add `isTrelloAutomationFlow` flag |
| `src/data/threads.ts` | Edit | Add thread entry |
| `src/data/flowConfigs.ts` | Edit | Add flow configuration |
| `src/data/threadConfigs.ts` | Edit | Add thread config for overview |
| `src/pages/Threads.tsx` | Edit | Add to flowEnabledThreads |
| `src/pages/ThreadOverview.tsx` | Edit | Add to flowEnabledThreads |
| `src/pages/FlowPage.tsx` | Edit | Add Trello flow render condition |
| `src/hooks/useTrelloAutomation.ts` | Create | State management hook |
| `src/components/flows/trello-automation/TrelloAutomationFlow.tsx` | Create | Main flow component |
| `src/components/flows/trello-automation/BoardPicker.tsx` | Create | Board selection grid |
| `src/components/flows/trello-automation/ListPicker.tsx` | Create | Done list selection |
| `src/components/flows/trello-automation/AutomationConfig.tsx` | Create | Toggle configuration |
| `src/components/flows/trello-automation/ActiveMonitoring.tsx` | Create | Active state dashboard |
| `src/components/flows/trello-automation/ActivatingScreen.tsx` | Create | Loading animation |
| `src/components/flows/trello-automation/index.ts` | Create | Barrel export |
| `supabase/functions/trello-automation-triggers/index.ts` | Create | Trigger lifecycle management |
| `supabase/functions/trello-automation-webhook/index.ts` | Create | Webhook event handler |

---

## Key Composio API Calls

### Creating Triggers (v3 API)

```typescript
// Create new card trigger
POST https://backend.composio.dev/api/v3/trigger_instances/TRELLO_NEW_CARD_TRIGGER/upsert
Headers: { "x-api-key": COMPOSIO_API_KEY }
Body: {
  connected_account_id: "ca_xxx",
  trigger_config: { idBoard: "board_id" },
  webhook_url: "https://xxx.supabase.co/functions/v1/trello-automation-webhook"
}

// Create updated card trigger  
POST https://backend.composio.dev/api/v3/trigger_instances/TRELLO_UPDATED_CARD_TRIGGER/upsert
// Same pattern
```

### Managing Triggers

```typescript
// Disable trigger
PATCH https://backend.composio.dev/api/v3/trigger_instances/manage/{triggerId}
Body: { enabled: false }

// Enable trigger
PATCH https://backend.composio.dev/api/v3/trigger_instances/manage/{triggerId}
Body: { enabled: true }
```

### Fetching Boards/Lists (Tool Execution)

```typescript
// Get boards
POST https://backend.composio.dev/api/v3/actions/TRELLO_GET_BOARDS/execute
Body: { connected_account_id: "ca_xxx" }

// Get lists
POST https://backend.composio.dev/api/v3/actions/TRELLO_GET_LISTS_BY_ID_BOARD/execute
Body: { connected_account_id: "ca_xxx", input: { idBoard: "board_id" } }
```

---

## Webhook Payload Structure (Expected from Composio)

```typescript
interface ComposioTrelloWebhookPayload {
  id: string;
  timestamp: string;
  type: "composio.trigger.message";
  metadata: {
    log_id: string;
    trigger_slug: "TRELLO_NEW_CARD_TRIGGER" | "TRELLO_UPDATED_CARD_TRIGGER";
    trigger_id: string;
    connected_account_id: string;
  };
  data: {
    id: string;           // Card ID
    name: string;         // Card name
    desc?: string;        // Description
    idBoard: string;      // Board ID
    idList: string;       // Current list ID
    due?: string;         // Due date ISO
    dueComplete?: boolean;
    labels?: Array<{ name: string; color: string }>;
    url?: string;
    // ... other Trello card fields
  };
}
```

---

## Deduplication Strategy

Cards are tracked in `trello_processed_cards` to prevent duplicate memories:

- **Key**: `(user_id, card_type, trello_card_id)`
- **card_type**: `'new'` for new card events, `'completed'` for completion events
- A card can have both a "new" and "completed" memory (different lifecycle events)

---

## Required Secrets

The edge functions require these environment variables (already configured):
- `COMPOSIO_API_KEY` - Composio API key
- `SUPABASE_URL` - Project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
