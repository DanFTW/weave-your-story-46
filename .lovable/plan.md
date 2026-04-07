

# Per-Sender Keywords for Email Text Alert

## Overview

Change the alert configuration from two flat lists (senders, keywords) to a structured model where each sender email has its own set of keywords. Stored as JSON in the existing `sender_filter` column — no database migration needed.

## Data Model

New serialization format for `sender_filter` column:

```text
[
  { "email": "boss@company.com", "keywords": ["urgent", "invoice"] },
  { "email": "hr@company.com",   "keywords": ["benefits"] }
]
```

The `keyword_filter` column becomes unused (left null for backward compat).

## New Type

Add to `src/types/emailTextAlert.ts`:

```ts
export interface SenderRule {
  email: string;
  keywords: string[];
}
```

## Files Changed

### 1. `src/types/emailTextAlert.ts`
- Add `SenderRule` interface

### 2. `src/components/flows/email-text-alert/AlertConfig.tsx` (full rewrite of form body)
- State becomes `rules: SenderRule[]` parsed from `config.senderFilter` (JSON) with fallback to legacy comma format
- UI: each rule rendered as a card (`bg-card rounded-2xl border`) showing the email as a header, keyword chips underneath, an inline input to add keywords, and a remove-rule button
- Bottom section: "Add sender" input + button to append a new `SenderRule` with empty keywords
- `handleActivate` serializes `rules` as JSON into the `senderFilter` param, passes empty string for `keywordFilter`
- `canActivate` checks `rules.length > 0 && phoneNumber`

### 3. `src/components/flows/email-text-alert/ActiveMonitoring.tsx`
- Update config summary to parse JSON from `config.senderFilter` and display each sender with its keyword count (e.g., "boss@co.com (3 keywords)")

### 4. `src/hooks/useEmailTextAlert.ts`
- No signature change needed — `updateConfig(senderFilter, keywordFilter, phoneNumber)` already accepts strings; AlertConfig will pass JSON as the `senderFilter` string

### 5. `supabase/functions/email-text-alert/index.ts`
- Update `buildGmailQuery` to detect JSON format (starts with `[`) and parse `SenderRule[]`
- Build query: for each rule, create `(from:email AND ("kw1" OR "kw2"))`, join all rules with ` OR `
- Fallback to legacy comma-separated parsing for backward compat

### 6. Edge function redeployment
- Redeploy `email-text-alert` after code change

## UI Layout (per sender card)

```text
┌─────────────────────────────────────┐
│ ✉ boss@company.com              [×] │
│                                     │
│  [urgent ×] [invoice ×]            │
│  [+ add keyword input        ] [+] │
└─────────────────────────────────────┘
```

Cards use the same `bg-card rounded-2xl border border-border p-5` pattern used throughout the flow. Keyword chips use the existing `rounded-full bg-primary/10 text-primary` style. Remove buttons use `X` icon with `hover:text-destructive`.

