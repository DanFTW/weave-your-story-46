

## Replace SMS placeholder with actual HTTP call

### Problem
Line 287 in the edge function logs a console message instead of actually sending an SMS.

### Solution
1. Add `SMS_API_KEY` as a new Supabase secret (user will need to provide the value)
2. Replace the `console.log` placeholder on line 287 with an async `sendSms` helper that POSTs to `https://weave-mcp-server.onrender.com/send` with `{ to, body }` and the `x-api-key` header
3. Read `SMS_API_KEY` from `Deno.env.get()` at the top alongside the other env vars

### Changes

**`supabase/functions/email-text-alert/index.ts`**
- Add `const SMS_API_KEY = Deno.env.get("SMS_API_KEY")!;` near the other env vars (line ~14)
- Add a `sendSms(to: string, body: string)` helper function that POSTs to the endpoint with JSON body `{ to, body }` and header `x-api-key: SMS_API_KEY`, logging success/failure
- Replace line 286-287 (`// Log the would-be SMS` + `console.log(...)`) with a call to `sendSms(configData.phone_number, summary)`

**Supabase secret**
- Add `SMS_API_KEY` secret — user will be prompted for the value

### Redeploy
- Redeploy the `email-text-alert` edge function after the code change

