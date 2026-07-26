# Module 09 — Design System

## Source of truth

**`src/app/styles/globals.css`. One file, not two.**

The previous version of this document said "**Both** are source of truth — changes
must update both", naming `globals.css` and `tailwind.config.ts`. Two sources of
truth are zero: nothing failed when they diverged. `tailwind.config.ts` now
*mirrors* globals.css, and `node scripts/gen-design-system.mjs --check` fails the
build when the two disagree — including when a `--font-*` variable has no matching
Tailwind utility, which is how `font-naskh` silently compiled to nothing.

## Published reference

The visual reference is the **"Bayan — Design System"** project on
claude.ai/design: nine cards over Foundations (colour, Arabic type, type scale,
spacing/radius/depth, tajweed) and Components (buttons, badges & progress,
surfaces & cards, forms).

It is **generated** by `scripts/gen-design-system.mjs` from globals.css. Every
swatch, size and contrast ratio is derived, so it cannot describe a palette the
code does not have.

That matters because its predecessor did exactly that. `design-system-verification.html`
— a hand-written "standalone visual verification page", kept in two byte-identical
copies — rendered **38 of its 39 colours from the pre-rebrand palette**. The one
artifact whose job was to show the design system showed the wrong one, for months,
because nothing failed when it drifted. Both copies are deleted; regenerate the
bundle instead.

## Key decisions

1. Dark mode is **always-on** — no light mode toggle, no `dark:` usage.
2. **Never pure white text.** Cream ink (`ground-50`) is 15.7:1 on the canvas
   against white's 18.8:1 — both AAA, and cream reads as printed rather than clinical.
3. **Gold means "act here".** Progress and success use `leaf`, so the accent keeps
   its meaning.
4. Arabic line-height is **2.1** (`leading-arabic`) — diacritics need the room.
   This document previously said 2.0.
5. **Two Arabic faces, one job each.** Amiri for Quranic ayat; Noto Naskh Arabic
   for instructional text, because Amiri sits small on the em and reads cramped in
   running UI copy.
6. **Never set `direction` on mixed text.** `.text-naskh` sets font and leading but
   deliberately not direction; pair it with `dir="auto"`. `.arabic-text` bundles
   all three and is for genuinely RTL-only blocks.
7. Tajweed colours are **functional, not decorative** — they identify recitation
   rules, so they must not be borrowed as generic accents.
8. **No CSS component layer.** The previous one duplicated the React primitives,
   drifted from them, and went unused. Compose Tailwind utilities and
   `components/ui/`.
9. Shadows on a near-black ground read as smudges, so **elevation is borders and
   surface steps**. The one glow is the gold focus ring.

## Historical specs — not authoritative

`modules/09-design-system.md`, `modules/10-ux-design-specification.md` and
`src/styles/DESIGN.md` describe the original palette and carry superseded banners.
`DESIGN.md`'s 12-tell anti-slop audit is still live guidance; its colours are not.
