# LIAM/NextD Memory API Documentation

> **Last Updated:** January 2026  
> **Official Documentation:** https://web.askbuddy.ai/brain/#/developers

## Overview

LIAM (Longterm Intelligent Associative Memory) is a memory storage API that allows applications to store, retrieve, and manage user memories with AI-powered categorization and tagging.

---

## API Configuration

### Base URL

**Official (from docs):**
```
https://api.liam.netxd.com/api
```

**Working Proxy (use this from Supabase Edge Functions):**
```
https://web.askbuddy.ai/devspacexdb/api
```

> ⚠️ **Important:** The official URL `api.liam.netxd.com` has DNS resolution issues from Supabase Edge Functions. Use the askbuddy proxy URL which is confirmed working.

### Authentication

The LIAM API uses **ECDSA P-256 (secp256r1) signature-based authentication**. Every request must include:

| Header | Description |
|--------|-------------|
| `apiKey` | Your unique API key (lowercase header name) |
| `signature` | Base64-encoded DER-formatted ECDSA SHA-256 signature |
| `Content-Type` | `application/json` |

> ⚠️ **Critical:** Header names must be lowercase (`apiKey`, `signature`), not `x-api-key` or `X-Signature`.

### User Credentials

Users need three credentials stored in the `user_api_keys` table:

| Field | Description |
|-------|-------------|
| `api_key` | The API key for authentication |
| `private_key` | PEM-formatted PKCS#8 private key for signing (P-256 curve) |
| `user_key` | User-specific identifier for memory operations |

---

## Signature Generation

### Algorithm Details

- **Algorithm:** ECDSA
- **Curve:** P-256 (secp256r1)
- **Hash:** SHA-256
- **Output:** DER-encoded Base64

### Process

1. Stringify the request body: `JSON.stringify(requestBody)`
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

// Convert raw ECDSA signature to DER format
function toDER(signature: Uint8Array): string {
  // Split signature into r and s components (32 bytes each for P-256)
  let r = Array.from(signature.slice(0, 32));
  let s = Array.from(signature.slice(32));

  // Add leading zero if high bit is set (to indicate positive number)
  if (r[0] & 0x80) r = [0].concat(r);
  if (s[0] & 0x80) s = [0].concat(s);

  // Remove leading zeros (except one if next byte has high bit)
  r = removeLeadingZeros(r);
  s = removeLeadingZeros(s);

  // Build DER structure: SEQUENCE { INTEGER r, INTEGER s }
  let arr = [0x02];  // INTEGER tag for r
  constructLength(arr, r.length);
  arr = arr.concat(r);

  arr.push(0x02);  // INTEGER tag for s
  constructLength(arr, s.length);
  arr = arr.concat(s);

  let result = [0x30];  // SEQUENCE tag
  constructLength(result, arr.length);
  result = result.concat(arr);

  // Base64 encode
  return btoa(String.fromCharCode(...result));
}

function removeLeadingZeros(arr: number[]): number[] {
  while (arr.length > 1 && arr[0] === 0 && !(arr[1] & 0x80)) {
    arr = arr.slice(1);
  }
  return arr;
}

