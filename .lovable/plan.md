

# Fix: "Get Started" button not navigating for email-receipt-sheet

## Root Cause
In `src/pages/ThreadOverview.tsx` line 36, the `flowEnabledThreads` array does not include `"email-receipt-sheet"`. When clicked, it falls into the `else` branch which only logs to console instead of navigating.

## Fix
Add `"email-receipt-sheet"` to the `flowEnabledThreads` array in `handleGetStarted()` (line 36).

One line change, one file: `src/pages/ThreadOverview.tsx`.

