

# Threads Page UI Enhancements Implementation

## Summary
Implementing three key improvements to the `/threads` page:
1. **Larger integration icons** without transparent frames
2. **Simplified filter bar** with Threads/Flows/Dumps categories (removing auto/manual filter)
3. **Search bar** positioned below the filter pills

---

## Layout Structure

```text
┌─────┬──────────┬────────┬────────┐
│ All │ Threads  │ Flows  │ Dumps  │  ← Filter pills (TOP)
└─────┴──────────┴────────┴────────┘
┌─────────────────────────────────────────────────┐
│ 🔍 Search threads...                         ✕  │  ← Search bar (BELOW)
└─────────────────────────────────────────────────┘
```

---

## Technical Changes

### 1. Types Update (`src/types/threads.ts`)

Add "flow" to the FlowMode union type - no changes needed, already supports extension.

---

### 2. Thread Data Update (`src/data/threads.ts`)

Re-categorize threads:

| Category | Examples |
|----------|----------|
| **Threads** | Instagram Live, Twitter Live, LinkedIn Contacts, Email Automation, HubSpot, Trello |
| **Flows** | Family, Food Preferences, Receipts, Interests, LLM Import |
| **Dumps** | Instagram Dump, Twitter Dump, YouTube Dump, Google Photos, Email Dump |

---

### 3. Thread Card Updates (`src/components/ThreadCard.tsx`)

- Remove the `bg-white/20 backdrop-blur-sm` wrapper container
- Increase icon size from `w-4 h-4` to `w-7 h-7`
- Remove the trigger type badge (keep only flowMode badge)

---

### 4. Filter Bar Updates (`src/components/threads/ThreadFilterBar.tsx`)

**New Props Interface:**
```typescript
interface ThreadFilterBarProps {
  flowModeFilter: FlowModeFilter;
  searchQuery: string;
  onFlowModeChange: (mode: FlowModeFilter) => void;
  onSearchChange: (query: string) => void;
}
```

**Component Structure:**
```tsx
return (
  <div className="space-y-3">
    {/* Filter pills - TOP */}
    <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-xl">
      {flowModeOptions.map((option) => (
        // Animated pill buttons with layoutId
      ))}
    </div>
    
    {/* Search bar - BELOW */}
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 ..." />
      <Input placeholder="Search threads..." ... />
      {searchQuery && <X onClick={clear} ... />}
    </div>
  </div>
);
```

---

### 5. Thread Type Badge Updates (`src/components/threads/ThreadTypeBadge.tsx`)

Add styling for the new "flow" type:

| FlowMode | Background | Text | Border |
|----------|------------|------|--------|
| `thread` | `bg-blue-500/20` | `text-blue-100` | `border-blue-400/30` |
| `flow` | `bg-purple-500/20` | `text-purple-100` | `border-purple-400/30` |
| `dump` | `bg-teal-500/20` | `text-teal-100` | `border-teal-400/30` |

---

### 6. Page Updates (`src/pages/Threads.tsx`)

- Remove `triggerFilter` state
- Add `searchQuery` state
- Update filtering logic to include search
- Pass new props to ThreadFilterBar

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/data/threads.ts` | Update flowMode for wizard-type threads to "flow" |
| `src/components/ThreadCard.tsx` | Larger icons (w-7 h-7), remove wrapper, remove trigger badge |
| `src/components/threads/ThreadFilterBar.tsx` | Filter pills on top, search bar below, add Flows option, remove trigger filter |
| `src/components/threads/ThreadTypeBadge.tsx` | Add "flow" badge styling with purple color scheme |
| `src/pages/Threads.tsx` | Add search state, update filtering logic, remove trigger filter state |

