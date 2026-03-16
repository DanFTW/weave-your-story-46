

## Problem

All three Twitter flow components navigate to `/integration/twitter` when the user isn't connected, but **none of them set a `returnAfterTwitterConnect` sessionStorage key** before navigating. This is the established pattern used by every other integration flow (Instagram, Slack, Gmail, etc.) to redirect back after OAuth completes.

The `IntegrationDetail` page (line 52-67) checks for `returnAfter{Integration}Connect` in sessionStorage after connection succeeds, and navigates back to the stored path. Without this key, the user is stranded on `/integration/twitter`.

## Fix

Three files need one line added each before their `navigate('/integration/twitter')` call:

### 1. `src/components/flows/twitter-sync/TwitterSyncFlow.tsx` (line ~57)
Add `sessionStorage.setItem('returnAfterTwitterConnect', '/flow/twitter-sync');` before `navigate('/integration/twitter')`.

### 2. `src/components/flows/twitter-automation/TwitterAutomationFlow.tsx` (line ~56)
Add `sessionStorage.setItem('returnAfterTwitterConnect', '/flow/twitter-live');` before `navigate('/integration/twitter')`.

### 3. `src/hooks/useTwitterAlphaTracker.ts` (line ~53)
Add `sessionStorage.setItem('returnAfterTwitterConnect', '/flow/twitter-alpha-tracker');` before `navigate('/integration/twitter')`.

This matches the exact pattern used by all other flows (e.g., Instagram, Slack, Gmail, Trello, Discord, etc.).

