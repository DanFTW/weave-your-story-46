

## Phone Number Prefill for Weekly Event Finder & Email Text Alert

### Problem
When a user opens either thread config for the first time, the phone number field is empty — even if they already entered it in the other thread or it exists in their LIAM memories. The user shouldn't have to re-enter known data.

### Solution
Create a shared utility hook that resolves the user's phone number from available sources, then use it in both config components.

### Source priority (first non-empty wins)
1. The thread's own saved config (already works)
2. The other thread's config table (cross-thread lookup)
3. LIAM memories (phone/contact tagged memories)

### Implementation

#### 1. New shared hook: `src/hooks/usePhonePrefill.ts`
- Accepts the current `phoneNumber` from the thread's config
- If it's already set, returns it immediately (no fetch)
- Otherwise, queries both config tables and LIAM for a known number
- Returns `{ phoneNumber, isLoading }`

```typescript
export function usePhonePrefill(currentPhone: string | null): { phone: string; isLoading: boolean }
```

Logic:
- Query `email_text_alert_config` and `weekly_event_finder_config` for the current user's `phone_number` (whichever is non-null)
- If still empty, call `liam-memory` list and scan for phone-pattern memories
- Return the first match found

#### 2. Update `EventFinderConfig.tsx`
- Import and call `usePhonePrefill(config.phoneNumber)`
- Initialize `phoneNumber` state from the hook's result instead of just `config.phoneNumber ?? ""`
- Add a `useEffect` that sets the phone state when the hook resolves

#### 3. Update `AlertConfig.tsx`
- Same pattern: import `usePhonePrefill(config.phoneNumber)`, set state from result

### Files changed

| File | Change |
|---|---|
| `src/hooks/usePhonePrefill.ts` | New hook — cross-table + LIAM phone lookup |
| `src/components/flows/weekly-event-finder/EventFinderConfig.tsx` | Use `usePhonePrefill` to initialize phone state |
| `src/components/flows/email-text-alert/AlertConfig.tsx` | Use `usePhonePrefill` to initialize phone state |

No backend/edge function changes needed — the hook queries Supabase tables directly and reuses the existing `liam-memory` proxy via `supabase.functions.invoke`.

