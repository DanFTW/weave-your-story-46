

## Fix: Add Intent Guard Key for Gmail OAuth in Weekly Event Finder Flow

### Problem
`WeeklyEventFinderFlow` sets `returnAfterGmailConnect` (line 79) but never sets `gmailConnectIntent`. The intent guard in `IntegrationDetail.tsx` clears the return path on mount when the intent key is missing, stranding the user on the integrations page.

### Fix: `src/components/flows/weekly-event-finder/WeeklyEventFinderFlow.tsx`

**Line 79** — Add the intent key before navigating:
```typescript
sessionStorage.setItem("gmailConnectIntent", "weekly-event-finder");
sessionStorage.setItem("returnAfterGmailConnect", "/flow/weekly-event-finder");
navigate("/integration/gmail");
```

**`handleBack` (line 86)** — Clean up stale keys on deliberate exit:
```typescript
const handleBack = () => {
  sessionStorage.removeItem("returnAfterGmailConnect");
  sessionStorage.removeItem("gmailConnectIntent");
  navigate("/threads");
};
```

### Files
- `src/components/flows/weekly-event-finder/WeeklyEventFinderFlow.tsx` — two edits only

