# Language Builder — DESIGN.md

> **Palette section superseded.** The 12-tell anti-slop audit below is live
> guidance and `globals.css` cites it. The COLOUR values are from the pre-rebrand
> palette and no longer apply — take colours from `src/app/styles/globals.css`.


> Design token specification for Language Builder.
> Consumed by: all design and engineering agents working on this product.
> Last updated: 2026-07-24.

## Philosophy

Language Builder is a Quranic Arabic learning app for self-hosted use. The design must serve **serious study**, not engagement. Every visual choice should make the user feel focused, not distracted.

Core principles:
- **Clarity over decoration.** No gradients, no glassmorphism, no icon-toppers.
- **Arabic text is sacred.** Generous line-height, proper fonts, proper spacing.
- **Progress is visible.** Users need to see where they are and where to go next.
- **Dark mode, always.** Study sessions are long; this is gentler on the eyes.
- **Mobile-first, desktop-optimized.** Most use will be on a phone during commute; most focused study will be on desktop.

---

## Color Tokens

### Primary — Arabic Green (`#22c55e`)
Islamic art reference. Green is culturally resonant without being heavy-handed. Used for: primary actions, progress indicators, success states, active navigation.

| Token | Value | Usage |
|-------|-------|-------|
| `color.primary.50` | `#f0fdf4` | Subtle backgrounds |
| `color.primary.100` | `#dcfce7` | Hover fills |
| `color.primary.200` | `#bbf7d0` | Focus rings |
| `color.primary.300` | `#86efac` | Highlights |
| `color.primary.400` | `#4ade80` | Interactive hover |
| `color.primary.500` | `#22c55e` | **Primary accent** |
| `color.primary.600` | `#16a34a` | Pressed state |
| `color.primary.700` | `#15803d` | Borders on hover |
| `color.primary.800` | `#166534` | Text on green bg |
| `color.primary.900` | `#14532d` | Dark green accent |

### Secondary — Gold (`#f59e0b`)
Islamic geometric art reference. Used sparingly for: highlights, warnings, achievements, special moments. Never for primary actions.

| Token | Value | Usage |
|-------|-------|-------|
| `color.secondary.50` | `#fffbeb` | Subtle backgrounds |
| `color.secondary.100` | `#fef3c7` | Hover fills |
| `color.secondary.200` | `#fde68a` | Focus rings |
| `color.secondary.300` | `#fcd34d` | Highlights |
| `color.secondary.400` | `#fbbf24` | Interactive hover |
| `color.secondary.500` | `#f59e0b` | **Secondary accent** |
| `color.secondary.600` | `#d97706` | Pressed state |
| `color.secondary.700` | `#b45309` | Borders on hover |
| `color.secondary.800` | `#92400e` | Text on gold bg |
| `color.secondary.900` | `#78350f` | Dark gold accent |

### Neutrals — Warm Gray
Chosen specifically to avoid the cold blue cast that makes dark UI feel generic. These are stone-warm, not blue-warm.

| Token | Value | Usage |
|-------|-------|-------|
| `color.gray.50` | `#fafaf9` | Light text on dark (near white) |
| `color.gray.100` | `#f5f5f4` | Headings emphasis |
| `color.gray.200` | `#e7e5e4` | Subtle borders |
| `color.gray.300` | `#d6d3d1` | Secondary borders |
| `color.gray.400` | `#a8a29e` | Muted text |
| `color.gray.500` | `#78716c` | Inactive elements |
| `color.gray.600` | `#57534e` | Disabled |
| `color.gray.700` | `#44403c` | Borders, separators |
| `color.gray.800` | `#292524` | Surface 2 (cards, inputs) |
| `color.gray.900` | `#1c1917` | Surface (default card bg) |
| `color.gray.950` | `#0c0a09` | **Page background** |

### Semantic Tokens
| Token | Value | Rationale |
|-------|-------|-----------|
| `color.success` | `var(--color-primary-500)` | Progress = green, always. No generic blue. |
| `color.warning` | `var(--color-secondary-500)` | Gold for caution, not yellow. |
| `color.error` | `#ef4444` | Standard red. Keep consistent. |
| `color.info` | `#3b82f6` | Only for informational badges, never primary. |

