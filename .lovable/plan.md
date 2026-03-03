

## Plan: Birthday Draft Confirmation Screen

### Overview

Add a confirmation step between "Check Now" and draft creation. The edge function gets a new `scan-birthdays` action that returns parsed birthday data without creating drafts. A new reusable `DraftConfirmationScreen` component displays each person as an editable card. Only after the user confirms does a `create-confirmed-drafts` action fire to actually create Gmail drafts.

### Files to create/modify

**1. `supabase/functions/birthday-reminder/index.ts`** — Two new actions:

- `scan-birthdays`: Reuses existing `processUser` logic but stops before draft creation. Returns an array of `{ personName, birthdayDate, email (nullable), contextMemories[] }` for all people with parseable birthdays (no date-range filter — show all). Dedup-skipped people are excluded.
- `create-confirmed-drafts`: Accepts an array of `{ personName, birthdayDate, email, contextMemories[] }` from the client, generates AI emails, creates Gmail drafts, writes dedup rows. Returns per-person success/failure.

**2. `src/types/birthdayReminder.ts`** — Add types:

```typescript
export interface ScannedBirthdayPerson {
  personName: string;
  birthdayDate: string;
  email: string | null;
  contextMemories: string[];
  alreadySent: boolean;
}
```

Add `'confirming'` to `BirthdayReminderPhase`.

**3. `src/hooks/useBirthdayReminder.ts`** — Add two new functions:

- `scanBirthdays()`: Calls `scan-birthdays` action, returns `ScannedBirthdayPerson[]`.
- `createConfirmedDrafts(people)`: Calls `create-confirmed-drafts` action with the user-confirmed list, returns draft count.
- Add `scannedPeople` state and `isScanning` / `isCreatingDrafts` loading states.

**4. `src/components/flows/DraftConfirmationScreen.tsx`** — NEW reusable component:

Props interface designed for reuse by other threads:
```typescript
interface DraftConfirmationPerson {
  id: string;
  name: string;
  subtitle: string;       // e.g. "March 10"
  email: string | null;
  contextItems: string[]; // memories that will personalize the draft
}

interface DraftConfirmationScreenProps {
  title: string;
  people: DraftConfirmationPerson[];
  onConfirm: (confirmed: DraftConfirmationPerson[]) => void;
  onAddPerson?: () => void;
  onBack: () => void;
  isConfirming: boolean;
  emptyMessage?: string;
}
```

Each person card shows:
- Name + birthday (subtitle)
- Email field — pre-filled if found, editable input if missing
- Expandable list of context memories that will be used
- Remove button to exclude from this batch

Bottom: "Add Person" button (calls `onAddPerson`) + "Create N Drafts" confirm button.

**5. `src/components/flows/birthday-reminder/BirthdayReminderFlow.tsx`** — Wire up:

- "Check Now" in `ActiveMonitoring` now calls `scanBirthdays()` → sets phase to `'confirming'`.
- `'confirming'` phase renders `DraftConfirmationScreen` with the scanned people.
- On confirm → calls `createConfirmedDrafts(people)` → shows results → returns to `'active'`.
- "Add Person" opens a simple inline form to manually specify name + birthday + email.

**6. `src/components/flows/birthday-reminder/index.ts`** — No changes needed (DraftConfirmationScreen lives in `src/components/flows/`).

### No other files modified

No database migrations. No changes to other threads, pages, or hooks.

