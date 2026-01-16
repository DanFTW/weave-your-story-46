# LIAM/NextD Memory API Documentation

> **Last Updated:** January 2026  
> **Documentation URL:** https://web.askbuddy.ai/brain/#/developers

## Overview

LIAM (Longterm Intelligent Associative Memory) is a memory storage API that allows applications to store, retrieve, and manage user memories with AI-powered categorization and tagging.

---

## API Configuration

### Base URL

```
https://web.askbuddy.ai/devspacexdb/api
```

### Authentication

The LIAM API uses **ECDSA P-256 signature-based authentication**. Every request must include:

| Header | Description |
|--------|-------------|
| `apiKey` | Your API key (lowercase header name) |
| `signature` | Base64-encoded DER-formatted ECDSA SHA-256 signature |
| `Content-Type` | `application/json` |

> ⚠️ **Critical:** Header names must be lowercase (`apiKey`, `signature`), not `x-api-key` or `X-Signature`.

### User Credentials

Users need three credentials stored in the `user_api_keys` table:

| Field | Description |
|-------|-------------|
| `api_key` | The API key for authentication |
| `private_key` | PEM-formatted PKCS#8 private key for signing |
| `user_key` | User-specific identifier for memory operations |

---

## Signature Generation

### Algorithm

1. Convert request body to JSON string: `JSON.stringify(requestBody)`
2. Sign with ECDSA SHA-256 using the P-256 private key
3. Convert the raw 64-byte signature to DER format
4. Base64 encode the DER-formatted signature

### Code Example (Deno/Web Crypto)

```typescript
// Import PKCS#8 private key
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return await crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

// Sign request body
async function signRequest(privateKey: CryptoKey, body: object): Promise<string> {
  const bodyStr = JSON.stringify(body);
  const encoder = new TextEncoder();
  const data = encoder.encode(bodyStr);
  
  const rawSignature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    data
  );
  
  return toDER(new Uint8Array(rawSignature));
}

// Convert raw signature to DER format
function toDER(signature: Uint8Array): string {
  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);
  
  const formatInt = (arr: Uint8Array): number[] => {
    const result: number[] = [];
    let i = 0;
    while (i < arr.length - 1 && arr[i] === 0) i++;
    if (arr[i] >= 0x80) result.push(0);
    for (; i < arr.length; i++) result.push(arr[i]);
    return result;
  };
  
  const rFormatted = formatInt(r);
  const sFormatted = formatInt(s);
  
  const sequence = [
    0x02, rFormatted.length, ...rFormatted,
    0x02, sFormatted.length, ...sFormatted,
  ];
  
  const der = new Uint8Array([0x30, sequence.length, ...sequence]);
  return btoa(String.fromCharCode(...der));
}
```

---

## API Endpoints

### 1. Create Memory

Creates a new memory for the user.

**Endpoint:** `POST /memory/create`

**Request Body:**

```json
{
  "userKey": "user_unique_identifier",
  "content": "Memory content text",
  "tag": "OPTIONAL_TAG"
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userKey` | string | ✅ | User's unique identifier |
| `content` | string | ✅ | The memory text to store |
| `tag` | string | ❌ | Category tag (uppercase, e.g., `EMAIL`, `LINK`, `FAMILY`) |

**Response:**

```json
{
  "status": "Success",
  "data": {
    "transactionNumber": "memory_id_here"
  }
}
```

---

### 2. List Memories

Retrieves all memories for a user.

**Endpoint:** `POST /memory/list`

**Request Body:**

```json
{
  "userKey": "user_unique_identifier"
}
```

**Response:**

```json
{
  "status": "Success",
  "data": {
    "memories": [
      {
        "transactionNumber": "memory_id",
        "content": "Memory text",
        "tag": "CATEGORY",
        "createdAt": "2026-01-16T12:00:00Z"
      }
    ]
  }
}
```

---

### 3. Forget Memory

Deletes a memory.

**Endpoint:** `POST /memory/forget`

**Request Body:**

```json
{
  "userKey": "user_unique_identifier",
  "transactionNumber": "memory_id_to_delete",
  "memoryId": "memory_id_to_delete",
  "permanent": true
}
```

