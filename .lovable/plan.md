
# Fix HubSpot Memory Creation - Private Key Format Mismatch

## Problem Summary

When clicking "Check Now" on the HubSpot Contact Tracker, the edge function logs show:
```
ERROR: Failed to decode base64
at importPrivateKey (hubspot-automation-triggers/index.ts:65:37)
```

The contacts are being tracked (counter shows 6), but memories fail to save because the cryptographic signing step crashes.

## Root Cause

The `importPrivateKey` function is stripping the wrong PEM headers:

| Current Code (Wrong) | Actual Key Format |
|---------------------|-------------------|
| `-----BEGIN EC PRIVATE KEY-----` | `-----BEGIN PRIVATE KEY-----` |
| `-----END EC PRIVATE KEY-----` | `-----END PRIVATE KEY-----` |

Since the regex doesn't match, the full PEM string (including headers) is passed to `atob()`, which fails because `-----BEGIN...` is not valid base64.

## Solution

Update the `importPrivateKey` function to use PKCS#8 format headers (matching the working `liam-memory` function):

```typescript
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")   // PKCS#8 format
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}
```

## File to Modify

| File | Change |
|------|--------|
| `supabase/functions/hubspot-automation-triggers/index.ts` | Fix `importPrivateKey` PEM headers from "EC PRIVATE KEY" to "PRIVATE KEY" |

## Technical Details

Lines 73-88 of `hubspot-automation-triggers/index.ts`:

**Before:**
```typescript
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContents = pemKey
    .replace(/-----BEGIN EC PRIVATE KEY-----/g, "")
    .replace(/-----END EC PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  ...
}
```

**After:**
```typescript
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  ...
}
```

## Expected Behavior After Fix

1. Click "Check Now" on `/flow/hubspot-tracker`
2. Edge function correctly imports the private key
3. ECDSA signature is generated successfully
4. LIAM API call succeeds
5. Memories appear on the `/memories` page

## Verification

After deployment, check edge function logs for:
- `[HubSpot Poll] Created memory for contact: {name}`
- No more `Failed to decode base64` errors
