

## Thread Authentication Setup — Transfer Prompt

Here is the prompt you can paste into your other Lovable project:

---

**Prompt to paste:**

```text
Set up the Composio OAuth integration gate pattern for threads that require external service connections (e.g., Google Calendar). This project already uses the same Composio account. Here's exactly what's needed:

## 1. Database Table

Create a `user_integrations` table (if it doesn't already exist):

CREATE TABLE public.user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  integration_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  composio_connection_id text,
  account_name text,
  account_email text,
  account_avatar_url text,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations" ON public.user_integrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own integrations" ON public.user_integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own integrations" ON public.user_integrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own integrations" ON public.user_integrations FOR DELETE USING (auth.uid() = user_id);

## 2. Required Supabase Secrets

Set these in your Supabase project's edge function secrets:
- COMPOSIO_API_KEY — your Composio API key (same account as the source project)

## 3. Edge Functions (3 total)

### composio-connect
Initiates OAuth. Accepts `{ toolkit, baseUrl, forceReauth }`. Looks up the auth config ID for the toolkit (e.g., Google Calendar uses `ac_Tahf9NrBD7Vy`), then calls `POST https://backend.composio.dev/api/v3/connected_accounts/link` with the auth config and a callback URL pointing to `/oauth-complete`. Returns `{ redirectUrl, connectionId }`.

### composio-callback
Completes OAuth. Accepts `{ connectionId, userId, toolkit }`. Calls `GET https://backend.composio.dev/api/v3/connected_accounts/{connectionId}` to get connection details, fetches user profile info (name, email, avatar) from the provider, then upserts a row in `user_integrations` with status='connected'.

### composio-disconnect
Tears down connection. Accepts `{ toolkit }`. Deletes the Composio connection via `DELETE https://backend.composio.dev/api/v3/connected_accounts/{connectionId}`, then deletes the row from `user_integrations`.

## 4. Frontend: useComposio Hook

Create a `useComposio(toolkit)` hook that exposes `{ isConnected, connecting, connectedAccount, connect, disconnect, checkStatus }`.

- `checkStatus()`: Queries `user_integrations` for a row matching the current user + toolkit with status='connected'.
- `connect(redirectPath?, forceReauth?)`: Calls the `composio-connect` edge function, stores the return URL, opens the OAuth redirect URL (popup on desktop, redirect on mobile), and polls `user_integrations` every 2s for up to 2 minutes until status='connected'.
- `disconnect()`: Calls `composio-disconnect` edge function.

## 5. Frontend: OAuth Completion Page

Create a route at `/oauth-complete`. This page reads the `connected_account_id` query param from Composio's redirect, calls the `composio-callback` edge function, shows success/error, then either closes the popup or redirects to the stored return URL.

## 6. Frontend: Integration Detail Page

Create a route at `/integration/:integrationId`. Shows the integration name, a Connect button (which calls `useComposio.connect()`), and once connected shows the account info (name, email, avatar) with a Done button. After connection, it checks `sessionStorage` for a return path key (`returnAfter{IntegrationId}Connect`) and auto-redirects back to the thread that initiated the auth.

## 7. Thread Auth Gate Pattern

In any thread component that requires an external service:

1. Call `useComposio("TOOLKIT_NAME")` and `checkStatus()` on mount.
2. If not connected, store the current path: `sessionStorage.setItem("returnAfter{Toolkit}Connect", currentPath)` and redirect to `/integration/{toolkit}`.
3. If connected, proceed to load the thread's config and render the thread UI.

This creates a seamless loop: Thread → Integration page → OAuth → Callback → Integration page (auto-redirect back) → Thread resumes.
```

---

That prompt contains everything needed to recreate the thread authentication gate pattern in a new project using the same Composio account. It covers the database table, three edge functions, the hook, the OAuth completion page, the integration detail page, and the gate pattern itself.

