
Goal: Make `/flow/birthday-reminder` reliably send to the correct contact email (including Frenboi) and only mark reminders as sent when provider-confirmed, with no unrelated changes.

What I found in preliminary investigation:
- Birthdays are being detected correctly (including same-day).
- `birthday_reminders_sent` has a 2026 row for `Frenboi`, so the flow now treats it as already sent.
- Current send flow can still be unreliable because:
  1) email selection is naive (`first memory containing name + "email"`), which can pick stale/wrong addresses;
  2) send success is based mostly on HTTP `res.ok`, not strict provider payload confirmation;
  3) dedup is written after that success check, so a false-positive send can block retries all year.

Implementation plan (focused):
1. Harden recipient resolution in `supabase/functions/birthday-reminder/index.ts`
   - Replace `extractEmailFromMemories` with deterministic candidate scoring:
     - prefer explicit patterns like `"{name}'s email is ..."`, `"email for {name} is ..."`;
     - normalize name matching (trim, lowercase, punctuation-insensitive);
     - if multiple candidates, pick highest-confidence + newest memory;
     - if ambiguous, skip send and log ambiguity (fail-safe).
   - Add explicit log: selected recipient for each person.

2. Harden Composio send confirmation (fail-closed)
   - In `sendEmailViaComposio`, always parse response body.
   - Treat as success only if:
     - HTTP is OK, and
     - payload has no `error`, and
     - payload indicates successful execution (tool result success marker).
   - Log provider request/result identifiers for traceability.
   - If uncertain/partial response: treat as failure, do not dedup.

3. Improve delivery audit (directly related to this issue)
   - Add migration for `birthday_reminders_sent`:
     - `recipient_email text`,
     - `provider_status text` (optional but recommended),
     - `provider_response jsonb` (optional compact error/success metadata).
   - Store recipient + provider outcome on successful send (and optionally failed attempts if you want audit history).

4. Preserve dedup correctness
   - Keep dedup write only after confirmed send success.
   - Keep same once-per-person/year behavior, but avoid false positives.

5. Recovery path for Frenboi specifically
   - After code fix, remove the stale 2026 dedup row for Frenboi (single targeted row) so one clean resend can occur.
   - Trigger `manual-poll` and verify:
     - logs show selected recipient `fury1753@gmail.com`,
     - provider confirmation is successful,
     - new sent row contains correct recipient metadata.

Technical details (implementation-specific):
```text
Current flow:
birthday detected -> recipient inferred (weak) -> send (weak confirmation) -> dedup row

Planned flow:
birthday detected
  -> recipient candidates ranked (explicit > generic, newest wins)
  -> send via Composio with strict payload validation
  -> only on confirmed success: write dedup + recipient metadata
  -> on failure/ambiguity: skip dedup, log reason
```

Files in scope only:
- `supabase/functions/birthday-reminder/index.ts`
- `supabase/migrations/*` (one migration for reminder delivery audit fields)
- `src/types/birthdayReminder.ts` and birthday reminder UI hook/component only if exposing recipient in “Sent Reminders” (optional but recommended for verification)

Verification checklist:
- Create/confirm a same-day birthday memory for Frenboi + explicit email memory.
- Run `Check Now`.
- Confirm edge logs show resolved recipient and confirmed provider success.
- Confirm `birthday_reminders_sent` row contains Frenboi + `fury1753@gmail.com`.
- Confirm user receives the email (inbox/spam/promotions check once).
