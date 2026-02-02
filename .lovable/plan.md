

# Thread Card Enhancements - Auto/Manual Indicator & Remove Filler Icons

## Overview
Enhance thread cards to show whether a thread is automatic or manual, and remove non-service "filler" integration icons (like camera, location) that don't represent actual external platform integrations.

---

## Current State Analysis

**Integration Icons Issue:**
Looking at the thread data, some threads have filler integrations:
- `receipts` has `integrations: ["camera"]` - this is a device capability, not an external service
- Other filler icons in the system: `camera`, `location`

**Trigger Type Display:**
- Each thread has a `triggerType: "automatic" | "manual"` property
- The `ThreadTypeBadge` component already supports displaying this
- Currently only the `flowMode` badge (Thread/Flow/Dump) is shown

---

## Implementation Plan

### 1. Remove Filler Integration Icons

Define a list of non-service integrations to filter out:

```typescript
// Filler icons that represent device capabilities, not external services
const fillerIntegrations = ["camera", "location"];

// Filter to only show real service integrations
const serviceIntegrations = thread.integrations?.filter(
  (integration) => !fillerIntegrations.includes(integration)
);
```

### 2. Add Auto/Manual Badge

Display both badges in the bottom row:
- **Trigger Type Badge** (Auto/Manual) - shows how the thread operates
- **Flow Mode Badge** (Thread/Flow/Dump) - shows the category

**Badge Order:** Auto/Manual badge first, then Flow Mode badge (left to right)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ThreadCard.tsx` | Filter filler integrations, add triggerType badge |

---

## Code Changes (`src/components/ThreadCard.tsx`)

```tsx
// Define filler integrations to exclude
const fillerIntegrations = ["camera", "location"];

export function ThreadCard({ thread, onClick, className }: ThreadCardProps) {
  const Icon = thread.icon;
  
  // Filter out filler integrations (device capabilities, not services)
  const serviceIntegrations = thread.integrations?.filter(
    (integration) => !fillerIntegrations.includes(integration)
  );
  const hasIntegrations = serviceIntegrations && serviceIntegrations.length > 0;

  return (
    <button ...>
      {/* ... top row unchanged ... */}

      {/* Bottom Row: Integrations + Badges */}
      <div className="mt-auto pt-4 flex items-center gap-2 flex-wrap">
        {/* Integration Icons (filtered) */}
        {hasIntegrations && (
          <div className="flex items-center gap-2">
            {serviceIntegrations.map((integration) => (
              <IntegrationIcon
                key={integration}
                icon={integration}
                className="w-7 h-7"
              />
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Badges - Auto/Manual + Flow Mode */}
        <div className="flex items-center gap-1.5">
          <ThreadTypeBadge variant="triggerType" triggerType={thread.triggerType} />
          <ThreadTypeBadge variant="flowMode" flowMode={thread.flowMode} />
        </div>
      </div>
    </button>
  );
}
```

---

## Visual Reference

### Before
```text
┌────────────────────────────────────────────┐
│ [Icon] Twitter Alpha Tracker        [→]   │
│        Track posts from any account...    │
│                                           │
│ 🐦                              [Thread]  │
└────────────────────────────────────────────┘
```

### After
```text
┌────────────────────────────────────────────┐
│ [Icon] Twitter Alpha Tracker        [→]   │
│        Track posts from any account...    │
│                                           │
│ 🐦                        [Auto] [Thread] │
└────────────────────────────────────────────┘
```

### Receipts Thread (filler icon removed)
```text
Before: 📷 (camera icon shown)
After:  (no integration icons - camera is filtered out)
```

---

## Badge Color Reference

| Badge | Background | Text | Border |
|-------|------------|------|--------|
| **Auto** | `bg-emerald-500/20` | `text-emerald-100` | `border-emerald-400/30` |
| **Manual** | `bg-orange-500/20` | `text-orange-100` | `border-orange-400/30` |
| Thread | `bg-blue-500/20` | `text-blue-100` | `border-blue-400/30` |
| Flow | `bg-purple-500/20` | `text-purple-100` | `border-purple-400/30` |
| Dump | `bg-teal-500/20` | `text-teal-100` | `border-teal-400/30` |

---

## Technical Notes

- Uses existing `ThreadTypeBadge` component with `variant="triggerType"`
- No new components needed
- Maintains existing animation and layout patterns
- Filler integration list is easily extensible for future exclusions

