
# Fix HubSpot Contact Tracker - 500 Error Resolution

## Problem Analysis

The HubSpot Contact Tracker fails with a **500 Internal Server Error** when activating monitoring via the Composio API.

| Current Code | Issue |
|--------------|-------|
| `trigger_config: {}` | May be missing required fields |
| No error details logged | Can't see exact Composio error message |
| No config schema validation | Blindly sending empty config |

## Root Cause

The `HUBSPOT_CONTACT_CREATED_TRIGGER` likely requires specific `trigger_config` parameters that we're not providing. Each Composio trigger type has a schema defining required configuration fields.

## Solution: Query Trigger Schema + Enhanced Error Handling

### Technical Changes

**File: `supabase/functions/hubspot-automation-triggers/index.ts`**

1. **Query trigger type schema first** to understand required config
2. **Log the full Composio error response** for debugging
3. **Handle the trigger response parsing correctly** (extract `trigger_id` from proper path)
4. **Add retry logic** with exponential backoff if needed

### Implementation Details

**Change 1: Add debug logging for Composio response**

Before creating the trigger, log the attempt details:
```typescript
console.log(`[HubSpot Triggers] Creating trigger...`);
console.log(`[HubSpot Triggers] Connection ID: ${connectionId}`);
console.log(`[HubSpot Triggers] Webhook URL: ${webhookUrl}`);
```

**Change 2: Parse and log full error response**

When Composio returns an error, parse the response body to get the actual error message:
```typescript
if (!triggerResponse.ok) {
  console.error(`[HubSpot Triggers] Composio error response: ${triggerText}`);
  // Parse error to see required fields
  try {
    const errorData = JSON.parse(triggerText);
    console.error(`[HubSpot Triggers] Error details:`, JSON.stringify(errorData, null, 2));
  } catch {}
  return new Response(
    JSON.stringify({ error: "Failed to create trigger", details: triggerText }),
    { status: 500, headers: corsHeaders }
  );
}
```

**Change 3: Extract trigger_id from correct response path**

The Composio v3 API returns trigger_id at the root level:
```typescript
const triggerData = JSON.parse(triggerText);
const triggerId = triggerData?.trigger_id || triggerData?.id;
```

**Change 4: Add trigger type config discovery (optional)**

Add a preliminary call to understand what config is required:
```typescript
// Discover trigger config requirements
const typeResponse = await fetch(
  "https://backend.composio.dev/api/v3/triggers_types/HUBSPOT_CONTACT_CREATED_TRIGGER",
  {
    method: "GET",
    headers: { "x-api-key": COMPOSIO_API_KEY },
  }
);
const typeData = await typeResponse.json();
console.log(`[HubSpot Triggers] Required config:`, JSON.stringify(typeData?.config));
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/hubspot-automation-triggers/index.ts` | Enhanced logging, proper trigger_id extraction, discover config requirements |

---

## Detailed Code Changes

### hubspot-automation-triggers/index.ts

**Lines ~66-120 (activate action):**

```typescript
if (action === "activate") {
  const webhookUrl = `${SUPABASE_URL}/functions/v1/hubspot-automation-webhook`;

  console.log(`[HubSpot Triggers] Attempting to create trigger...`);
  console.log(`[HubSpot Triggers] Connection ID: ${connectionId}`);
  console.log(`[HubSpot Triggers] Webhook URL: ${webhookUrl}`);

  // First, query what config is required for this trigger
  const typeResponse = await fetch(
    "https://backend.composio.dev/api/v3/triggers_types/HUBSPOT_CONTACT_CREATED_TRIGGER",
    {
      method: "GET",
      headers: { "x-api-key": COMPOSIO_API_KEY },
    }
  );
  
  if (typeResponse.ok) {
    const typeData = await typeResponse.json();
    console.log(`[HubSpot Triggers] Trigger type config schema:`, JSON.stringify(typeData?.config));
  }

  // Create the trigger
  const triggerResponse = await fetch(
    "https://backend.composio.dev/api/v3/trigger_instances/HUBSPOT_CONTACT_CREATED_TRIGGER/upsert",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": COMPOSIO_API_KEY,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        trigger_config: {},
        webhook_url: webhookUrl,
      }),
    }
  );

  const triggerText = await triggerResponse.text();
  console.log(`[HubSpot Triggers] Composio response status: ${triggerResponse.status}`);
  console.log(`[HubSpot Triggers] Composio response body: ${triggerText}`);

  if (!triggerResponse.ok) {
    // Log detailed error for debugging
    let errorDetails = triggerText;
    try {
      const errorJson = JSON.parse(triggerText);
      console.error(`[HubSpot Triggers] Parsed error:`, JSON.stringify(errorJson, null, 2));
      // Check if there's a specific field indicating required config
      if (errorJson.errors || errorJson.details) {
        errorDetails = JSON.stringify(errorJson.errors || errorJson.details);
      }
    } catch {}
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to create trigger", 
        details: errorDetails,
        status: triggerResponse.status
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Parse successful response
  let triggerData;
  try {
    triggerData = JSON.parse(triggerText);
  } catch {
    triggerData = {};
  }

  // Extract trigger_id - Composio v3 returns it at root level
  const triggerId = triggerData?.trigger_id || triggerData?.id || null;
  console.log(`[HubSpot Triggers] Created trigger ID: ${triggerId}`);

  // Update config with trigger ID and set active
  const { error: updateError } = await supabaseClient
    .from("hubspot_automation_config")
    .update({
      is_active: true,
      trigger_id: triggerId,
    })
    .eq("user_id", userId);

  if (updateError) {
    console.error("[HubSpot Triggers] Failed to update config:", updateError);
  }

  return new Response(
    JSON.stringify({ success: true, triggerId }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

---

## Deactivate Action Fix

Also fix the deactivate endpoint URL which is incorrect:

**Current (Wrong):**
```typescript
`https://backend.composio.dev/api/v3/trigger_instances/${config.trigger_id}`
```

**Correct:**
```typescript
`https://backend.composio.dev/api/v3/trigger_instances/manage/${config.trigger_id}`
```

---

## Expected Behavior After Fix

1. **Detailed Logging**: Edge function logs will show the exact Composio error response
2. **Config Discovery**: Will log what trigger_config fields are required
3. **Proper Response Parsing**: Correctly extract trigger_id from Composio response
4. **Actionable Errors**: Frontend will show specific error details, not generic "500"

---

## Verification Steps

1. Deploy updated edge function
2. Navigate to `/flow/hubspot-tracker`
3. Click "Activate Monitoring"
4. Check edge function logs for:
   - Trigger type config schema
   - Full Composio error response (if any)
   - Created trigger ID (if successful)
5. If still failing, the logs will show exactly what config is required