### Tajweed Rule Colors (Functional, Not Decorative)
These map directly to Quranic tajweed rules. Colors are assigned by convention — students learn what each color means over time.

| Token | Value | Rule |
|-------|-------|------|
| `color.tajweed.madd` | `#3b82f6` | Madd (elongation) |
| `color.tajweed.noonSaakin` | `#22c55e` | Noon Saakin / Tanween |
| `color.tajweed.meemSaakin` | `#06b6d4` | Meem Saakin |
| `color.tajweed.qalqalah` | `#f59e0b` | Qalqalah (vibration) |
| `color.tajweed.ghunnah` | `#ec4899` | Ghunnah (nasal) |
| `color.tajweed.makharijGaf` | `#8b5cf6` | Gaf articulation point |
| `color.tajweed.makharijHatif` | `#f97316` | Hatif (weak) articulation point |

### Surface Tokens (Dark Mode)
| Token | Value | Element |
|-------|-------|---------|
| `color.bg` | `var(--color-gray-950)` | Page background |
| `color.surface` | `var(--color-gray-900)` | Cards, panels |
| `color.surface.2` | `var(--color-gray-800)` | Inputs, secondary panels |
| `color.border` | `var(--color-gray-700)` | Dividers, card borders |
| `color.ink` | `var(--color-gray-50)` | Primary text |
| `color.muted` | `var(--color-gray-400)` | Secondary text, labels |

---

## Typography

### Font Families

| Family | Font | Usage | Rationale |
|--------|------|-------|-----------|
| `font.primary` | IBM Plex Sans | English body text, UI labels | Geometric, modern, highly legible at small sizes |
| `font.arabic` | Scheherazade New / Amiri | Quran text, Arabic UI | Designed specifically for Quranic script; Amiri fallback for broader support |
| `font.mono` | IBM Plex Mono | Code blocks, grammar tables | Consistent character width for parsing examples |

### Type Scale

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `text.xs` | 0.75rem (12px) | 500 | Labels, metadata, dates |
| `text.sm` | 0.875rem (14px) | 400 | Body secondary, captions |
| `text.base` | 1rem (16px) | 400 | Default body |
| `text.lg` | 1.125rem (18px) | 500 | Body emphasis |
| `text.xl` | 1.25rem (20px) | 600 | H4 |
| `text.2xl` | 1.5rem (24px) | 600 | H3 |
| `text.3xl` | 1.875rem (30px) | 700 | H2 |
| `text.4xl` | 2.25rem (36px) | 700 | H1 |
| `text.5xl` | 3rem (48px) | 700 | Hero titles |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `leading.tight` | 1.25 | Headings |
| `leading.normal` | 1.5 | English body |
| `leading.relaxed` | 1.625 | Long-form reading |
| `leading.arabic` | 2.0 | **Arabic text — non-negotiable** |

Arabic script needs more vertical space because of diacritics (tashkeel). 2.0 prevents overlap and is the minimum for readability.

### Contrast Ratios (WCAG AA)

| Combination | Ratio | Status |
|-------------|-------|--------|
| `color.ink` on `color.bg` | 15.4:1 | ✅ AAA |
| `color.muted` on `color.bg` | 5.7:1 | ✅ AA |
| `color.primary.500` on `color.bg` | 3.3:1 | ⚠️ For large text only |
| `color.primary.400` on `color.surface` | 3.8:1 | ⚠️ For large text only |
| `color.secondary.500` on `color.bg` | 2.9:1 | ⚠️ For large text only |

**Rule:** Color tokens are safe for text only when the ratio is ≥ 4.5:1. For accent colors (primary, secondary), use them as backgrounds with white text, or as borders/highlights — never as body text on dark backgrounds.

---

## Spacing

### Scale
| Token | Value | Element |
|-------|-------|---------|
| `space.1` | 0.25rem (4px) | Tight grouping |
| `space.2` | 0.5rem (8px) | Related items |
| `space.3` | 0.75rem (12px) | Item padding |
| `space.4` | 1rem (16px) | Standard gap |
| `space.5` | 1.25rem (20px) | Component gaps |
| `space.6` | 1.5rem (24px) | Card padding |
| `space.8` | 2rem (32px) | Section gaps |
| `space.10` | 2.5rem (40px) | Section padding |
| `space.12` | 3rem (48px) | Large separations |
| `space.16` | 4rem (64px) | Page margins |

