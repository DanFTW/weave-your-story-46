

## Multi-item inputs for sender emails and keywords in AlertConfig

### Problem
The sender filter and keyword filter fields are plain text inputs that accept only a single comma-separated string. Users should be able to add and remove individual items, matching the multitext chip pattern used in `FlowEntryForm`.

### Solution
Refactor both fields in `AlertConfig.tsx` to use the same add/remove chip pattern from `FlowEntryForm`:
- Items displayed as removable pills (`rounded-full bg-primary/10 text-primary`)
- Text input + "+" button to add items
- Enter key to add
- X button on each pill to remove
- Store items as arrays internally, join with `|||` delimiter when passing to `onUpdateConfig`

### Changes

**`src/components/flows/email-text-alert/AlertConfig.tsx`** (only file changed)

1. Replace `senderFilter` string state with `senders: string[]` array (parsed from `config.senderFilter` split on `|||` or `,`)
2. Replace `keywordFilter` string state with `keywords: string[]` array (same parsing)
3. Add `senderInput` and `keywordInput` string states for the text inputs
4. Add helper functions: `addSender`, `removeSender`, `addKeyword`, `removeKeyword`
5. Replace the sender `<input>` with:
   - Chip list showing each sender as a removable pill
   - Input + Plus button row (matching FlowEntryForm multitext style)
6. Replace the keyword `<input>` with the same chip + input pattern
7. Update `canActivate` to check `senders.length > 0 || keywords.length > 0`
8. Update `handleActivate` to join arrays with `|||` before calling `onUpdateConfig`
9. Import `X`, `Plus` from lucide-react and `Button` from `@/components/ui/button`

Phone number remains a single text input — no change needed there.

