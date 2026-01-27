
# Fix HubSpot Contact Tracker - Contacts Not Saving

## Problem Summary

When clicking "Check Now" on the HubSpot Contact Tracker, no contacts are found or saved because:

1. **Wrong Composio Tool Name**: `HUBSPOT_LIST_CONTACTS` doesn't exist (404 error)
2. **No Memory Creation**: Code has a `// TODO` placeholder - memories are never created
3. **Counter Bug**: `contacts_tracked` is overwritten instead of accumulated

## Solution

Replace the broken Composio tool call with direct HubSpot API access (matching the proven LinkedIn pattern), and implement full LIAM memory creation.

## Technical Changes

### File: `supabase/functions/hubspot-automation-triggers/index.ts`

**1. Add OAuth Token Retrieval**
```typescript
async function getHubSpotAccessToken(connectionId: string): Promise<string | null>
```
Fetch the access_token from Composio connected account metadata.

**2. Add Direct HubSpot API Call**
```typescript
async function fetchHubSpotContacts(accessToken: string): Promise<HubSpotContact[]>
```
Call `GET https://api.hubapi.com/crm/v3/objects/contacts` with OAuth token.

**3. Add LIAM Crypto Utilities**
Port from `linkedin-automation-poll`:
- `importPrivateKey()` - Import PKCS#8 private key
- `signRequest()` - ECDSA SHA-256 signing
- `toDER()` - Convert raw signature to DER format

**4. Add Memory Creation**
```typescript
async function createMemory(apiKeys, content: string): Promise<boolean>
```
Create memory via LIAM API with proper authentication.

**5. Update pollHubSpotContacts()**
- Fetch user's LIAM API keys from `user_api_keys` table
- Get HubSpot OAuth token from Composio
- Fetch contacts from HubSpot CRM API
- Deduplicate via `hubspot_processed_contacts` table
- Create LIAM memory for each new contact
- Accumulate `contacts_tracked` counter correctly

## Memory Format

```
HubSpot Contact Added

Name: John Smith
Email: john@acmecorp.com
Company: Acme Corporation
Title: Product Manager
Added: January 27, 2026

A new contact was added to your HubSpot CRM.
```

## Expected Behavior After Fix

1. Click "Check Now" on `/flow/hubspot-tracker`
2. Contacts fetched from HubSpot CRM API
3. New contacts saved as memories via LIAM API
4. Counter increments correctly
5. UI shows updated stats