### Padding Conventions
| Context | Value |
|---------|-------|
| Card content | `space.6` (24px) |
| Section padding | `space.10` (40px) |
| Page padding | `space.8` (32px) |

---

## Layout

### Grid
- **Max content width:** 1200px (main content), 640px (assessment/reading), 480px (mobile)
- **Grid columns:** 12, gap 24px
- **Sidebar:** 280px fixed, collapsible on mobile

### Shadows
| Token | Value | Usage |
|-------|-------|-------|
| `shadow.sm` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle elevation |
| `shadow.md` | `0 4px 6px rgba(0,0,0,0.4)` | Dropdowns, popovers |
| `shadow.lg` | `0 10px 15px rgba(0,0,0,0.5)` | Modals, drawers |
| `shadow.xl` | `0 20px 25px rgba(0,0,0,0.6)` | Large overlays |
| `shadow.glow` | `0 0 20px rgba(34,197,94,0.3)` | **Primary action hover only** |

The glow shadow is intentionally only for the primary action button on hover. Never use it as a card border, never on every interactive element.

### Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| `radius.sm` | 4px | Buttons, inputs |
| `radius.md` | 8px | Cards, dropdowns |
| `radius.lg` | 12px | Modals |
| `radius.xl` | 16px | Large containers |
| `radius.full` | 9999px | Pills, badges, progress fills |

---

## Motion

### Default Transition
```css
transition: all 0.2s ease;
```
All interactive elements use this unless a specific duration is needed.

