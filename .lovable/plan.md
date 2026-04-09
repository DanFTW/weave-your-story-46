

## Fix OAuth Return Flow for Email Receipt Sheet

### Root Cause
The `EmailReceiptSheetFlow` sets `returnAfterGmailConnect` and `returnAfterGooglesheetsConnect` session storage keys before navigating to the integration pages, but it never sets the corresponding **intent guard keys** (`gmailConnectIntent` and `googlesheetsConnectIntent`). 

`IntegrationDetail.tsx` (lines 54-66) checks for the intent key on mount — if it's missing, it assumes the user arrived independently and **clears the return path**. So the redirect back to the flow is wiped before it can be used.

The Spotify Music Finder flow demonstrates the correct pattern: it sets both the intent key and the return path before navigating.

### Fix: `src/components/flows/email-receipt-sheet/EmailReceiptSheetFlow.tsx`

**In the Gmail auth effect (line 56-58)** — add the intent key before navigating:
```typescript
sessionStorage.setItem("gmailConnectIntent", "email-receipt-sheet");
sessionStorage.setItem("returnAfterGmailConnect", "/flow/email-receipt-sheet");
navigate("/integration/gmail");
```

**In the Sheets auth effect (line 67-69)** — add the intent key before navigating:
```typescript
sessionStorage.setItem("googlesheetsConnectIntent", "email-receipt-sheet");
sessionStorage.setItem("returnAfterGooglesheetsConnect", "/flow/email-receipt-sheet");
navigate("/integration/googlesheets");
```

**When both are connected (line 64-66)** — clean up any stale keys (matching the Spotify pattern):
```typescript
sessionStorage.removeItem("returnAfterGmailConnect");
sessionStorage.removeItem("gmailConnectIntent");
sessionStorage.removeItem("returnAfterGooglesheetsConnect");
sessionStorage.removeItem("googlesheetsConnectIntent");
loadConfig();
loadExpenses();
```

**In `handleBack` (line 73)** — clean up on deliberate exit:
```typescript
const handleBack = () => {
  sessionStorage.removeItem("returnAfterGmailConnect");
  sessionStorage.removeItem("gmailConnectIntent");
  sessionStorage.removeItem("returnAfterGooglesheetsConnect");
  sessionStorage.removeItem("googlesheetsConnectIntent");
  navigate("/threads");
};
```

### Files
- `src/components/flows/email-receipt-sheet/EmailReceiptSheetFlow.tsx` — add intent keys, clean up stale keys

### Result
Gmail OAuth completes → IntegrationDetail finds intent key → honors return path → flow resumes → detects Gmail connected → sets Sheets intent → Sheets OAuth → returns → both connected → config screen. No integrations page detour.

