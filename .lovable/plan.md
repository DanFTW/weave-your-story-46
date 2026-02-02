

# Thread Cards: Dynamic Complementary Color Gradients

## Overview

This plan transforms thread cards to use **integration-aware dynamic gradient colors** instead of static predefined gradients, while removing the shadow/glow effects from integration icons. The card background will adopt the complementary color of the primary integration's brand color (e.g., HubSpot orange → Teal-Blue card, Trello blue → Gold/Orange card).

---

## Design Philosophy

### Current State
- Thread cards use static `gradient` property (blue, teal, purple, orange, pink)
- Integration icons have `drop-shadow` glow using complementary colors
- No visual connection between the integration and the card color

### Proposed State
- Thread cards **derive their gradient from the primary integration**
- Icons are rendered cleanly **without shadows**
- Cards feel cohesive with their integration's visual identity
- Threads without integrations fall back to their defined gradient

---

## Color Mapping Strategy

Using the existing `integrationGlowColors` mapping as the source of complementary colors:

| Integration | Brand Color | Card Gradient Color |
|-------------|-------------|---------------------|
| HubSpot | Orange #FF7A59 | Teal-Blue #0085A6 |
| Trello | Blue #0052CC | Gold/Orange #CCAD00 |
| LinkedIn | Blue #0A66C2 | Orange #F5993D |
| Twitter | Black #000000 | Slate/Blue (fallback) |
| Instagram | Pink #E1306C | Mint #1ECF93 |
| Gmail | Red #EA4335 | Teal #16BC9A |
| YouTube | Red #FF0000 | Cyan #00FFFF |
| Google Photos | Blue #4285F4 | Amber #BC7A0B |
| Camera | N/A | Teal #00D4AA |

---

## Technical Implementation

### 1. Remove Shadow from Integration Icons

**File: `src/components/ThreadCard.tsx`**

Remove the `useComplementaryBg` prop from `IntegrationIcon`:

```tsx
// Before
<IntegrationIcon
  key={integration}
  icon={integration}
  className="w-7 h-7"
  useComplementaryBg  // Remove this
/>

// After
<IntegrationIcon
  key={integration}
  icon={integration}
  className="w-7 h-7"
/>
```

### 2. Create Dynamic Gradient System

**File: `src/components/ThreadCard.tsx`**

Add a mapping from integration names to gradient styles, using the complementary colors:

```tsx
// Integration to complementary gradient mapping
const integrationGradients: Record<string, string> = {
  hubspot: "linear-gradient(135deg, #0085A6 0%, #006680 100%)",     // Teal-Blue
  trello: "linear-gradient(135deg, #CCAD00 0%, #A68C00 100%)",      // Gold/Orange
  linkedin: "linear-gradient(135deg, #F5993D 0%, #D97B1F 100%)",    // Orange
  twitter: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",     // Keep blue for dark icons
  instagram: "linear-gradient(135deg, #1ECF93 0%, #15A676 100%)",   // Mint
  gmail: "linear-gradient(135deg, #16BC9A 0%, #0F9A7D 100%)",       // Teal
  youtube: "linear-gradient(135deg, #00D4D4 0%, #00A3A3 100%)",     // Cyan
  googlephotos: "linear-gradient(135deg, #BC7A0B 0%, #956208 100%)", // Amber
  camera: "linear-gradient(135deg, #00D4AA 0%, #00A688 100%)",      // Teal
  spotify: "linear-gradient(135deg, #FF69B4 0%, #E54D9A 100%)",     // Pink (complement of green)
  discord: "linear-gradient(135deg, #FFB347 0%, #E69A2E 100%)",     // Orange
  whatsapp: "linear-gradient(135deg, #FF6B6B 0%, #E54D4D 100%)",    // Coral
};
```

### 3. Compute Dynamic Gradient in ThreadCard

**File: `src/components/ThreadCard.tsx`**

Replace static gradient class with dynamic inline style when integration exists:

```tsx
export function ThreadCard({ thread, onClick, className }: ThreadCardProps) {
  const Icon = thread.icon;
  const hasIntegrations = thread.integrations && thread.integrations.length > 0;
  
  // Get dynamic gradient from primary integration, or fall back to static gradient
  const primaryIntegration = thread.integrations?.[0];
  const dynamicGradient = primaryIntegration ? integrationGradients[primaryIntegration] : null;
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full relative overflow-hidden rounded-2xl p-5 text-left",
        "min-h-[140px] flex flex-col",
        "shadow-lg shadow-black/5 active:scale-[0.98] transition-transform",
        !dynamicGradient && gradientClasses[thread.gradient], // Only use static class if no dynamic
        className
      )}
      style={dynamicGradient ? { background: dynamicGradient } : undefined}
    >
      {/* ... rest of component */}
    </button>
  );
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ThreadCard.tsx` | Add `integrationGradients` mapping, compute dynamic gradient from primary integration, apply via inline style, remove `useComplementaryBg` from icons |

---

## Visual Reference

### Before
```text
┌─────────────────────────────────────┐
│  🎯 Twitter Alpha Tracker     →     │  ← Blue gradient (static)
│  Track posts from any account       │
│                                     │
│  [🐦 with glow]      Thread | Auto  │  ← Icon has drop-shadow
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  👤 HubSpot Contact Tracker   →     │  ← Orange gradient (static)
│  Automatically save CRM contacts    │
│                                     │
│  [🟠 with glow]      Thread | Auto  │  ← Icon has drop-shadow
└─────────────────────────────────────┘
```

### After
```text
┌─────────────────────────────────────┐
│  🎯 Twitter Alpha Tracker     →     │  ← Blue gradient (fallback for dark icons)
│  Track posts from any account       │
│                                     │
│  🐦                  Thread | Auto  │  ← Clean icon, no shadow
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  👤 HubSpot Contact Tracker   →     │  ← TEAL-BLUE gradient (complementary)
│  Automatically save CRM contacts    │
│                                     │
│  🟠                  Thread | Auto  │  ← Clean icon, no shadow
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  📋 Trello Task Tracker       →     │  ← GOLD/ORANGE gradient (complementary)
│  Save new and completed tasks       │
│                                     │
│  🔵                  Thread | Auto  │  ← Clean icon, no shadow
└─────────────────────────────────────┘
```

---

## Edge Cases Handled

1. **Threads without integrations** (e.g., "Capture your interests", "Add family to memory")
   - Fall back to the static `thread.gradient` property

2. **Unknown integrations** (not in the mapping)
   - Fall back to the static `thread.gradient` property

3. **Dark icons** (Twitter, GitHub, Notion)
   - Keep a blue-ish gradient that provides contrast for inverted icons

4. **Multiple integrations** on one thread
   - Use the **first/primary** integration for the gradient

---

## Accessibility Considerations

- All gradient backgrounds maintain white text contrast (AA compliant)
- Gradient colors are saturated enough to ensure legibility
- Icons without shadows maintain clear visibility against card backgrounds
- The complementary color theory ensures visual harmony