### Page Transitions
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
/* Usage: 0.3s ease */
```

### Progress Bar Fill
```css
transition: width 0.5s ease;
```
Slower than UI transitions — gives a sense of real progress, not instant snap.

### Stagger (Lists)
```css
/* Each child: 0ms, 50ms, 100ms, 150ms, 200ms */
```

### Rules
- Respect `prefers-reduced-motion` — disable non-essential motion for accessibility users.
- Motion should clarify state changes, not decorate them.
- No looping animations.
- Button press: `transform: translateY(1px)` for tactility.

---

## Components

### Button
| Variant | Background | Text | Border | Hover |
|---------|-----------|------|--------|-------|
| `primary` | `color.primary.500` | white | none | `color.primary.600` + glow |
| `secondary` | `color.surface.2` | `color.ink` | `color.border` | `color.gray.700` |
| `ghost` | transparent | `color.muted` | none | `color.surface.2` bg |
| `danger` | `color.error` | white | none | `color.error` darken |

Sizes: `sm` (px-3 py-1.5), `md` (px-4 py-2), `lg` (px-6 py-3)
Min touch target: 44×44px on mobile.

### Card
```
Background: color.surface
Border: 1px solid color.border
Radius: radius.xl (16px)
Padding: space.6 (24px)
```
Interactive variant: border → primary.500 on hover, shadow-glow, translateY(-2px).

### Progress Bar
```
Container: h-2, bg-color.surface.2, radius-full
Fill: bg-color.primary.500, radius-full, transition width 0.5s
```
Always shows percentage label. Green = progress, gold = in-progress/warning.

### Badge
```
Padding: px-2.5 py-0.5
Radius: radius.full
Font: text-xs, font-medium
```
Variants: `default` (gray bg), `success` (green bg/text), `warning` (gold bg/text), `error` (red bg/text).

### Input
```
Background: color.surface.2
Border: 1px solid color.border
Radius: radius.md (8px)
Focus: ring 2px color.primary.400/50, border color.primary.500
```

### Stat Card
```
Layout: flex, items-start, justify-between
Label: text-sm, text-color.muted
Value: text-2xl, font-bold, text-color.ink
Trend: mt-3, text-sm, green if up, red if down
```

### Quiz Question
```
Container: card style
Options: full-width buttons, border gray-700, selected = green border + green bg
Feedback: explanation appears AFTER attempt, never before
```

### Empty State
```
Layout: centered, py-12
Icon: text-4xl, mb-4
Title: text-xl, font-semibold, mb-2
Description: text-color.muted, mb-6, max-w-md
Action: Button (if applicable)
```
**Every empty state MUST have an actionable suggestion.** No "no data" screens without next steps.

---

## Page Templates (by Surface Type)

### Decide/Learn Surface (Landing, Grammar Deep-Dive)
- One idea per section
- Hero correct here (large headline, single CTA)
- Editorial layout for Grammar module
- No icon-toppers

### Monitor Surface (Dashboard, Assessment Results, Analytics)
- Density and glanceability over decoration
- No hero section
- Progress bars + stat cards
- Score history charts (real data only)

### Operate Surface (Lessons, Flashcards, AI Tutor, Memorization Review)
- Action affordances dominate
- One clear next action per screen
- Content first, exercise second
- Progress indicator at top

### Configure Surface (Onboarding, Settings)
- Progressive disclosure
- Clear save/validation states
- Low decoration, high clarity
- Wizard flow with step indicators

### Explore Surface (Tajweed Viewer)
- Color-coded text with legend
- Hover/click for rule details
- Filters for focused learning
- Dense information, clear navigation

---

## Anti-Slop Checklist (10-Tell Audit)

Before finalizing ANY page or component, check for these 10 tells:

| # | Tell | What it looks like | Fix |
|---|------|-------------------|-----|
| 1 | Tech gradient | Blue/violet/indigo gradient background | Use solid color |
| 2 | Generic tech hue | Default accent is indigo/violet | Use Arabic green (#22c55e) |
| 3 | Feature-tile grid | Icon + heading + sentence × 3 equal cards | Re-layout, pick a surface |
| 4 | Accent rail | Colored left strip on cards | Use real hierarchy |
| 5 | Unearned blur | Glassmorphism without depth | Remove blur |
| 6 | Monument stat | Oversized number with no context | Add context or remove |
| 7 | Icon topper | Rounded icon centered above every heading | Remove, use type hierarchy |
| 8 | Center stack | Everything centered, no composition | Commit to a layout |
| 9 | Default type | Inter or system-ui by default | Use IBM Plex Sans + Scheherazade New |
| 10 | Wrong surface | Hero on a Monitor surface | Match surface to function |
| 11 | Feature tiles | 3–4 equal cards with icon + title + subtitle | Commit to Decide/Learn surface — one idea per section |
| 12 | Empty icon | SVG icon centered above heading on an empty state | Use illustration or simple geometric shape, not a decorative SVG |

**If tells 3, 8, or 10 fire → re-layout, NOT recolor. Those are compositional problems.**

---
## Implementation Notes

### Files
| File | Purpose |
|------|---------|
| `src/styles/globals.css` | CSS custom properties, component classes, motion |
| `src/app/tailwind.config.ts` | Tailwind theme mapping all tokens |
| `src/styles/design-system-verification.html` | Visual verification page |
| `src/styles/DESIGN.md` | This file — source of truth |

### Rules
1. **Dark mode is always on.** No `dark:` classes. No light mode toggle.
2. **Arabic text always gets `line-height: 2.0`** via the `leading-arabic` utility.
3. **Tajweed colors are CSS variables**, not hardcoded hex in components.
4. **No gradients.** Only solid surfaces and functional accents.
5. **Shadows are dark-focused** — white-on-dark needs visible borders, not elevation.
6. **No emojis in production UI.** Use Lucide React icons (`lucide-react`).
7. **RTL support:** `dir="rtl"` on Arabic containers, `lang="ar"` for i18n.
8. **Mobile hit targets minimum 44×44px.**
9. **No focus-ring removal** — every interactive element needs a visible focus state.
10. **Icons are all stroke-based** (1.5px stroke width), never filled.

### Token Update Procedure
When changing a design token:
1. Update `globals.css` custom property
2. Update `tailwind.config.ts` to match
3. Update `design-system-verification.html` if visual
4. Run `npm run build` to verify no Tailwind errors
5. Open verification page in browser

---

## Surface Type Implementation

### Decide/Learn Surface
Use when the page's job is: "convince the user this is worth doing, then guide them into it."
- Hero: single headline (text-3xl/4xl), one sentence, one CTA button
- Sections stack vertically, max-width 640px
- No nav tabs, no sidebar navigation within the section
- Example: Landing page (module 00)

### Monitor Surface
Use when the page's job is: "show me where I am and what's next."
- Stat cards in a 2×2 grid (mobile) or 4-column row (desktop)
- Progress bars with percentage labels inside or beside the bar
- Score history uses real data — no fake sparklines
- No hero section
- Example: Dashboard (module 05)

### Operate Surface
Use when the page's job is: "do the work."
- Content takes full width, exercise below
- Progress indicator (step counter or progress bar) at top
- Primary action button fixed at bottom on mobile (sticky)
- One clear next action per screen
- Example: Lessons (module 03)

### Configure Surface
Use when the page's job is: "set up something before we can start."
- Wizard flow with step indicators (step 1 of 3)
- Forms use consistent validation states (valid = green border, invalid = red + message)
- Save/Cancel always visible
- Low decoration, high clarity — this is work, not a showcase
- Example: Onboarding (module 05)

### Explore Surface
Use when the page's job is: "let me look at content and learn by interacting."
- Color-coded text with floating legend or collapsible sidebar
- Click/tap to reveal detail (tajweed rule explanation)
- Filters above content (horizontal pill row)
- Dense information — this is study, not scrolling
- Example: Tajweed Viewer (module 06)

### Navigation Pattern by Surface
| Surface | Nav | Primary Interaction |
|---------|-----|-------------------|
| Decide/Learn | Sidebar (collapsed on mobile) | Hero CTA |
| Monitor | Sidebar (expanded on desktop) | Stats → drill-down |
| Operate | Sidebar + bottom mobile nav | Content → exercise |
| Configure | No nav | Form → save |
| Explore | Sidebar + inline filters | Content → tap to learn |

---

## Iconography

### Rules
- No emoji in production UI. Replace sidebar emoji icons with SVG icons.
- Icon set: Lucide React (`lucide-react`) — clean, consistent stroke-based icons.
- Icon size: 20px default, 16px for inline/metadata, 24px for mobile nav.
- Icon color: `color.muted` when inactive, `color.primary.500` when active/selected.
- No filled icons — all strokes. Consistent 1.5px stroke width.

### Icon → Module Mapping
| Module | Icon | Label |
|--------|------|-------|
| Home | `layout-dashboard` | الرئيسية |
| Assessment | `file-check` | التقييم |
| Lessons | `book-open` | الدروس |
| Memorization | `repeat` | الحفظ |
| Tajweed | `book-marked` | التجويد |
| Grammar | `type` | النحو |
| AI Tutor | `bot` | المساعد |
| Settings | `settings` | الإعدادات |

### Icon Sizing Reference
```css
/* Lucide icons are 24×24 by default. Override with class: */
.lucide-20 { width: 20px; height: 20px; }
.lucide-16 { width: 16px; height: 16px; }
.lucide-24 { width: 24px; height: 24px; }
```

---

## Motion & Animation Spec

### Global Transition Token
```css
transition: all 0.2s ease;
```
Default for all interactive elements. Override only when specific duration needed.

### Page Transition
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```
Duration: 0.3s ease. Used for page mount transitions.

