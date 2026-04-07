

## Fix SMS endpoint URL in both edge functions

Both `weekly-event-finder` and `email-text-alert` edge functions use the incorrect SMS gateway URL `https://weave-mcp-server.onrender.com/send`. Both need to be updated to `https://weave-fabric-sms.onrender.com/send`.

### Changes

**1. `supabase/functions/weekly-event-finder/index.ts` (line 327)**
Change URL from `https://weave-mcp-server.onrender.com/send` to `https://weave-fabric-sms.onrender.com/send`.

**2. `supabase/functions/email-text-alert/index.ts` (line 187)**
Same URL change.

**3. Redeploy both edge functions.**

