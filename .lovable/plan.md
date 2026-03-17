

## Problem

The auto-bookmark logic at lines 277 and 591 depends on `parsed.isComplete` — a field set by the AI model. Even when the AI returns both a valid `name` and `address`, it sometimes sets `isComplete: false`, causing restaurants with complete info to fall through to the "pending" (Needs Your Input) queue.

## Fix — 1 file

**`supabase/functions/restaurant-bookmark-sync/index.ts`**

In both the `process-new-memory` handler (line 277) and the `manual-sync` handler (line 591), remove the `parsed.isComplete` check. Instead, derive completeness from `parsed.name && parsed.address` directly:

- **Line 277**: Change `if (parsed.isComplete && parsed.name && parsed.address)` to `if (parsed.name && parsed.address)`
- **Line 591**: Change `if (parsed.isComplete && parsed.name && parsed.address && integration?.composio_connection_id)` to `if (parsed.name && parsed.address && integration?.composio_connection_id)`

This ensures any restaurant with both name and address is automatically looked up on Google Maps, regardless of what the AI returns for `isComplete`.

