

## Rework interests input to tag/chip-based UI with bidirectional LIAM sync

### What changes

Replace the interests textarea with a tag-based input that displays interests as removable chips, prefills from LIAM memories as discrete tags, and syncs new tags back to LIAM.

### Files

#### 1. New: `src/components/flows/weekly-event-finder/InterestTagInput.tsx`

A self-contained chip input component following the existing pattern from `AlertConfig.tsx` keyword chips and `FlowEntryForm.tsx` chips fields.

**Behavior:**
- Renders an array of interest strings as removable pills (`rounded-full`, `bg-primary/10 text-primary`, with `X` button — matching `AlertConfig.tsx` line 138-151)
- Text input + "Add" button at the bottom (matching `AlertConfig.tsx` line 156-175 pattern)
- Enter key adds tag, input clears after add
- Deduplicates tags (case-insensitive)
- Exposes `tags: string[]`, `onTagsChange: (tags: string[]) => void`, `isPrefilling: boolean`

**Styling** — follows existing chip patterns:
```tsx
// Each tag chip (from AlertConfig pattern)
<span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
  {tag}
  <button onClick={() => onRemove(tag)} className="ml-0.5 hover:text-destructive transition-colors">
    <X className="w-3.5 h-3.5" />
  </button>
</span>

// Input row (from AlertConfig pattern)
<input className="flex-1 h-10 px-3 bg-muted rounded-[14px] text-foreground placeholder:text-muted-foreground/60 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
```

#### 2. Update: `src/components/flows/weekly-event-finder/EventFinderConfig.tsx`

- Replace `interests` state from `string` → `string[]`
- Parse prefilled interests string into tags: split on `;` or `,`, then extract topic phrases (strip "My interests and hobbies include:" prefix, trim)
- Replace the `<textarea>` block (lines 72-88) with `<InterestTagInput>`
- Update `canActivate` to check `interestTags.length > 0`
- In `handleActivate`, join tags back to comma-separated string for `onUpdateConfig` (DB schema stays the same)
- Update `syncInterestsToMemory` call to pass joined tags string

**Tag extraction logic** (utility function in the component or a small helper):
```typescript
function parseInterestsToTags(raw: string): string[] {
  return raw
    .replace(/my interests and hobbies include:/i, "")
    .split(/[;,]/)
    .map(s => s.trim())
    .filter(Boolean);
}
```

#### 3. Update: `src/hooks/useInterestSync.ts`

Add a new method `syncNewInterestTag` that creates a single LIAM memory for a newly added tag (rather than bulk-replacing all interests). This is more granular — each tag becomes its own memory.

```typescript
const syncNewInterestTag = async (tag: string): Promise<void> => {
  const trimmed = tag.trim();
  if (!trimmed) return;
  await createMemory(
    `My interests and hobbies include: ${trimmed}`,
    "INTEREST/HOBBY",
    { silent: true }
  );
};
```

Keep the existing `syncInterestsToMemory` for the bulk save on activate.

#### 4. Wire it together in `EventFinderConfig`

- On prefill: parse the semicolon-joined string into tags array
- On add tag: append to local state, fire-and-forget `syncNewInterestTag(newTag)` immediately
- On remove tag: remove from local state only (no LIAM delete — memories persist)
- On activate: join tags, call `onUpdateConfig` with comma-separated string

### Data flow

```text
Open config → prefill() → "art; live music; hiking"
                              ↓ parseInterestsToTags()
                        ["art", "live music", "hiking"]
                              ↓ render as chips

User adds "yoga" → tags = [..., "yoga"]
                   → syncNewInterestTag("yoga") // fire-and-forget to LIAM

User removes "art" → tags = ["live music", "hiking", "yoga"]

Activate → onUpdateConfig("live music, hiking, yoga", ...)
         → syncInterestsToMemory("live music, hiking, yoga", prefillRef)
```

### What stays the same
- Edge function `weekly-event-finder` — no changes
- `useWeeklyEventFinder` hook — no changes
- DB schema (`interests` column stays as text string)
- Location field — unchanged
- All other config fields — unchanged