### Progress Bar Fill
```css
transition: width 0.5s ease;
```
Slower than UI transitions — gives a sense of real progress, not instant snap.

### Stagger (Lists)
```css
/* Each child: 0ms, 50ms, 100ms, 150ms, 200ms */
```
Used for list items appearing on mount.

### Button Press
```css
transform: translateY(1px);
transition: transform 0.1s ease;
```
Adds tactility on click. No bounce, no spring.

### Rules
- Respect `prefers-reduced-motion` — disable non-essential motion.
- Motion clarifies state changes, not decorates them.
- No looping animations.
- No scale-up on hover (feels gimmicky).
- Shadow-only elevation transitions are acceptable (card hover).

---

## Dark Surface Hierarchy

The dark mode surfaces are layered from lightest to darkest. This creates visual depth without relying on shadows (which blend into dark backgrounds).

| Surface | Token | Usage |
|---------|-------|-------|
| `surface.page` | `#0c0a09` (gray-950) | Full page background |
| `surface.panel` | `#1c1917` (gray-900) | Cards, main content area |
| `surface.input` | `#292524` (gray-800) | Inputs, secondary panels, form fields |
| `surface.elevated` | `#44403c` (gray-700) | Popovers, dropdowns (lightest elevated) |

### Border Rules
- Cards: 1px solid `color.gray.700`
- Inputs: 1px solid `color.gray.700`, focus ring `color.primary.500`
- Modals: 1px solid `color.gray.700` + `shadow.lg`
- No border on full-width sections when they sit directly on `surface.page`

