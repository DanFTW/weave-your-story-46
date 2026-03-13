## Plan: Update LIAM API URL from api.tryliam.com to [api.askbuddy.ai](http://api.askbuddy.ai)

Replace the hardcoded LIAM API base URL in `supabase/functions/slack-messages-sync/index.ts` from `https://api.tryliam.com/api/memories` to `https://api.askbuddy.ai/api/memories`.

### Changes to `slack-messages-sync/index.ts`

**Locations:** Lines 202 and 303 **Line 202** (poll action):

- Change: `https://api.tryliam.com/api/memories` → `https://api.askbuddy.ai/api/memories` **Line 303** (search action):
- Change: `https://api.tryliam.com/api/memories` → `https://api.askbuddy.ai/api/memories`   
  
No other logic changes required.