
# Threads Page UI Enhancements

## Overview
This plan implements three key improvements to the `/threads` page:
1. Larger integration icons without transparent frames, using complementary color glows
2. Replace auto/manual filter with a unified type filter (Threads, Flows, Dumps)
3. Add a search bar positioned **below** the filter buttons

---

## 1. Layout: Filter Buttons Above Search Bar

### Visual Design
```text
┌────┬─────────┬───────┬───────┐
│ All│ Threads │ Flows │ Dumps │    ← Filter pills (animated, existing pattern)
└────┴─────────┴───────┴───────┘
┌─────────────────────────────────────────────┐
│ 🔍  Search threads...                    ✕  │    ← Search bar below
└─────────────────────────────────────────────┘
```

### Rationale
- Filter buttons remain visually prominent at the top
- Search dropdown/results won't obscure the filter controls
- Follows mobile-first design where primary actions are most accessible
- Consistent with the hierarchy: filter → refine → browse

---

## 2. Integration Icons Enhancement

### Current State
- Icons wrapped in `w-6 h-6` container with `bg-white/20 backdrop-blur-sm`
- Icon size is `w-4 h-4` (16px)

### Changes
- Remove the wrapper container entirely
- Increase icon size to `w-7 h-7` (28px) for better visibility
- Add subtle complementary color glow around each icon

### Complementary Color Mapping
Using color theory (180° on color wheel):

| Integration | Primary Color | Complementary Glow |
|-------------|---------------|-------------------|
| Gmail | #EA4335 (Red) | #16BC9A (Teal) |
| Instagram | #E1306C (Pink) | #1ECF93 (Mint) |
| Twitter | #000000 (Black) | #FFFFFF (White) |
| YouTube | #FF0000 (Red) | #00FFFF (Cyan) |
| LinkedIn | #0A66C2 (Blue) | #F5993D (Orange) |
| HubSpot | #FF7A59 (Orange) | #0085A6 (Teal-Blue) |
| Trello | #0052CC (Blue) | #CCAD00 (Gold) |
| Google Photos | #4285F4 (Blue) | #BC7A0B (Amber) |

---

## 3. Filter Restructure

### Type Changes (`src/types/threads.ts`)
Add "flow" to the `FlowMode` type:
```typescript
export type FlowMode = "thread" | "flow" | "dump";
```

### Data Recategorization (`src/data/threads.ts`)
- **Threads**: Automatic background polling/webhooks
- **Flows**: Manual multi-step wizards (interests, family, receipts, llm-import, food-preferences)
- **Dumps**: Bulk sync imports (instagram-sync, twitter-sync, etc.)

### Thread Data Updates
| Thread ID | Current flowMode | New flowMode |
|-----------|-----------------|--------------|
| interests | dump | flow |
| receipts | dump | flow |
| family | dump | flow |
| food-preferences | dump | flow |
| llm-import | dump | flow |
| email-dump | dump | flow |

---

## 4. ThreadTypeBadge Updates

Add support for the new "flow" mode with a distinct color:

| Flow Mode | Background | Text | Border |
|-----------|-----------|------|--------|
| Thread | `bg-blue-500/20` | `text-blue-100` | `border-blue-400/30` |
| Flow | `bg-purple-500/20` | `text-purple-100` | `border-purple-400/30` |
| Dump | `bg-teal-500/20` | `text-teal-100` | `border-teal-400/30` |

---

## 5. Search Implementation

### Search Bar Component (within `ThreadFilterBar.tsx`)
Following the established pattern from `ContactSearch.tsx`:

- Rounded corners (`rounded-xl`)
- Muted background (`bg-secondary/50`)
- No border (`border-0`)
- Search icon on left, clear X on right
- Consistent padding and height

### Filtering Logic (`Threads.tsx`)
Case-insensitive search matching against:
- Thread title
- Thread description

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/threads.ts` | Add "flow" to `FlowMode` type |
| `src/data/threads.ts` | Update `flowMode` for wizard-type threads |
| `src/components/integrations/IntegrationIcon.tsx` | Add `useComplementaryBg` prop with color mapping |
| `src/components/ThreadCard.tsx` | Remove icon wrapper, use larger icons with complementary glow |
| `src/components/threads/ThreadTypeBadge.tsx` | Add "flow" styling |
| `src/components/threads/ThreadFilterBar.tsx` | Remove trigger filter, add "Flows" option, add search bar below pills |
| `src/pages/Threads.tsx` | Add search state, update filtering logic, remove trigger filter state |

---

## Technical Details

### ThreadFilterBar.tsx - New Structure
```tsx
interface ThreadFilterBarProps {
  flowModeFilter: FlowModeFilter;
  searchQuery: string;
  onFlowModeChange: (mode: FlowModeFilter) => void;
  onSearchChange: (query: string) => void;
}

// Render order:
// 1. Filter pills (horizontal, with framer-motion animations)
// 2. Search bar (full width, below filters)

return (
  <div className="flex flex-col gap-3">
    {/* Filter Pills - existing animated buttons */}
    <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-xl">
      {flowModeOptions.map(...)}
    </div>
    
    {/* Search Bar - positioned below */}
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search threads..."
        className="pl-10 pr-10 h-11 rounded-xl text-sm bg-secondary/50 border-0"
      />
      {searchQuery && (
        <button onClick={() => onSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2">
          <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
      )}
    </div>
  </div>
);
```

### IntegrationIcon.tsx - Complementary Glow
```tsx
const integrationColors: Record<string, { complementary: string }> = {
  gmail: { complementary: "#16BC9A" },
  instagram: { complementary: "#1ECF93" },
  twitter: { complementary: "#FFFFFF" },
  youtube: { complementary: "#00FFFF" },
  linkedin: { complementary: "#F5993D" },
  hubspot: { complementary: "#0085A6" },
  trello: { complementary: "#CCAD00" },
  googlephotos: { complementary: "#BC7A0B" },
  // ... etc
};

// When useComplementaryBg is true:
<div 
  className="relative"
  style={{ 
    filter: `drop-shadow(0 0 6px ${integrationColors[icon]?.complementary || 'rgba(255,255,255,0.3)'})` 
  }}
>
  <img src={iconSrc} ... />
</div>
```

### ThreadCard.tsx - Simplified Icon Rendering
```tsx
{hasIntegrations && (
  <div className="flex items-center gap-2">
    {thread.integrations!.map((integration) => (
      <IntegrationIcon
        key={integration}
        icon={integration}
        className="w-7 h-7"
        useComplementaryBg
      />
    ))}
  </div>
)}
```

---

## Accessibility & UX Considerations

- Search input includes a visible clear button for easy reset
- Filter buttons maintain existing spring animations for satisfying tactile feedback
- Icon glow effects are subtle (drop-shadow) to enhance without distracting
- Search is positioned for thumb-friendly mobile interaction
- Empty state messaging updated to reflect search + filter combinations