### Shadow Table (Dark Mode)
| Context | Value |
|---------|-------|
| Subtle (tooltips) | `0 1px 2px rgba(0,0,0,0.3)` |
| Dropdown/popover | `0 4px 6px rgba(0,0,0,0.4)` |
| Modal | `0 10px 15px rgba(0,0,0,0.5)` |
| Large overlay | `0 20px 25px rgba(0,0,0,0.6)` |
| Primary hover glow | `0 0 20px rgba(34,197,94,0.3)` — button only |

---

## RTL & Accessibility

### Arabic Text Containers
```html
<div dir="rtl" lang="ar" class="leading-arabic">
```
- Every Arabic text block must have `dir="rtl"` and `lang="ar"`.
- `leading-arabic` class sets `line-height: 2.0`.

### Layout Direction
- All page layouts are LTR by default (English UI).
- When the entire page is Arabic (future), wrap the root with `dir="rtl"` on the `html` tag.
- Sidebar mirrors: left on LTR, right on RTL.

### Touch Targets
- Minimum 44×44px for all interactive elements on mobile.
- Buttons: `min-h-[44px]`.
- Nav items: `min-h-[44px]`.

### Focus States
- All interactive elements must have a visible focus ring.
- Focus ring: 2px solid `color.primary.400` + 2px offset (using `outline-offset`).
- Never `outline: none` without a replacement.

---

## Token Reference (Tailwind Class → CSS Variable)

| CSS Variable | Tailwind Class | Example Usage |
|-------------|---------------|---------------|
| `var(--color-primary-500)` | `text-green-500` / `bg-green-500` | Primary buttons, links |
| `var(--color-gray-950)` | `bg-stone-950` | Page background |
| `var(--color-gray-900)` | `bg-stone-900` | Card background |
| `var(--color-gray-800)` | `bg-stone-800` | Input background |
| `var(--color-gray-700)` | `border-stone-700` | Borders, dividers |
| `var(--color-gray-50)` | `text-stone-50` | Primary text |
| `var(--color-gray-400)` | `text-stone-400` | Muted text |
| `var(--color-secondary-500)` | `text-amber-500` / `bg-amber-500` | Warnings, highlights |
| `var(--color-error)` | `text-red-500` / `bg-red-500` | Errors, delete actions |
| `var(--color-info)` | `text-blue-500` | Info badges only |
| `var(--color-tajweed-madd)` | `text-blue-500` | Tajweed: Madd |
| `var(--color-tajweed-noonSaakin)` | `text-green-500` | Tajweed: Noon Saakin |

### Tailwind Config Mapping
The `tailwind.config.ts` file maps these CSS variables to Tailwind's `colors.*` palette. When referencing a design token in Tailwind, use the mapped key:
- `text-primary` → `color.primary.500`
- `text-secondary` → `color.secondary.500`
- `bg-surface` → `color.gray.900`
- `bg-surface-2` → `color.gray.800`
- `text-muted` → `color.gray.400`

---

## Files & Responsibilities

| File | Purpose |
|------|---------|
| `src/styles/globals.css` | CSS custom properties, component classes, motion, anti-slop |
| `src/app/tailwind.config.ts` | Tailwind theme mapping all tokens to utility classes |
| `src/styles/design-system-verification.html` | Visual verification page (open in browser to audit) |
| `src/styles/DESIGN.md` | This file — source of truth for design decisions |

### Token Update Procedure
When changing a design token:
1. Update `globals.css` custom property
2. Update `tailwind.config.ts` to match
3. Update `design-system-verification.html` if visual
4. Run `npm run build` to verify no Tailwind errors
5. Open verification page in browser to confirm

---

*This document is the source of truth for all visual design decisions. If the implementation doesn't match the spec, update the implementation to match the spec.*
