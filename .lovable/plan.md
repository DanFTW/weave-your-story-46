
# Fix: Share Memory Link Generation + Email Notification + Contacts Picker

## Root Cause Analysis

### Bug 1 — 401 "Invalid or expired session" (Primary Blocker)

The edge function calls `userClient.auth.getClaims(token)` to verify the JWT locally inside the Deno runtime. This works with HS256 (symmetric) JWTs but **fails silently with ES256 (asymmetric) JWTs** issued by Lovable Cloud — the edge runtime does not hold the asymmetric public key, so `getClaims()` returns an error, triggering the 401 branch.

**Fix**: Replace `getClaims(token)` with `userClient.auth.getUser()` (called with no argument — the token is already forwarded via the `global.headers` on the client). This delegates to the Supabase Auth service, which handles both HS256 and ES256 correctly. This is the canonical Lovable pattern for `verify_jwt = false` functions.

```typescript
// WRONG — local verification, fails on ES256
const { data: claimsData, error } = await userClient.auth.getClaims(token);

// CORRECT — server-side verification via Auth service
const { data: userData, error } = await userClient.auth.getUser();
const userId = userData?.user?.id;
```

### Bug 2 — Recipients insert uses `userClient` (secondary)

After the auth is fixed, the `memory_share_recipients` insert uses `userClient` which is subject to RLS. The `msr_owner_insert` WITH CHECK calls `user_owns_share(share_id)` — this should work once the correct `userId` is in the session. No change needed here once Bug 1 is fixed.

### Bug 3 — No email delivery to recipients

When recipients are added, the edge function stores them in DB but never sends any notification. This leaves recipients with no way to know a link was shared with them. We will add email delivery via **Resend** (free tier, 3,000 emails/month, no credit card). A `RESEND_API_KEY` secret needs to be added first.

### Bug 4 — Contacts picker (Apple Contacts / native share)

The Web Contacts API (`navigator.contacts.select()`) is available in Safari on iOS 14.5+ and allows picking contacts directly. After picking, each contact's email(s) are added to the recipients list, or if no email is available (phone only), the native Web Share API is triggered so the user can send via iMessage/WhatsApp/etc. This requires no special permissions on web — the browser handles the OS prompt.

---

## Files to Change

| File | Change |
|---|---|
| `supabase/functions/memory-share/index.ts` | Fix auth (`getUser()` instead of `getClaims()`); add Resend email send for recipients |
| `src/components/memories/ShareMemoryModal.tsx` | Add "Pick from Contacts" button using Web Contacts API; trigger native share for contact phone numbers |

No DB migration needed. No new edge function. One new secret: `RESEND_API_KEY`.

---

## Detailed Changes

### 1. Edge Function — Auth Fix + Email Notification

**Auth fix** (lines 45–60 of current `index.ts`):

Replace:
```typescript
const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
if (claimsError || !claimsData?.claims) { /* 401 */ }
const userId = claimsData.claims.sub;
```

With:
```typescript
const { data: userData, error: userError } = await userClient.auth.getUser();
if (userError || !userData?.user) { /* 401 */ }
const userId = userData.user.id;
```

**Email notification** — after recipients are stored in DB, loop through `normalizedEmails` and call Resend:
```typescript
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
if (RESEND_API_KEY && normalizedEmails.length > 0) {
  for (const email of normalizedEmails) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Weave <noreply@weave-your-story-46.lovable.app>",
        to: [email],
        subject: `${ownerName ?? "Someone"} shared a memory with you`,
        html: `<p>You've been invited to view a memory on Weave.</p><p><a href="${shareUrl}">View memory →</a></p>`,
      }),
    });
  }
}
```

Note: Resend requires a verified sending domain. The initial from-address will use Resend's free test domain (`onboarding@resend.dev`) if the custom domain isn't verified yet. We'll add the `RESEND_API_KEY` secret via the secrets tool first, then the code.

### 2. Frontend — Contacts Picker + Share Sheet

In `ShareMemoryModal.tsx`, add a "Pick from Contacts" button next to the email input in Step 2:

```tsx
// Check if Contacts API is available (iOS Safari 14.5+)
const contactsApiAvailable =
  typeof navigator !== "undefined" &&
  "contacts" in navigator &&
  "ContactsManager" in window;

const handlePickContacts = async () => {
  try {
    // Request email + name; may also return tel if email unavailable
    const contacts = await (navigator as any).contacts.select(
      ["name", "email", "tel"],
      { multiple: true }
    );
    
    const emailsAdded: string[] = [];
    const phonesOnly: string[] = [];
    
    for (const contact of contacts) {
      if (contact.email?.length > 0) {
        for (const email of contact.email) {
          const normalized = email.trim().toLowerCase();
          if (isValidEmail(normalized) && !recipients.includes(normalized)) {
            emailsAdded.push(normalized);
          }
        }
      } else if (contact.tel?.length > 0) {
        // Contact has no email — collect phone for native share
        phonesOnly.push(contact.tel[0]);
      }
    }
    
    if (emailsAdded.length > 0) {
      setRecipients(prev => [...prev, ...emailsAdded].slice(0, 20));
    }
    
    // For phone-only contacts, trigger native share immediately
    if (phonesOnly.length > 0 && shareUrl) {
      navigator.share?.({ url: shareUrl, title: "Memory shared via Weave" });
    }
  } catch {
    // User cancelled or API unavailable — silent
  }
};
```

The "Pick from Contacts" button only renders on devices where `contactsApiAvailable` is true (iOS Safari). On all other devices, the email input is the only path — which is correct and complete.

**Native Share enhancement**: Currently `navigator.share()` only triggers when 0 recipients. We also add a "Share via…" button on Step 3's success screen (after the link is generated) — this lets the user share the link via Messages, WhatsApp, etc. at any time.

---

## Secret Required First

Before implementing the email feature, `RESEND_API_KEY` must be added as a Supabase secret. The plan will:
1. Prompt for the secret (via tool)
2. Update the edge function
3. Update the modal

If `RESEND_API_KEY` is not set, the email sending block is skipped gracefully — the share link is still always generated.

---

## What Will Work After This Fix

- "Share memory" button on Step 3 always generates and shows a link
- If recipients are added + Resend is configured: each recipient gets an email with the link
- On iOS Safari: "Pick from Contacts" button lets user select contacts; email addresses are auto-added as recipients; phone-only contacts trigger the native share sheet
- On desktop/Android: email input works as before; "Share via…" button on success screen triggers Web Share API as fallback
- The link always uses the canonical `/s/<token>` format