function constructLength(arr: number[], len: number): void {
  if (len < 0x80) {
    arr.push(len);
  } else {
    const octets = 1 + (Math.log(len) / Math.LN2 >>> 3);
    arr.push(octets | 0x80);
    for (let i = octets - 1; i >= 0; i--) {
      arr.push((len >>> (i * 8)) & 0xff);
    }
  }
}
```

---

## API Endpoints

### 1. Create Memory

Creates a new memory entry for a user. Memories are automatically tokenized and indexed for efficient retrieval.

**Endpoint:** `POST /api/memory/create`

**Request Body:**

```json
{
  "userKey": "user_unique_identifier",
  "content": "Memory content text",
  "tag": "OPTIONAL_TAG",
  "sessionId": "optional_session_id"
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userKey` | string | ✅ | User's unique identifier |
| `content` | string | ✅ | The memory text to store |
| `tag` | string | ❌ | Category tag for categorization |
| `sessionId` | string | ❌ | Optional session identifier |

**Example Response:**

```json
{
  "status": "Success",
  "message": "Request processed successfully.",
  "data": {
    "transactionNumber": "memory_id_here"
  },
  "timestamp": "2025-03-26T06:35:03.071785+00:00",
  "process_id": "72ce430e0a0c11f091b0e880883aad51"
}
```

---

### 2. List Memories

Retrieves a list of memories for a user, optionally filtered by tokens or query.

**Endpoint:** `POST /api/memory/list`

**Request Body:**

```json
{
  "userKey": "user_unique_identifier",
  "tokens": ["optional", "filter", "tokens"],
  "query": "optional search query"
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userKey` | string | ✅ | User's unique identifier |
| `tokens` | array | ❌ | Array of tokens to filter by |
| `query` | string | ❌ | Search query string |

---

### 3. Forget Memory

Delete or mark a memory as forgotten. This removes the memory from active retrieval while optionally preserving audit history.

**Endpoint:** `POST /api/memory/forget`

**Request Body:**

```json
{
  "userKey": "user_unique_identifier",
  "memoryId": "memory_id_to_delete",
  "permanent": true
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userKey` | string | ✅ | User's unique identifier |
| `memoryId` | string | ✅ | The ID of the memory to forget |
| `permanent` | boolean | ❌ | If true, permanently deletes; if false, soft delete |

---

### 4. Change Tag

Updates the tag/category of an existing memory.

**Endpoint:** `POST /api/memory/change-tag`

> ⚠️ **Note:** The endpoint is `/memory/change-tag` (with hyphen), not `/memory/changeTag`

**Request Body:**

```json
{
  "userKey": "user_unique_identifier",
  "currentTag": "OLD_TAG",
  "updatedTag": "NEW_TAG"
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userKey` | string | ✅ | User's unique identifier |
| `currentTag` | string | ✅ | The current tag to change |
| `updatedTag` | string | ✅ | The new tag value |

---

## Response Format

All API responses follow a consistent JSON structure:

### Success Response (200 OK)

```json
{
  "status": "Success",
  "message": "Request processed successfully.",
  "data": { ... },
  "timestamp": "2025-03-26T06:35:03.071785+00:00",
  "process_id": "72ce430e0a0c11f091b0e880883aad51"
}
```

### Error Response (400 Bad Request)

```json
{
  "status": "Failed",
  "message": "Error description",
  "details": {
    "field": "Specific error details"
  },
  "timestamp": "2025-03-26T06:35:29.916548+00:00",
  "process_id": "82d0ae4b0a0c11f09147e880883aad51"
}
```

---

## Common Errors

| Message | Cause | Solution |
|---------|-------|----------|
| `Missing apikey or signature` | Headers not sent or wrong case | Use lowercase `apiKey` and `signature` |
| `Invalid signature` | Signature doesn't match body | Ensure you're signing `JSON.stringify(body)` exactly |
| `User not found` | Invalid userKey | Verify the userKey is correct |

---

## Best Practices

### 1. Always Use the Central Edge Function

Route all requests through `supabase/functions/liam-memory/index.ts` to ensure:
- Consistent authentication handling
- Centralized error handling
- Single place to update if API changes

### 2. Tag Conventions

Use descriptive tags:
- `EMAIL` - Email-related memories
- `LINK` - Web links and bookmarks
- `MANUAL` - Manually entered memories
- `RECEIPT` - Purchase receipts
- `immigration` - Immigration-related (example from docs)

### 3. Content Formatting

- Keep memories concise but descriptive
- Include dates when relevant
- Include source context (e.g., "Email from John on Jan 15: ...")

### 4. Private Key Format

The private key must be in PKCS#8 PEM format:

```
-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg...
-----END PRIVATE KEY-----
```

---

## Implementation Files

| File | Purpose |
|------|---------|
| `supabase/functions/liam-memory/index.ts` | Main edge function proxy for all LIAM operations |
| `supabase/functions/email-automation-webhook/index.ts` | Webhook handler for email automation |
| `src/hooks/useLiamMemory.ts` | React hook for frontend memory operations |
| `src/hooks/useUserApiKeys.ts` | Hook for managing user API keys |

---

## Changelog

- **2026-01-16:** Corrected API URL to `https://api.liam.netxd.com/api` (verified from official docs)
- **2026-01-16:** Updated change-tag endpoint to use hyphen (`/memory/change-tag`)
- **2026-01-16:** Added `sessionId` parameter for create endpoint
- **2026-01-16:** Fixed header names to lowercase (`apiKey`, `signature`)
