

# Revamp Thread Cards to Weave Alpha Design (with Badges)

## Overview

Redesign the thread cards on `/threads` to match the Figma screenshot while keeping the Auto/Manual and Thread/Flow/Dump badges visible on each card.

## Layout (New Card Anatomy)

```text
+-----------------------------------------------+
| [48px icon]              [Auto] [Thread]       |
|                                                |
|         (decorative blurred gradient orb)       |
|                                                |
| Large Bold Title (28px)          [Try it btn]  |
+-----------------------------------------------+
  rounded-[36px], height: 170px, overflow: hidden
```

Key differences from previous plan:
- Badges stay -- moved to the **top-right** corner (replacing the "Try it" button position from Figma)
- "Try it" button moves to **bottom-right**, next to the title row
- Integration icon remains **top-left** at 48x48

## Files to Change

### 1. `src/components/ThreadCard.tsx` -- Full Redesign

**Remove:**
- Description text
- ChevronRight arrow button
- Bottom integration icons row
- Gradient overlay div

**New structure:**
```text
<button> (card container)
  <!-- Decorative orb (absolute, behind content) -->
  <div absolute, w-[338px] h-[338px], rotate(-39deg), blur(50px), border-radius: 9999px>
    <div inner gradient circle />
  </div>

  <!-- Content (relative, z-10, flex-col justify-between, full height) -->

  <!-- Top row: icon + badges -->
  <div flex justify-between>
    <IntegrationIcon 48x48 or thread.icon />
    <div flex gap-1.5>
      <ThreadTypeBadge triggerType />
      <ThreadTypeBadge flowMode />
    </div>
  </div>

  <!-- Bottom row: title + "Try it" button -->
  <div flex justify-between items-end>
    <h3 text-[28px] font-bold text-white>{title}</h3>
    <div bg-[#292C39] rounded-xl px-3 py-3>Try it</div>
  </div>
</button>
```

**Card styling:**
- `rounded-[36px]`, `h-[170px]`, `overflow-hidden`
- Padding: `pt-5 pb-6 pl-5 pr-3` (matches Figma's 20/24/20/12)
- Keep existing dynamic gradient logic for background colors
- Orb colors: a lighter/complementary shade per card, defined in a color map

**Orb color map** (new constant, per integration or gradient fallback):

| Key           | Card BG   | Orb Color | Orb Inner Gradient         |
|---------------|-----------|-----------|----------------------------|
| twitter       | #3B82F6   | #2EAFFF   | #3CC8FF -> #D3F3FF         |
| instagram     | #1ECF93   | #5EEDB8   | #7AFFD0 -> #D0FFF0         |
| gmail         | #16BC9A   | #3DE0BB   | #5AEAC8 -> #C8FFF0         |
| youtube       | #00D4D4   | #40E8E8   | #6AF0F0 -> #D0FCFC         |
| linkedin      | #F5993D   | #FFBE6B   | #FFD08A -> #FFE8C4         |
| hubspot       | #0085A6   | #2EB8D8   | #50CCE5 -> #C4F0FA         |
| trello        | #CCAD00   | #E8D040   | #F0DC60 -> #FFF8C4         |
| googlephotos  | #BC7A0B   | #E0A030   | #F0B850 -> #FFE8B0         |
| fireflies     | #6C3AED   | #9B6FE0   | #A87FE8 -> #D4C0F9         |
| discord       | #99AAF5   | #B0C0FF   | #C4D0FF -> #E8ECFF         |
| blue (fallback)| #437CFB  | #2EAFFF   | #3CC8FF -> #D3F3FF         |
| teal          | #2A8B7A   | #3DAA96   | #50C0AC -> #C0F0E4         |
| purple        | #7B4FC7   | #9B6FE0   | #A87FE8 -> #D4C0F9         |
| orange        | #E87A3D   | #F5A040   | #FFBE6B -> #FFE0B2         |
| pink          | #D94FA0   | #E87AB8   | #F098CC -> #FFD4E8         |

### 2. `src/pages/Threads.tsx` -- Simplify Layout

- Remove `subtitle` prop from `PageHeader` (Figma just shows "Threads")
- Remove `ThreadFilterBar` from render (keep imports/state for later)
- Change card gap from `space-y-3` to `gap-2` (8px, matching Figma)

### 3. No other files change

`ThreadTypeBadge`, `ThreadFilterBar`, `IntegrationIcon`, thread data, types -- all untouched.

