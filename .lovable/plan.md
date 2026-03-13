

## Rename "Slack Channel Monitor" → "Slack Message Monitor"

Seven files contain the string "Slack Channel Monitor" (or related "channel monitor/monitoring" text). Each instance will be updated:

| File | Change |
|------|--------|
| `src/data/threads.ts` | `title: "Slack Message Monitor"`, update `description` to say "messages" not "channel" |
| `src/data/threadConfigs.ts` | `title`, `subtitle`, `description` — replace "Channel" with "Message" references |
| `src/data/flowConfigs.ts` | `title`, `subtitle`, `description` — same |
| `src/components/flows/slack-messages-sync/SlackMessagesSyncFlow.tsx` | Header h1 text |
| `src/components/flows/slack-messages-sync/ActiveMonitoring.tsx` | Header h1 text |
| `src/components/flows/slack-messages-sync/ActivatingScreen.tsx` | h2 text |
| `src/hooks/useSlackMessagesSync.ts` | Toast message: "Slack channel monitoring" → "Slack message monitoring" |

All changes are simple string replacements. No structural or design changes.

