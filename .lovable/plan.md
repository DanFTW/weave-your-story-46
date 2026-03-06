

## Add Coinbase Integration

This plan adds Coinbase as a new integration across the frontend and backend, following the exact patterns used by existing integrations like Dropbox, Slack, and GitHub.

### 1. Copy the official Coinbase SVG icon

Copy the uploaded `coinbase_1_1.svg` to `src/assets/integrations/coinbase.svg`.

### 2. Register icon in both icon components

**`IntegrationIcon.tsx` and `IntegrationLargeIcon.tsx`**: Import `coinbase.svg` and add `coinbase: coinbaseIcon` to the `iconImages` map in both files.

### 3. Add Coinbase to integrations data

**`src/data/integrations.ts`**:
- Add entry to the "Apps" section in `integrationSections`:
  ```ts
  { id: "coinbase", name: "Coinbase", icon: "coinbase", status: "unconfigured" }
  ```
- Add detail entry in `integrationDetails`:
  ```ts
  "coinbase": {
    id: "coinbase", name: "Coinbase", icon: "coinbase", status: "unconfigured",
    description: "Coinbase allows Weave to access your crypto portfolio, transactions, and account info. Create memories from your trading activity and track your financial journey.",
    capabilities: ["View portfolio", "View transactions", "Access accounts", "Read profile"],
    gradientColors: { primary: "#0052FF", secondary: "#0033CC", tertiary: "#1652F0" },
  }
  ```

### 4. Register auth config and toolkit in `composio-connect`

**`supabase/functions/composio-connect/index.ts`**:
- Add `coinbase: "ac_cxfInPfbyIho"` to `AUTH_CONFIGS`
- Add `"coinbase"` to `VALID_TOOLKITS`

### 5. Add Coinbase profile fetching in `composio-callback`

**`supabase/functions/composio-callback/index.ts`**:
- Add `"coinbase": "coinbase"` and `"coinbase_wallet": "coinbase"` to `APP_TO_TOOLKIT`
- Add a `fetchCoinbaseProfile(connectionId)` function that uses the Composio tool execution API pattern (same as GitHub, LinkedIn, Trello). It will call the Composio connected account endpoint to get the access token, then use it to call `GET https://api.coinbase.com/v2/user` with `Authorization: Bearer {token}` and `CB-VERSION: 2024-01-01`. The Coinbase `/v2/user` endpoint returns `{ data: { name, email, avatar_url, username } }`.
- Add the profile-fetching block in the main handler (after existing toolkit blocks):
  ```ts
  if (toolkit === "coinbase") {
    // Fetch via Composio connection → Coinbase /v2/user API
  }
  ```

### 6. Redeploy edge functions

Redeploy `composio-connect` and `composio-callback`.

### Technical notes

- Coinbase uses OAuth2, so the access token from Composio's connection data (`data.access_token`) is used to call `GET https://api.coinbase.com/v2/user` directly. This mirrors the Dropbox/Strava pattern.
- The `/v2/user` endpoint returns `name`, `email`, `username`, and `avatar_url` fields, which populate the connected account card.
- The Coinbase brand color is `#0052FF` (Coinbase Blue).

