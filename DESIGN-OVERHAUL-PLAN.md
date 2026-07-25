# Design System Overhaul — Plan

> **Goal:** Bring every component and page in Language Builder into compliance with `src/styles/DESIGN.md`.
> **Constraint:** Work in small, single-slice commits. Each slice does ONE thing, verifies it, then moves on.
> **Context:** Local Orinth-35B model. Quality degrades with slice size. Keep each slice under 15 tool calls.
> **Created:** 2026-07-24

---

## Current State Assessment

### What's Already Compliant
- `src/styles/globals.css` (377 lines) — All CSS tokens, component classes, motion, focus states, scrollbar, anti-slop guards
- `src/app/tailwind.config.ts` — Correctly maps CSS variables to Tailwind utilities
- 32 React components across 8 directories
- `src/styles/design-system-verification.html` — Visual audit page (33KB)
- `src/styles/DESIGN.md` — Full token specification

### What's NOT Compliant (Gaps)
| Gap | Severity | Where |
|-----|----------|-------|
| Emoji icons in Sidebar/MobileNav/Onboarding/Dashboard | **High** | `layout/Sidebar.tsx`, `layout/MobileNav.tsx`, `onboarding/Onboarding.tsx`, `dashboard/Dashboard.tsx` |
| No `lucide-react` dependency | **High** | `package.json` (likely missing) |
| globals.css references old filename `MODULE-09-DESIGN-SYSTEM.md` | Medium | Bottom of `globals.css` |
| Components may use hardcoded colors instead of CSS variables | Medium | Various components |
| No `leading-arabic` utility class defined (DESIGN.md says Arabic text uses it) | Low | `globals.css` — has `.text-arabic` but not `.leading-arabic` |

### Files That Need Work
1. `src/app/components/layout/Sidebar.tsx` — Emoji → Lucide icons
2. `src/app/components/layout/MobileNav.tsx` — Emoji → Lucide icons
3. `src/app/components/onboarding/Onboarding.tsx` — Emoji → Lucide icons
4. `src/app/components/dashboard/Dashboard.tsx` — Emoji → Lucide icons
5. `src/styles/globals.css` — Fix old reference, add `.leading-arabic` class
6. `src/app/package.json` — Add `lucide-react` dependency

---

## The Plan (10 Slices)

### Slice 1: Add `lucide-react` dependency + verify install
**Goal:** Install the icon library so components can use it.
**Steps:**
1. Add `lucide-react` to `package.json` devDependencies
2. Run `npm install`
3. Verify `node_modules/lucide-react/package.json` exists
4. Commit

**Verify:** `ls node_modules/lucide-react/package.json` returns valid JSON with version.

---

### Slice 2: Replace Sidebar emoji icons with Lucide
**Goal:** Sidebar uses Lucide icons, not emoji.
**Steps:**
1. Read current `Sidebar.tsx`
2. Replace each emoji with matching Lucide icon import
3. Replace inline emoji rendering with `<Icon />` components
4. Verify no emoji remain in file
5. Commit

**Mapping:** 📚→`BookOpen`, 🏠→`LayoutDashboard`, 📊→`BarChart3`, ✏️→`FilePen`, 📖→`BookMarked`, 🎯→`Target`, 🔍→`Search`, 🤖→`Bot`, ⚙️→`Settings`

**Verify:** `grep -c '📚\|🏠\|📊\|✏️\|📖\|🎯\|🔍\|🤖\|⚙️' src/app/components/layout/Sidebar.tsx` returns 0.

---

### Slice 3: Replace MobileNav emoji icons with Lucide
**Goal:** MobileNav uses Lucide icons.
**Steps:**
1. Read current `MobileNav.tsx`
2. Replace emoji with matching Lucide icons
3. Verify no emoji remain
4. Commit

**Verify:** `grep -c '📚\|🏠\|📊\|✏️\|📖\|🎯\|🔍\|🤖\|⚙️' src/app/components/layout/MobileNav.tsx` returns 0.

---

### Slice 4: Replace Onboarding emoji icons with Lucide
**Goal:** Onboarding uses Lucide icons.
**Steps:**
1. Read current `Onboarding.tsx`
2. Replace emoji with matching Lucide icons
3. Verify no emoji remain
4. Commit

**Verify:** `grep -c '📚\|🏠\|📊\|✏️\|📖\|🎯\|🔍\|🤖\|⚙️' src/app/components/onboarding/Onboarding.tsx` returns 0.

---

### Slice 5: Replace Dashboard emoji icons with Lucide
**Goal:** Dashboard uses Lucide icons.
**Steps:**
1. Read current `Dashboard.tsx`
2. Replace emoji with matching Lucide icons
3. Verify no emoji remain
4. Commit

