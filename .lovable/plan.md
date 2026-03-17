

## Problem

Two edge functions insert into `hubspot_processed_contacts` without populating `contact_name` and `company`:

1. **`hubspot-automation-triggers/index.ts` line 297-300** (polling path) — inserts only `user_id` and `hubspot_contact_id`, despite having the full `contact.properties` object available on line 304.
2. **`hubspot-automation-webhook/index.ts` line 161-165** — already fixed in the last edit to include `contact_name` and `company`. No change needed here.

So the real fix is in `hubspot-automation-triggers/index.ts` only.

## Plan

### 1. Fix the insert in `pollHubSpotContacts` (lines 296-300)

Move the `fullName` / `company` extraction **before** the insert, then include them:

```typescript
const fullName = [contact.properties?.firstname, contact.properties?.lastname]
  .filter(Boolean).join(" ") || contact.properties?.email || null;
const company = contact.properties?.company || null;

await supabaseClient.from("hubspot_processed_contacts").insert({
  user_id: userId,
  hubspot_contact_id: hubspotContactId,
  contact_name: fullName,
  company: company,
});
```

The existing `fullName` computation on line 304-306 will be reused (moved up).

### 2. Backfill existing null rows during each poll

After the new-contacts loop (around line 319, before updating config), add a backfill step:

- Query `hubspot_processed_contacts` where `user_id = userId` and `contact_name IS NULL`
- For each such row, look up the matching contact from the already-fetched `contacts` array by `hubspot_contact_id`
- If found, update the row with `contact_name` and `company`
- This is zero-cost since we already have the contacts array in memory; no extra API calls

### Files changed
- `supabase/functions/hubspot-automation-triggers/index.ts` — fix insert + add backfill logic

