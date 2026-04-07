

## Fix event notifications: response inspection, SMS delivery, and DB migration

### Problem summary

1. **Email delivery** — `sendEmail` only checks `res.ok` but Composio can return 200 with `{ successful: false }`. Failures are invisible.
2. **SMS delivery** — The text delivery branch is a `console.log` stub that fakes success. No actual SMS is sent.
3. **No phone_number column** — `weekly_event_finder_config` has no `phone_number` field, so there's nowhere to store the user's phone number for text delivery.

### Changes

#### 1. DB migration — add `phone_number` to `weekly_event_finder_config`

```sql
ALTER TABLE public.weekly_event_finder_config
ADD COLUMN phone_number text DEFAULT null;
```

#### 2. `sendEmail` — add Composio response body inspection

Read and parse the JSON body after every call. Check for `successful === false` or `error` fields. Log the full response. Return false on logical failure even if HTTP was 200.

```typescript
async function sendEmail(connId, to, subject, bodyText) {
  const res = await fetch(...);
  const data = await res.json();

  if (!res.ok || data?.successful === false || data?.error) {
    console.error("[EventFinder] Gmail send failed:", res.status, JSON.stringify(data));
    return false;
  }

  console.log("[EventFinder] Gmail send succeeded");
  return true;
}
```

#### 3. `sendSms` — implement real SMS delivery

Add a `sendSms` function matching the proven pattern from `email-text-alert`:

```typescript
const SMS_API_KEY = Deno.env.get("SMS_API_KEY")!;

async function sendSms(to: string, body: string): Promise<boolean> {
  const res = await fetch("https://weave-mcp-server.onrender.com/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": SMS_API_KEY,
    },
    body: JSON.stringify({ to, body }),
  });
  if (!res.ok) {
    console.error("[EventFinder] SMS failed:", res.status, await res.text());
    return false;
  }
  console.log("[EventFinder] SMS sent to", to);
  return true;
}
```

#### 4. Update the text delivery branch in `manual-sync`

Replace the stub with an actual `sendSms` call using `cfg.phone_number`:

```typescript
} else if (cfg.delivery_method === "text" && cfg.phone_number) {
  const sent = await sendSms(cfg.phone_number, emailBody);
  if (sent) delivered = newEvents.length;
} else {
  console.warn("[EventFinder] No valid delivery target configured");
}
```

#### 5. Update `update-config` action to accept `phoneNumber`

Add `phoneNumber` to the destructured params and persist it as `phone_number`.

#### 6. Frontend — wire `phone_number` through config and UI

- **`src/types/weeklyEventFinder.ts`** — add `phoneNumber: string | null` to `WeeklyEventFinderConfig`.
- **`src/hooks/useWeeklyEventFinder.ts`** — map `phone_number` from DB row, pass it in `updateConfig`.
- **`src/components/flows/weekly-event-finder/EventFinderConfig.tsx`** — add a phone number input field (shown when delivery method is "text"), matching the existing email input pattern.

#### 7. Redeploy the edge function

### Files touched

- `supabase/functions/weekly-event-finder/index.ts` — steps 2, 3, 4, 5
- `src/types/weeklyEventFinder.ts` — step 6
- `src/hooks/useWeeklyEventFinder.ts` — step 6
- `src/components/flows/weekly-event-finder/EventFinderConfig.tsx` — step 6
- DB migration — step 1