> ⚠️ **Note:** The API expects `transactionNumber` but some documentation shows `memoryId`. Send both for compatibility.

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userKey` | string | ✅ | User's unique identifier |
| `transactionNumber` | string | ✅ | The memory ID to delete |
| `memoryId` | string | ✅ | Same as transactionNumber (for compatibility) |
| `permanent` | boolean | ❌ | If true, permanently deletes; if false, soft delete |

---

### 4. Change Tag

Updates the tag/category of an existing memory.

**Endpoint:** `POST /memory/changeTag`

**Request Body:**

```json
{
  "userKey": "user_unique_identifier",
  "transactionNumber": "memory_id",
  "notesKey": "NEW_TAG"
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userKey` | string | ✅ | User's unique identifier |
| `transactionNumber` | string | ✅ | The memory ID to update |
| `notesKey` | string | ✅ | New tag (uppercase, e.g., `WORK`, `PERSONAL`) |

---

## Error Responses

### Common Error Format

```json
{
  "status": "Failed",
  "message": "Error description",
  "details": {},
  "timestamp": "2026-01-16T19:54:37.677834+00:00",
  "processId": "XD302EE584F31511F0BD10278DF3387F0A",
  "referenceId": "XD302EE584F31511F0BD10278DF3387F0A"
}
```

### Common Errors

| Message | Cause | Solution |
|---------|-------|----------|
| `Missing apikey or signature` | Headers not sent or wrong case | Use lowercase `apiKey` and `signature` |
| `Invalid signature` | Signature doesn't match body | Ensure you're signing `JSON.stringify(body)` exactly |
| `User not found` | Invalid userKey | Verify the userKey is correct |

---

## Best Practices

### 1. Always Use the Central Edge Function

Instead of calling the LIAM API directly from multiple places, route all requests through `supabase/functions/liam-memory/index.ts`. This ensures:
- Consistent authentication handling
- Centralized error handling
- Single place to update if API changes

### 2. Tag Conventions

Use uppercase tags with underscores:
- `EMAIL` - Email-related memories
- `LINK` - Web links and bookmarks
- `MANUAL` - Manually entered memories
- `RECEIPT` - Purchase receipts
- `FAMILY` - Family-related
- `WORK` - Work-related

### 3. Content Formatting

- Keep memories concise but descriptive
- Include dates when relevant
- Include source context (e.g., "Email from John on Jan 15: ...")

### 4. Error Handling

Always handle these scenarios:
1. Network failures (DNS, timeout)
2. Authentication failures (expired/invalid keys)
3. API errors (validation, not found)

### 5. Private Key Format

The private key must be in PKCS#8 PEM format:

```
-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg...
-----END PRIVATE KEY-----
```

Both `-----BEGIN PRIVATE KEY-----` (PKCS#8) and `-----BEGIN EC PRIVATE KEY-----` (SEC1) formats should be supported.

---

## Implementation Files

| File | Purpose |
|------|---------|
| `supabase/functions/liam-memory/index.ts` | Main edge function proxy for all LIAM operations |
| `supabase/functions/email-automation-webhook/index.ts` | Webhook handler for email automation |
| `src/hooks/useLiamMemory.ts` | React hook for frontend memory operations |
| `src/hooks/useUserApiKeys.ts` | Hook for managing user API keys |

---

## Testing

### Manual Test via curl

```bash
# Test through the edge function
curl -X POST \
  'https://ttanhgbtdyatzacxhxjj.supabase.co/functions/v1/liam-memory' \
  -H 'Authorization: Bearer YOUR_SUPABASE_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"action": "list"}'
```

### Edge Function Logs

Check logs in Supabase Dashboard or via:
- `email-automation-webhook` - For email automation webhook
- `liam-memory` - For general memory operations

---

## Changelog

- **2026-01-16:** Fixed API URL from `https://api.heylia.ai` to `https://web.askbuddy.ai/devspacexdb/api`
- **2026-01-16:** Fixed header names from `x-api-key`/`x-signature` to `apiKey`/`signature`
- **2026-01-16:** Fixed request body format to use `content` instead of `text`
