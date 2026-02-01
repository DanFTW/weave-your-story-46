

# Enhanced Threads Page with Filtering

## Overview

Redesign the `/threads` page to provide richer thread cards with descriptions, integration icons, and type/trigger badges, plus add filtering capabilities.

## Key Requirements

| Requirement | Implementation |
|-------------|----------------|
| Description for each thread | Display `thread.description` in card |
| Integration icons | Map thread ID to integration icons (e.g., twitter-sync → Twitter icon) |
| Thread vs Dump pill | Badge showing "Thread" (automatic) or "Dump" (manual) |
| Automatic vs Manual pill | Badge showing trigger type |
| Filter tabs | Pill-style filter bar for category and trigger type |

## Thread/Dump Classification Logic

Based on user definitions:
- **Thread**: Flows with **automatic** trigger executions (background polling, webhooks)
- **Dump**: Flows with **manual** trigger executions (sync now button)

```typescript
// Thread (Automatic) examples:
'email-automation', 'instagram-live', 'twitter-live', 'linkedin-live', 
'trello-tracker', 'hubspot-tracker', 'twitter-alpha-tracker'

// Dump (Manual) examples:
'twitter-sync', 'instagram-sync', 'youtube-sync', 'google-photos-sync',
'email-dump', 'llm-import', 'receipts', 'family', 'food-preferences', 'interests'
```

## Data Model Changes

### Update `Thread` Type

```typescript
// src/types/threads.ts
export type TriggerType = "automatic" | "manual";
export type FlowMode = "thread" | "dump";

export interface Thread {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  gradient: ThreadGradient;
  status: ThreadStatus;
  type: ThreadType; // existing: "automation" | "flow"
  category?: string;
  integrations?: string[];  // NEW: array of integration icon IDs
  triggerType: TriggerType; // NEW: "automatic" | "manual"
  flowMode: FlowMode;       // NEW: "thread" | "dump"
}
```

### Update Thread Data

```typescript
// src/data/threads.ts - Example updates
{
  id: "twitter-alpha-tracker",
  title: "Twitter Alpha Tracker",
  description: "Track posts from any Twitter account as memories",
  icon: Target,
  gradient: "blue",
  status: "active",
  type: "automation",
  category: "social",
  integrations: ["twitter"],      // NEW
  triggerType: "automatic",       // NEW
  flowMode: "thread",             // NEW
},
{
  id: "twitter-sync",
  title: "Twitter Dump",
  description: "Save your tweets, retweets, and likes as memories",
  icon: Twitter,
  gradient: "blue",
  status: "active",
  type: "automation",
  category: "social",
  integrations: ["twitter"],      // NEW
  triggerType: "manual",          // NEW
  flowMode: "dump",               // NEW
},
```

## UI Components

### 1. ThreadCard Redesign

Expand the card height to accommodate new elements:

```
┌──────────────────────────────────────────────────────────┐
│  ┌────┐                                                  │
│  │Icon│  Twitter Alpha Tracker           ┌─────────────┐ │
│  └────┘                                  │   View   ▸  │ │
│         Track posts from any Twitter...  └─────────────┘ │
│                                                          │
│  ┌────────┐  ┌──────┐  ┌───────────┐  ┌───────────────┐  │
│  │ 𝕏 icon │  │Thread│  │ Automatic │  │               │  │
│  └────────┘  └──────┘  └───────────┘  │               │  │
└──────────────────────────────────────────────────────────┘
```

Changes to `ThreadCard.tsx`:
- Increase card height from `h-32` to `h-40`
- Add description text below title
- Add footer row with integration icons and pill badges
- Use small integration icons (w-6 h-6)
- Style pills to match existing design system

### 2. Thread Filter Pills

Create a filter bar component similar to `MemoryFilterBar`:

```typescript
// New component: src/components/threads/ThreadFilterBar.tsx
interface ThreadFilterBarProps {
  flowModeFilter: "all" | "thread" | "dump";
  triggerFilter: "all" | "automatic" | "manual";
  onFlowModeChange: (mode: "all" | "thread" | "dump") => void;
  onTriggerChange: (trigger: "all" | "automatic" | "manual") => void;
}
```