**Verify:** `grep -c '📚\|🏠\|📊\|✏️\|📖\|🎯\|🔍\|🤖\|⚙️' src/app/components/dashboard/Dashboard.tsx` returns 0.

---

### Slice 6: Fix globals.css reference + add `.leading-arabic`
**Goal:** globals.css anti-slop guard references `DESIGN.md` (not old filename), and `.leading-arabic` utility class exists.
**Steps:**
1. Read bottom of `globals.css` (anti-slop comments)
2. Replace `MODULE-09-DESIGN-SYSTEM.md` with `DESIGN.md`
3. Add `.leading-arabic` class if missing (maps to `line-height: var(--leading-arabic)`)
4. Verify file still parses correctly
5. Commit

**Verify:** `grep -c 'MODULE-09' src/styles/globals.css` returns 0. `grep -c 'leading-arabic' src/styles/globals.css` returns > 0.

---

### Slice 7: Audit remaining components for hardcoded colors
**Goal:** Components use design tokens, not hardcoded hex values (except tajweed rule colors which are intentional).
**Steps:**
1. Search all components for hardcoded hex color values (e.g., `#22c55e`, `#1c1917`, `#0c0a09`)
2. For each match, determine if it's:
   - A tajweed rule color (keep — intentional)
   - A design token that should use CSS variable (fix)
3. Fix non-tajweed hardcoded colors
4. Commit

**Pattern to look for:** `'#22c55e'`, `'#1c1917'`, `'#0c0a09'`, `'#44403c'` — these should be `var(--color-primary-500)`, `var(--color-surface)`, `var(--color-bg)`, `var(--color-border)`

**Verify:** Run audit script to count remaining non-tajweed hardcoded colors.

---

### Slice 8: Update PLAN.md Phase 0 with DESIGN.md status
**Goal:** PLAN.md reflects that DESIGN.md is now the primary design document, not just a module reference.
**Steps:**
1. Read current PLAN.md Phase 0 section
2. Update deliverables to reference DESIGN.md as the source of truth
3. Add verification step to Phase 0 completion criteria
4. Commit

**Verify:** `grep -c 'DESIGN.md' PLAN.md` returns > 0.

---

### Slice 9: Update RESUME.md with overhaul status
**Goal:** RESUME.md documents the design system overhaul completion.
**Steps:**
1. Read current RESUME.md
2. Add section documenting: "Design System Overhaul — replaced emoji icons, added lucide-react, fixed globals.css references, audited hardcoded colors"
3. List affected files
4. Commit

**Verify:** `grep -c 'design system overhaul' -i RESUME.md` returns > 0.

---

### Slice 10: Final verification pass
**Goal:** Confirm the entire app is now design-system compliant.
**Steps:**
1. Run full emoji audit across all components: `grep -rl '📚\|🏠\|📊\|✏️\|📖\|🎯\|🔍\|🤖\|⚙️' src/app/components/`
2. Verify `lucide-react` is in package.json
3. Verify globals.css references DESIGN.md
4. Verify no hardcoded non-tajweed colors remain
5. Run build to confirm no TypeScript errors
6. Commit final state
7. Tag commit as `v0.2.0-design-system-overhaul`

**Verify:** All checks pass. Build succeeds.

---

## Execution Notes

- **One slice per commit.** Each commit should be self-contained and reviewable.
- **Verify before committing.** Every slice has explicit verification steps.
- **If a slice takes >20 tool calls, stop and split it.** Quality degrades with iteration count.
- **After each slice:** Commit with descriptive message. Update docs if needed.
- **If stuck on a slice for >2 attempts:** Block it with reason, don't retry blind.
- **Build after Slice 10** to confirm nothing is broken.

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `lucide-react` not in package.json | Slice 1 adds it; verify install succeeds |
| Components reference icon names that don't exist | Use exact Lucide icon names from their docs |
| Hardcoded colors are intentional (tajweed) | Only flag non-tajweed hardcoded values |
| Build breaks after icon changes | Run `npm run build` after Slice 7 and Slice 10 |

## Success Criteria

After all 10 slices:
- [ ] Zero emoji in component files
- [ ] All nav icons use Lucide React
- [ ] `lucide-react` listed in package.json
- [ ] globals.css references DESIGN.md (not old filename)
- [ ] `.leading-arabic` utility class exists
- [ ] No hardcoded non-tajweed colors in components
- [ ] `npm run build` succeeds with zero errors
- [ ] PLAN.md, RESUME.md, README.md all updated
- [ ] All changes committed with descriptive messages
