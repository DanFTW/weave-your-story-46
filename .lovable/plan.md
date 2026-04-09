

## Fix: Google Sheets Append Silently Failing

### Root Cause
The `appendToSheet` function (line 190-227) only checks `res.ok` (HTTP status) but never reads or inspects the response body. Composio v3 is known to return `200 OK` even when the actual operation fails (e.g., permission denied, wrong sheet name, expired token). The logs confirm the function executes — `[ReceiptSheet] Appended 1 rows to sheet` — but since the response body is never checked, logical failures are invisible.

### Fix: `supabase/functions/email-receipt-sheet/index.ts`

Update `appendToSheet` (lines 190-227) to:

1. Read and log the full Composio response body on both success and failure paths
2. Check the `successful` flag in the response (Composio v3 pattern) — if `successful === false` or an `error` key exists, treat it as a failure and log the details
3. Return `false` when the logical operation failed, even if HTTP was 200

```typescript
async function appendToSheet(
  connectionId: string,
  spreadsheetId: string,
  rows: string[][],
): Promise<boolean> {
  try {
    const res = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/GOOGLESHEETS_BATCH_UPDATE",
      { /* same request as today */ },
    );

    const responseText = await res.text();
    console.log(`[ReceiptSheet] BATCH_UPDATE response status=${res.status}, body=${responseText.slice(0, 1000)}`);

    if (!res.ok) {
      console.error(`[ReceiptSheet] BATCH_UPDATE HTTP error ${res.status}:`, responseText);
      return false;
    }

    // Composio v3 can return 200 with a logical failure
    try {
      const responseData = JSON.parse(responseText);
      if (responseData?.successful === false || responseData?.error) {
        console.error(`[ReceiptSheet] BATCH_UPDATE logical failure:`, responseText.slice(0, 500));
        return false;
      }
    } catch { /* non-JSON 200 — treat as success */ }

    console.log(`[ReceiptSheet] Appended ${rows.length} rows to sheet`);
    return true;
  } catch (e) {
    console.error("[ReceiptSheet] Append error:", e);
    return false;
  }
}
```

### Files
- `supabase/functions/email-receipt-sheet/index.ts` — `appendToSheet` function only

### What this reveals
After deploying, the next manual sync will log the actual Composio response body. If it contains `successful: false` or an error message, we'll see exactly why rows aren't landing in the sheet (wrong spreadsheet ID, permission issue, expired token, etc.) and can fix the root cause.

