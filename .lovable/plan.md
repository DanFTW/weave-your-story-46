

## Fix: Add Intent Guard Key for Gmail OAuth in Email Text Alert Flow

### Problem
`EmailTextAlertFlow` sets `returnAfterGmailConnect` but not `gmailConnectIntent`. The intent guard in `IntegrationDetail.tsx` clears the return path on mount when the intent key is missing, so the user lands on `/integrations` instead of returning to the flow.

### Fix: `src/components/flows/email-text-alert/EmailTextAlertFlow.tsx`

**Line 43-45** — Add the intent key before navigating:
```typescript
sessionStorage.setItem("gmailConnectIntent", "email-text-alert");
sessionStorage.setItem("returnAfterGmailConnect", "/flow/email-text-alert");
navigate("/integration/gmail");
```

**Line 49** — Clean up stale keys on deliberate exit:
```typescript
const handleBack = () => {
  sessionStorage.removeItem("returnAfterGmailConnect");
  sessionStorage.removeItem("gmailConnectIntent");
  navigate("/threads");
};
```

### Files
- `src/components/flows/email-text-alert/EmailTextAlertFlow.tsx` — two edits only

