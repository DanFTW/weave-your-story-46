# Add Slack Integration to /integrations Page

## Overview

Add Slack as a fully functional integration on the /integrations page, using the user-provided logo (PNG) and Composio auth config `ac_BOCrE-Q-yqJu`. Profile data (name, email, avatar) will be fetched via Composio Tool Execution (two-step: `SLACK_GET_AUTH_TEST` then `SLACK_GET_USER_INFO`).

**Suggestion (preflight):** Before wiring this in, confirm in Composio that auth config `ac_BOCrE-Q-yqJu` is actually for **Slack** (toolkit slug `SLACK`) and not another toolkit. If it’s not Slack, replace this ID everywhere below with the correct Slack auth config ID.

---

## Changes

### 1. Copy Slack Logo Asset

Copy the uploaded `Slack_New_Logo_Icon.png` to `src/assets/integrations/slack.png`.

### 2. Fix Icon Imports (slack.svg does not exist)

Both `IntegrationIcon.tsx` and `IntegrationLargeIcon.tsx` import `slack.svg` which does not exist. Update both to import `slack.png` instead, and add `slack` to the `iconImages` map in `IntegrationLargeIcon.tsx` (it is already mapped in `IntegrationIcon.tsx`).

**Files:**

- `src/components/integrations/IntegrationIcon.tsx` -- change import from `.svg` to `.png`
- `src/components/integrations/IntegrationLargeIcon.tsx` -- change import from `.svg` to `.png`, add `slack: slackIcon` to `iconImages` map

### 3. Add Slack to Integration Data

**File:** `src/data/integrations.ts`

- Add Slack entry to the `integrationSections[0].integrations` array (Apps section):
  ```
  { id: "slack", name: "Slack", icon: "slack", status: "unconfigured" }

  ```
- Add Slack detail to `integrationDetails`:
  ```
  slack: {
    id: "slack",
    name: "Slack",
    icon: "slack",
    status: "unconfigured",
    description: "Slack allows Weave to access your workspaces, channels, and messages. Create memories from important conversations, decisions, and team collaborations.",
    capabilities: ["View channels", "Read messages", "Access profile", "View workspaces"],
    gradientColors: {
      primary: "#4A154B",   // Slack aubergine
      secondary: "#611f69", // Slack dark purple
      tertiary: "#36C5F0",  // Slack blue
    },
  }

  ```

### 4. Add Slack to Available Integrations List

**File:** `src/components/integrations/IntegrationSection.tsx`

Add `"slack"` to the `availableIntegrations` array so it shows as connectable (not "Coming soon").

### 5. Add Slack Auth Config to Composio Connect

**File:** `supabase/functions/composio-connect/index.ts`

- Add `slack: "ac_BOCrE-Q-yqJu"` to `AUTH_CONFIGS`
- Add `"slack"` to `VALID_TOOLKITS`

### 6. Add Slack Profile Fetching to Composio Callback

**File:** `supabase/functions/composio-callback/index.ts`

- Add Slack mappings to `APP_TO_TOOLKIT`: `"slack" -> "slack"`, `"slack_bot" -> "slack"`
- Add a `fetchSlackProfile(connectionId)` function using the two-step Composio Tool Execution pattern:
  1. Call `SLACK_GET_AUTH_TEST` to get the `user_id`
  2. Call `SLACK_GET_USER_INFO` with that `user_id` to get `real_name`, `email`, and `image_192`
- Wire it into the main callback handler so Slack connections populate the account card with name, email, and avatar

**Suggestion (resilience):** Implement a tiny tool-slug fallback with logging inside `fetchSlackProfile` so if Composio’s Slack tool slugs differ in your workspace/version, you can adjust without breaking the integration. Concretely: attempt `SLACK_GET_AUTH_TEST`, and if Composio returns “tool not found”, log it and try the next known alternative slug (same idea for `SLACK_GET_USER_INFO`). Keep the final output mapping identical (`account_name`, `account_email`, `account_avatar_url`) so the frontend card parsing never changes.

**Suggestion (naming clarity):** If your existing code uses `connected_account_id` everywhere, name the function param `connectedAccountId` (even if the value is the same as `connectionId`) to avoid accidentally passing an integration ID instead of a `ca_*` id.

### 7. Deploy Edge Functions

Redeploy `composio-connect` and `composio-callback`.

---

## Files Modified


| File                                                   | Change                                   |
| ------------------------------------------------------ | ---------------------------------------- |
| `src/assets/integrations/slack.png`                    | Copy uploaded logo                       |
| `src/components/integrations/IntegrationIcon.tsx`      | Fix import: `.svg` to `.png`             |
| `src/components/integrations/IntegrationLargeIcon.tsx` | Fix import: `.svg` to `.png`, add to map |
| `src/data/integrations.ts`                             | Add Slack entry + detail                 |
| `src/components/integrations/IntegrationSection.tsx`   | Add "slack" to available list            |
| `supabase/functions/composio-connect/index.ts`         | Add auth config + valid toolkit          |
| `supabase/functions/composio-callback/index.ts`        | Add profile fetching + toolkit mapping   |


No other files changed.