Visual layout:
```
┌─────────────────────────────────────────────────────────┐
│ ┌─────┐ ┌────────┐ ┌──────┐   │   ┌─────┐ ┌───────────┐ │
│ │ All │ │ Thread │ │ Dump │   │   │ All │ │ Automatic │ │
│ └─────┘ └────────┘ └──────┘   │   └─────┘ └───────────┘ │
│    Flow Mode                  │      Trigger Type       │
└─────────────────────────────────────────────────────────┘
```

### 3. Pill Badge Component

Create reusable pill badges for thread/dump and automatic/manual:

```typescript
// New component: src/components/threads/ThreadTypeBadge.tsx
interface ThreadTypeBadgeProps {
  flowMode: FlowMode;
  triggerType: TriggerType;
}

// Styling:
// Thread → Blue outline pill (e.g., border-blue-500/30 bg-blue-500/10 text-white)
// Dump → Teal outline pill
// Automatic → Green/emerald accent
// Manual → Orange accent
```

## Integration Icon Mapping

Create a mapping from thread ID to integration icons:

```typescript
// src/data/threads.ts
const threadIntegrations: Record<string, string[]> = {
  "twitter-alpha-tracker": ["twitter"],
  "twitter-live": ["twitter"],
  "twitter-sync": ["twitter"],
  "instagram-live": ["instagram"],
  "instagram-sync": ["instagram"],
  "youtube-sync": ["youtube"],
  "google-photos-sync": ["googlephotos"],
  "linkedin-live": ["linkedin"],
  "email-automation": ["gmail"],
  "email-dump": ["gmail"],
  "hubspot-tracker": ["hubspot"],
  "trello-tracker": ["trello"],
  "llm-import": [],  // No external integration
  "receipts": ["camera"],
  "family": [],
  "food-preferences": [],
  "interests": [],
};
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/types/threads.ts` | Modify | Add `TriggerType`, `FlowMode`, update `Thread` interface |
| `src/data/threads.ts` | Modify | Add `integrations`, `triggerType`, `flowMode` to all threads |
| `src/components/ThreadCard.tsx` | Modify | Expand card, add description, icons, pills |
| `src/components/threads/ThreadFilterBar.tsx` | Create | Filter bar with flow mode and trigger type pills |
| `src/components/threads/ThreadTypeBadge.tsx` | Create | Pill badges for thread/dump and auto/manual |
| `src/pages/Threads.tsx` | Modify | Add filter state and filtering logic |

## Styling Approach

Following existing design patterns:
- Use `motion` from framer-motion for animations (matching `MemoryFilterBar`)
- Use existing color system from CSS variables
- Pills use semi-transparent backgrounds with subtle borders
- Integration icons use existing `IntegrationIcon` component with reduced size
- Maintain gradient backgrounds on cards
- Ensure proper contrast for text on gradient backgrounds

## Thread Data Complete Mapping

| Thread ID | Flow Mode | Trigger Type | Integrations |
|-----------|-----------|--------------|--------------|
| `twitter-alpha-tracker` | thread | automatic | twitter |
| `hubspot-tracker` | thread | automatic | hubspot |
| `trello-tracker` | thread | automatic | trello |
| `linkedin-live` | thread | automatic | linkedin |
| `twitter-live` | thread | automatic | twitter |
| `instagram-live` | thread | automatic | instagram |
| `email-automation` | thread | automatic | gmail |
| `youtube-sync` | dump | manual | youtube |
| `twitter-sync` | dump | manual | twitter |
| `instagram-sync` | dump | manual | instagram |
| `google-photos-sync` | dump | manual | googlephotos |
| `llm-import` | dump | manual | - |
| `interests` | dump | manual | - |
| `receipts` | dump | manual | camera |
| `email-dump` | dump | manual | gmail |
| `family` | dump | manual | - |
| `food-preferences` | dump | manual | - |

## Expected Outcome

After implementation:
1. Each thread card displays its description, integration icons, and two pill badges
2. Filter bar at top allows filtering by flow mode (Thread/Dump) and trigger type (Automatic/Manual)
3. Cards animate smoothly when filters change
4. Design is consistent with existing app styling patterns
5. All 17 threads have correct classifications and integration mappings

