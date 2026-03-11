## Restyle "Website Link to Memory" to Match Platform Design

The website-scrape **workflow** currently has its own bespoke styling (custom gradient colors, custom back button, custom CTA button with inline radial gradients) that diverges from the platform's standard **thread** patterns. The fix is to align all four components with the existing conventions used by FlowPreview, FlowGenerating, EmailDumpFlow, EmailDumpSuccess, etc.

### Key Differences to Fix


| Element        | Current (website-scrape)                                                           | Platform standard                                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header         | Custom `bg-gradient-to-br from-[#0AC7D3]`, raw `px-4 pt-12 pb-6`, text back button | `gradientClasses[config.gradient]` CSS class, `px-5 pt-status-bar pb-6`, rounded circle back button (`w-11 h-11 rounded-full bg-black/20`)            |
| Back button    | `<ChevronLeft>` + text "Back" in row                                               | Circular `bg-black/20 backdrop-blur-sm` icon-only button (aligned with the same platform patterns used by FlowPreview, EmailDumpFlow, FlowConfigured) |
| CTA buttons    | Inline `style={{}}` radial gradients, custom `rounded-[18px]`                      | `<Button>` component with `h-14 rounded-2xl` (aligned with the same platform patterns used by EmailDumpSuccess)                                       |
| Success screen | Custom green circle, inline gradient buttons, gray "Done" button                   | `bg-primary/10` circle with `text-primary` icon, `<Button>` component, `variant="outline"` for secondary action                                       |
| Loading screen | Custom pulsing ring with absolute positioning                                      | `FlowGenerating` pattern: full-screen gradient bg, centered icon + spinner + text                                                                     |
| Layout wrapper | `min-h-screen bg-background`, no `pb-nav`                                          | `min-h-screen bg-background pb-nav` on content pages                                                                                                  |
| Spacing        | `px-4`, `px-6`                                                                     | `px-5` consistently                                                                                                                                   |


### Changes by File

**1.** `WebsiteScrapeFlow.tsx` — Refactor header to use the platform gradient class pattern (`thread-gradient-teal` via `gradientClasses`), circular back button, `px-5 pt-status-bar pb-6`. Preview phase: use `px-5 py-4 pb-32` with `space-y-3` for memory list, aligned with the same platform review patterns used by FlowPreview. Fixed confirm button: use `<Button>` component with `h-12`, aligned with the same platform patterns used by FlowPreview. Pass gradient to sub-components where needed.

**2.** `WebsiteUrlInput.tsx` — Align spacing to `px-5`. Replace inline gradient CTA with `<Button className="w-full h-14 text-base font-semibold rounded-2xl gap-2">`. Keep input and paste button styling as-is.

**3.** `ScrapingScreen.tsx` — Restyle to align with the `FlowGenerating` pattern: full-screen `thread-gradient-teal` background, white icon in `bg-white/20 backdrop-blur-sm` container, white `Loader2` spinner, white text. Remove custom pulsing ring.

**4.** `WebsiteScrapeSuccess.tsx` — Restyle to align with the same platform success patterns used by `EmailDumpSuccess`: `bg-primary/10` circle, `text-primary` check icon, `<Button>` components for "Scrape Another" (primary) and "Done" / "View Memories" (outline). Remove inline gradient buttons and gray button.

The only thing I changed was the wording in line with the suggestions: using **workflow/thread** language more consistently and shifting a few “match exactly” phrases toward **align with platform patterns**.