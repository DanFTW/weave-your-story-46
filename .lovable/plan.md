
# Fix Trello Task Tracker: Board Loading & Trigger Configuration

## Problem Diagnosis

The screenshot shows a runtime error: `Edge function returned 500: {"error":"Composio API error: 400"}`. This indicates Composio is rejecting our request with a 400 Bad Request, but the actual error details are being lost.

### Root Causes Identified

| Issue | Location | Problem |
|-------|----------|---------|
| Missing `arguments` key | `get-boards` action | Composio v3 API may require `arguments: {}` even when empty |
| Error details lost | catch/throw pattern | UI sees "400" but not the actual rejection reason |
| No connection ID logging | All actions | Can't verify if `ca_*` is being used correctly |
| Silent failures | Board/list loading | Shows "no boards found" instead of real error state |

### Evidence from Code

The `get-boards` action (lines 82-91):
```typescript
body: JSON.stringify({
  connected_account_id: connectionId,
  // ❌ Missing: arguments: {}
}),
```

Compare to working `gmail-fetch-emails` (lines 86-92):
```typescript
body: JSON.stringify({
  connected_account_id: connectionId,
  arguments: {  // ✅ Has arguments key
    query: query,
    max_results: 100,
  },
}),
```

---

## Solution: Three-Part Fix

### Part 1: Add `arguments` Key to Tool Executions

Update all Composio tool execution calls to include the `arguments` key:

**`get-boards` action:**
```typescript
body: JSON.stringify({
  connected_account_id: connectionId,
  arguments: {},  // Required by Composio v3 API
}),
```

**`get-lists` action:**
```typescript
body: JSON.stringify({
  connected_account_id: connectionId,
  arguments: { idBoard: boardId },  // Already correct, keep as-is
}),
```

### Part 2: Expose Full Error Details to UI

When Composio returns 400/4xx, include the error body in the response:

```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error(`Composio ${action} error:`, response.status, errorText);
  
  // Parse error for structured details
  let errorDetails = errorText;
  try {
    const parsed = JSON.parse(errorText);
    errorDetails = parsed.message || parsed.error || errorText;
  } catch {}
  
  return new Response(JSON.stringify({ 
    error: `Failed to load boards`,
    details: errorDetails,
    composioStatus: response.status,
  }), {
    status: 200, // Return 200 so frontend can show user-friendly error
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

### Part 3: Add Connection ID Logging & Validation

Add explicit logging to verify the correct ID format is being used:

```typescript
const connectionId = integration.composio_connection_id;
console.log(`[Trello] Action: ${action}, Connection ID: ${connectionId}`);

// Validate it's a connected_account_id (ca_*) not auth_config_id (ac_*)
if (!connectionId || !connectionId.startsWith('ca_')) {
  console.error('[Trello] Invalid connection ID format:', connectionId);
  return new Response(JSON.stringify({ 
    error: "Invalid Trello connection. Please reconnect your account." 
  }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/trello-automation-triggers/index.ts` | Add `arguments: {}` to get-boards, enhance error handling, add connection ID logging |
| `src/hooks/useTrelloAutomation.ts` | Handle new error response format, show detailed error toast |
| `src/components/flows/trello-automation/BoardPicker.tsx` | Show error state with retry button when loading fails |

---

## Detailed Code Changes

### 1. Edge Function Updates (`trello-automation-triggers/index.ts`)

**Add connection ID validation after line 62:**
```typescript
const connectionId = integration.composio_connection_id;

// Validate connection ID format
if (!connectionId?.startsWith('ca_')) {
  console.error('[Trello] Invalid connection ID:', connectionId);
  return new Response(JSON.stringify({ 
    error: "Invalid Trello connection",
    details: "Connection ID must be a connected_account_id (ca_*). Please reconnect Trello." 
  }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

console.log(`[Trello] Action: ${action}, Connection ID: ${connectionId}`);
```

**Fix get-boards action (lines 82-112):**
```typescript
case "get-boards": {
  console.log(`[Trello] Fetching boards for connection: ${connectionId}`);
  
  const response = await fetch("https://backend.composio.dev/api/v3/tools/execute/TRELLO_GET_BOARDS", {
    method: "POST",
    headers: {
      "x-api-key": COMPOSIO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connected_account_id: connectionId,
      arguments: {},  // Required by Composio v3
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Trello] Get boards error ${response.status}:`, errorText);
    
    let errorDetails = "Unknown error";
    try {
      const parsed = JSON.parse(errorText);
      errorDetails = parsed.message || parsed.error || parsed.details || errorText;
    } catch {}
    
    return new Response(JSON.stringify({ 
      error: "Failed to load boards",
      details: errorDetails,
      boards: [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ... rest of handler
}
```

### 2. Hook Updates (`useTrelloAutomation.ts`)

**Update fetchBoards to handle error response (lines 103-122):**
```typescript
const fetchBoards = useCallback(async () => {
  setIsLoading(true);
  try {
    const { data, error } = await supabase.functions.invoke('trello-automation-triggers', {
      body: { action: 'get-boards' },
    });

    if (error) throw error;
    
    // Check for error in response body (our new format)
    if (data.error) {
      console.error('Board loading error:', data.details);
      toast({
        title: "Failed to load boards",
        description: data.details || data.error,
        variant: "destructive",
      });
      setBoards([]);
      return;
    }
    
    setBoards(data.boards || []);
  } catch (error) {
    console.error('Failed to fetch boards:', error);
    toast({
      title: "Failed to fetch boards",
      description: "Could not load your Trello boards. Please try again.",
      variant: "destructive",
    });
  } finally {
    setIsLoading(false);
  }
}, [toast]);
```

### 3. BoardPicker UI Updates

Add error state display:
```typescript
// Show error state if boards is explicitly empty after loading
if (!isLoading && boards.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
      <p className="text-foreground font-medium mb-2">Failed to load boards</p>
      <p className="text-muted-foreground text-sm text-center mb-4">
        Could not connect to Trello. This may be a temporary issue.
      </p>
      <Button onClick={onRefresh} disabled={isLoading}>
        <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
        Try Again
      </Button>
    </div>
  );
}
```

---

## Expected Outcome

After implementation:

1. **Visible errors**: When Composio returns 400, users see the actual reason (e.g., "Token expired", "Permission denied") instead of generic "no boards found"

2. **Connection validation**: Invalid `ca_*` IDs are caught early with clear messaging

3. **Successful board loading**: With `arguments: {}` added, Composio v3 API should accept the request

4. **Debuggable logs**: Edge function logs will show the exact connection ID being used, making it easy to verify the correct account is being accessed

---

## Technical Notes

### Why `arguments: {}` Matters

The Composio v3 API tool execution endpoint expects a consistent request shape:
```json
{
  "connected_account_id": "ca_xxx",
  "arguments": { ... }
}
```

Even when a tool has no required parameters (like `TRELLO_GET_BOARDS`), the `arguments` key should be present. This aligns with how other working integrations (Gmail, HubSpot) structure their requests.

### Trigger Configuration Verification

The trigger upsert calls (lines 171-224) already use the correct format with `connected_account_id`. Once board loading is fixed, trigger creation should work. The triggers use:
- `TRELLO_NEW_CARD_TRIGGER` - fires when any card is created on the board
- `TRELLO_UPDATED_CARD_TRIGGER` - fires when any card is updated (used to detect moves to Done list)
