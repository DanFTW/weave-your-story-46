

## Problem

The Coinbase credential form enforces overly strict validation rules that don't match the actual credential format the user needs:
- **API Key Name** requires `organizations/{org_id}/apiKeys/{key_id}` format, but the user's key name is a simple string like "WeaveFabric"
- **Private Key** requires PEM `BEGIN/END` block format, but the user's key is a plain string (UUID-like)

These validations exist in **two places**: the frontend form component and the edge function.

## Plan

### 1. Relax validation in `ApiKeyCredentialForm.tsx`
- Remove the strict regex for `API Key Name` — keep only `min(1)` and `max(255)`
- Remove the PEM regex for `api key private key` — keep only `min(1)` and `max(10000)`
- Update placeholder text and description to be generic (no references to PEM or `organizations/` format)

### 2. Relax validation in `composio-connect/index.ts`
- Same changes to `coinbaseCredentialsSchema`: remove both regex constraints, keep length validation only
- Redeploy the edge function

### Files Changed
- `src/components/integrations/ApiKeyCredentialForm.tsx` — relax Coinbase schema + update field labels/placeholders/descriptions
- `supabase/functions/composio-connect/index.ts` — relax Coinbase schema, redeploy

