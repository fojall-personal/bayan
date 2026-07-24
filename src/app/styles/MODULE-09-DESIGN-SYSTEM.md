# Module 09 — Design System

## Status: Phase 0 — Complete

## Deliverables

| File | Purpose |
|------|---------|
| `tailwind.config.ts` | Tailwind theme with all custom design tokens |
| `src/styles/globals.css` | CSS custom properties, typography, motion, anti-slop guards |
| `src/styles/design-system-verification.html` | Standalone visual verification page |

## Design Tokens

All tokens from `modules/09-design-system.md` are implemented as:
- **CSS custom properties** in `globals.css` for runtime theming
- **Tailwind `extend` entries** in `tailwind.config.ts` for compile-time classes
- **Both are source of truth** — changes must update both

## Key Decisions

1. Dark mode is **always-on** — no light mode toggle, no `dark:` class usage
2. Arabic text uses `line-height: 2.0` via the `leading-arabic` utility
3. Tajweed colors are semantic CSS variables, not decorative
4. No generic gradients — only solid surfaces and functional accents
5. Shadows are dark-focused (white-on-dark needs visible borders)
