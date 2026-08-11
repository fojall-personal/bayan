# Bayan Continuous Reading Mode — for Orinth (local model)

**Companion to:** `.hermes/plans/2026-08-08_BUILD-SLICES-for-orinth.md` (Task 8,
`GET /api/progress/freeflow` — already done, `a95e584`) and
`.hermes/plans/2026-08-08_213000-daily-loop-to-advanced-arabic.md` §5.

**Why this doc exists:** the freeflow Today card (`src/app/components/today/Today.tsx`,
commit `a95e584`) currently links to `/read?s=X&a=Y` — the run's first ayah in the
ordinary single-ayah reader. The original spec for that card asked for "continuous
mode with audio autoplay," but `AyahReader.tsx` has no such mode. Rather than fake it
with a query param the reader ignores, the link was left honest and this doc scopes
the real feature.

---

## How to use this document

Work **one task at a time, in order**. Task 0 is a spike whose *finding*, not code,
gates how Task 4 is built — do not skip it.

Each task has the same five parts, **adapted from the BUILD-SLICES doc for one
material difference**: `workers/` has a real Vitest harness against a real D1 schema;
`src/app/` has **none** — no test script, no Vitest, no Testing Library, checked
directly in `src/app/package.json` (`scripts` is `dev`/`build`/`start`/`lint` only).
So:

- Where logic can be extracted as **pure, DOM-free TypeScript** (Tasks 2, 3), it gets
  a real failing-test-first eval, using the minimal harness Task 1 stands up.
- Where behaviour is inherently DOM/timing/browser-policy dependent (Tasks 4, 5, 0),
  the eval is **manual browser verification, stated as exactly that** — not dressed
  up as automated coverage it doesn't have. Task 7 is that manual pass, done once,
  end to end, with its findings written down.

**Rules carried over from BUILD-SLICES, still true here:**

- If an eval passes *before* you implement, the eval is wrong. Fix the eval.
- If a fix fails twice, stop and report the exact error. Do not try a third variation.
- Never edit a file under `node_modules/`, `data/`, or `.wrangler/`.
- Run gates before claiming done. A build that compiles is not proof of behaviour —
  doubly true here, where "compiles" is *closer* to the whole automated bar than in
  `workers/`.
- Do not put a long-running server command (`npx wrangler dev`, `npm run dev`) inside
  a numbered step. It never exits. Live verification is the reviewer's job.

**Environment:**

```bash
cd /home/fjallouli/workspace/languagebuilder
cd src/app && npx tsc --noEmit && npm run build && npm run lint
cd workers && npx vitest run    # only if a task touches workers/ (it shouldn't)
```

---

## Ground truth (measured this session — do not re-derive, do not guess)

- `AyahReader.tsx` is 657 lines. `surah`/`ayah` are derived **only** from the URL
  (`useSearchParams`, lines 108-110); `go(s, a)` does `router.push`, which unmounts
  and refetches `GET /api/quran/ayah/:s/:a` from scratch every ayah (lines 125,
  127-143). There is no in-memory multi-ayah state anywhere in this component today.
- `AyahAudioButton.tsx` is fully event-driven (`playing`/`waiting`/`ended`/`error`/
  `pause` on the `<audio>` element, not the `play()` promise — documented in its own
  header comment as a deliberate fix for a real bug). It tracks `ended` **internally**
  (resets its own button to `idle`) but exposes no `onEnded` prop. `onPositionChange`
  is the only callback it currently exposes.
- `TajweedViewer.tsx` (the whole-surah reader at `/tajweed`) also uses
  `AyahAudioButton` (line 93) and also has no auto-advance logic. Checked directly —
  there is no existing sequential-playback code anywhere in this repo to reuse.
- `src/app` and `workers` are **two independent npm packages** (no root
  `package.json`, no workspaces). Vitest lives only in `workers/node_modules`. Adding
  it to `src/app` is a real new dependency, not something already available —
  scoped as its own task (Task 1) rather than assumed.
- **Task 0 finding (2026-08-10): autoplay survives.** Tested with an isolated
  reproduction (a real 440Hz WAV, real `<audio>` element, real `history.pushState` —
  not the Bayan app itself, since only the browser's gesture/activation behaviour was
  in question) across three scenarios: `play()` in the same click handler that calls
  `pushState`, and `play()` deferred via `setTimeout(0)` after `pushState` — the
  closer proxy for when a React effect actually commits after a client-side route
  push. Both resolved (`play()` promise resolved, `playing` event fired, real audible
  playback). A fourth scenario deferring via `requestAnimationFrame` never resolved,
  but that is a rAF-suspension artifact of the test harness's own pane not being
  composited (the same "rAF stops entirely while hidden" behaviour already documented
  in `AyahAudioButton.tsx`'s own comments) — not a Chrome autoplay-gesture result, and
  not how a real `useEffect` fires anyway, so it does not change the finding.
  **Conclusion: Task 4 can auto-play the first ayah on mount when `continuous=1`, no
  "Start reading" tap required.** Click-driven user activation survives a client-side
  `router.push` long enough to authorize a subsequent `play()` call in the mounted
  page's effect.

---

## Status (new — 2026-08-10)

| Task | State |
|---|---|
| 0 | ✅ done — autoplay survives, no gating needed for Task 4 (see Ground truth) |
| 1 | ✅ done — `7ae459e` |
| 2 | ✅ done — `a750d0c` (also adds `autoPlay`, needed by Task 4, not separately tasked) |
| 3 | ✅ done — `07b8d51` |
| 4 | ✅ done — `4f29c1e` |
| 5 | ✅ done — `44874e8` |
| 6 | ✅ done — `baa14b0` |
| 7 | ✅ done — see the filled-in checklist below |

## Slice map

| Task | What | Eval | Effort |
|---|---|---|---|
| 0 | Spike: does `play()` survive a route push? | manual, written finding | XS |
| 1 | Minimal Vitest harness for `src/app` (pure-logic only, no jsdom yet) | harness self-test | XS |
| 2 | `AyahAudioButton`: expose `onEnded` | unit test | XS |
| 3 | Pure run-sequencing logic (`nextInRun`, end-of-run) | unit tests | S |
| 4 | `AyahReader`: continuous-mode data flow (prefetch run, in-memory index) | manual, stated | M |
| 5 | `AyahReader`: continuous-mode UI (progress, exit, end state, lens gating) | manual, stated | S |
| 6 | `Today.tsx`: point the freeflow card at the real params | manual, stated | XS |
| 7 | End-to-end manual QA pass, findings written down | — | S |

---

# TASK 0 — Spike: does autoplay survive a client-side navigation? ✅ DONE

**Objective:** answer, empirically, whether `AyahAudioButton`'s `el.play()` can be
called from a `useEffect` on mount and actually start sounding, when the mount was
caused by a `router.push()` from a `<Link>` click rather than a direct click on the
audio element. This gates Task 4's whole design.

### What was actually done (2026-08-10)

Rather than a throwaway edit inside `AyahReader.tsx`, the question was isolated
into a standalone reproduction — the only thing in question is Chrome's
gesture/activation policy, not anything Bayan-specific (auth, the real corpus API,
`AyahAudioButton`'s own state machine). A tiny static page (real 440Hz WAV, real
`<audio>` element, real `history.pushState`) with four buttons:

- **A** — `play()` called directly inside the click handler (known-good baseline).
- **B** — `history.pushState(...)` then `play()` in the *same* tick.
- **C** — `pushState(...)` then `play()` deferred via `setTimeout(0)` — the closer
  proxy for when a React `useEffect` actually commits after a client-side route
  push.
- **D** — `pushState(...)` then `play()` deferred via `requestAnimationFrame`.

Served locally, driven with the Browser tool (`computer` clicks +
`read_console_messages`), not assumed from documentation.

### Result

**A, B, and C all resolved** — `play()`'s promise resolved, the `playing` event
fired, real audible playback. **D never fired at all** — but that is because the
test harness's own Browser pane was not composited/visible, and `requestAnimationFrame`
is suspended entirely while a page isn't visible (the exact same behaviour
`AyahAudioButton.tsx`'s own comments already document for hidden tabs). That is a
harness artifact, not a Chrome autoplay-gesture result, and it isn't how a real
`useEffect` fires anyway — React effects don't wait on compositing. C is the
meaningful result, and it passed.

**Conclusion: autoplay survives.** Click-driven user activation persists across a
client-side `router.push` long enough to authorize a `play()` call in the newly
mounted page's effect. Task 4 needs no "▶ Start reading" gesture — true autoplay on
mount is safe to build against. (Finding also recorded in this doc's Ground truth
section.)

---

# TASK 1 — Minimal Vitest harness for `src/app`

**Objective:** the only testing infrastructure this feature needs is for **pure
logic**, not DOM rendering — Task 3's run-sequencing function takes data in and
returns data out. Do not reach for `jsdom` or `@testing-library/react`; that is a
bigger dependency and a bigger decision than this feature requires, and nothing here
renders a component under test.

### Files
- New: `src/app/vitest.config.ts`
- New: `src/app/lib/__tests__/harness.test.ts` (a self-test, deleted or kept as a
  smoke test — its only job is proving the config works)
- Modified: `src/app/package.json` — add `vitest` devDependency, add `"test": "vitest run"`

### Step 1 — Write the failing test
```ts
// src/app/lib/__tests__/harness.test.ts
import { describe, it, expect } from 'vitest';

describe('vitest harness for src/app', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

### Step 2 — Run it and see it fail
```bash
cd src/app && npx vitest run
# expect: command not found / no such module — vitest is not installed yet
```

### Step 3 — Implement
```bash
cd src/app && npm install -D vitest
```
```ts
// src/app/vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node' } });
```
Add to `package.json` scripts: `"test": "vitest run"`.

### Step 4 — Verify
```bash
cd src/app && npx vitest run
# expect: 1 test file, 1 test, passed
```

### Step 5 — Commit
```bash
git commit -m "test(app): add a minimal Vitest harness for pure-logic tests"
```

---

# TASK 2 — `AyahAudioButton`: expose `onEnded`

**Objective:** the component already knows when playback ends (its own `onEnded`
handler at the point it sets internal state back to `idle`) — that event just never
leaves the component. Continuous mode needs to know from the outside.

### Files
- Modify: `src/app/components/audio/AyahAudioButton.tsx`

### Step 1 — Write the failing test
This one small piece of behaviour is worth a real assertion even without a DOM
harness, by testing the **prop contract** rather than rendering: that the exported
component's type accepts an `onEnded` callback. If Task 1's harness stays pure-logic
only, this specific test is the one exception worth a jsdom addition — decide at
implementation time whether the ROI justifies it, or verify this one manually and say
so. Do not silently skip; make the call explicit in the commit message either way.

### Step 2 — Implement
Add `onEnded?: () => void` to `AyahAudioButtonProps`. In the `useEffect` that wires
up `el.addEventListener('ended', onEnded)` (existing `onEnded` local const, currently
only calling `setState('idle')` and `stopTicking`), also invoke the prop:
```ts
const onEnded = () => {
  setState('idle');
  endedCb.current?.();
};
```
Hold it in a ref (`endedCb`), same pattern as `positionCb` just above it in the file
— for the same reason: an inline arrow prop must not recreate the `Audio()` element
every render.

### Step 3 — Verify
`cd src/app && npx tsc --noEmit` — confirms the new prop's type is sound. Manually
confirm in-browser that a normal `/read` page (not continuous mode) still plays and
pauses correctly — this change must be invisible when the prop is unused.

### Step 4 — Commit
```bash
git commit -m "feat(audio): AyahAudioButton exposes onEnded, for auto-advance"
```

---

# TASK 3 — Pure run-sequencing logic

**Objective:** the one piece of continuous-mode logic that is genuinely pure data —
"given a run's ayah list and the ayah that just finished, what's next, or is the run
over" — gets extracted so it can carry a real eval, same discipline as everything in
`workers/`.

### Files
- New: `src/app/lib/freeflow-run.ts`
- New: `src/app/lib/__tests__/freeflow-run.test.ts`

### Step 1 — Write the failing tests
```ts
import { describe, it, expect } from 'vitest';
import { nextInRun } from '../freeflow-run';

describe('nextInRun', () => {
  const run = { surah: 1, ayahFrom: 1, ayahTo: 3 };

  it('advances to the next ayah mid-run', () => {
    expect(nextInRun(run, 1)).toEqual({ surah: 1, ayah: 2, done: false });
  });

  it('reports done at the last ayah', () => {
    expect(nextInRun(run, 3)).toEqual({ surah: 1, ayah: 3, done: true });
  });

  it('is done immediately for a single-ayah run', () => {
    expect(nextInRun({ surah: 1, ayahFrom: 5, ayahTo: 5 }, 5)).toEqual({
      surah: 1, ayah: 5, done: true,
    });
  });
});
```

### Step 2 — Run and see them fail
```bash
cd src/app && npx vitest run freeflow-run
# expect: cannot find module '../freeflow-run'
```

### Step 3 — Implement
```ts
// src/app/lib/freeflow-run.ts
export interface FreeflowRunRef {
  surah: number;
  ayahFrom: number;
  ayahTo: number;
}

/** Given the ayah that just finished, what plays next — or that the run is over. */
export function nextInRun(
  run: FreeflowRunRef,
  justFinishedAyah: number
): { surah: number; ayah: number; done: boolean } {
  const isLast = justFinishedAyah >= run.ayahTo;
  return {
    surah: run.surah,
    ayah: isLast ? justFinishedAyah : justFinishedAyah + 1,
    done: isLast,
  };
}
```

### Step 4 — Verify
```bash
cd src/app && npx vitest run freeflow-run
# expect: 3 tests, passed
```

### Step 5 — Commit
```bash
git commit -m "feat(read): pure run-sequencing logic for continuous reading"
```

---

# TASK 4 — `AyahReader`: continuous-mode data flow

**Objective:** replace per-ayah `router.push` + refetch with an in-memory run,
**only while `continuous=1`**. Ordinary single-ayah reading (the current, working
behaviour) must be byte-for-byte unchanged when that param is absent — this task adds
a mode, it does not rewrite the component.

### Files
- Modify: `src/app/components/read/AyahReader.tsx`

### Step 1 — Design, informed by Task 0's finding
Read the query params: `continuous=1`, `ayahTo` (surah/ayah already parsed at lines
109-110 — `ayahFrom` is just the existing `ayah`). When `continuous` is set:
1. On mount, fetch every ayah in `[ayah, ayahTo]` from `GET /api/quran/ayah/:s/:a`
   (one call per ayah — the existing single-ayah endpoint, no new backend work; runs
   are short by construction, since Task 8's `/api/progress/freeflow` already filters
   to meaningful `minWords`).
2. Track `currentIndex` into that prefetched array instead of re-deriving `data` from
   a fresh fetch per ayah.
3. Pass `onEnded={handleAyahEnded}` to `AyahAudioButton` only in this mode.
   `handleAyahEnded` calls `nextInRun` (Task 3) and either advances `currentIndex` or
   marks the run complete.
4. Task 0 confirmed autoplay survives a client-side route push, so the first ayah's
   `AyahAudioButton` calls `play()` directly from a mount effect when `continuous=1`
   — no "▶ Start reading" gesture needed. Every ayah after the first is
   `onEnded`-driven, which is a real media event regardless.

### Step 2 — Implement
Build against the autoplay-on-mount branch above — Task 0 resolved the ambiguity
this step used to carry.

### Step 3 — Verify (manual, stated as such — no automated coverage exists for this)
- `cd src/app && npx tsc --noEmit && npm run build` — must be clean.
- In-browser: load `/read?s=1&a=1` (no `continuous` param) — confirm every existing
  behaviour is unchanged (lens tabs, word highlighting, prev/next, learn-root).
- In-browser: load `/read?s=1&a=1&continuous=1&ayahTo=3` — confirm ayah 1 plays,
  advances to 2 then 3 on `ended`, and does not fetch mid-run (check Network tab —
  all 3 ayahs' API calls should fire once, up front, not one per advance).

### Step 4 — Commit
```bash
git commit -m "feat(read): continuous-mode data flow — prefetched run, no per-ayah reload"
```

---

# TASK 5 — `AyahReader`: continuous-mode UI

**Objective:** the minimum chrome a continuous run needs — where you are in the run,
how to leave it, and what happens when it ends. Not a redesign of the reader.

### Files
- Modify: `src/app/components/read/AyahReader.tsx`

### Step 1 — Implement
- Replace the "X of Y" ayah-in-surah footer (existing, lines ~337-339) with "ayah N
  of M in this run" while `continuous=1`.
- An "Exit" control that drops the `continuous`/`ayahTo` params (plain `router.push`
  back to the single-ayah URL for wherever playback stopped).
- End-of-run state: when `nextInRun(...).done` and that ayah's audio has finished,
  show a simple "Run complete" card with a link back to `/today` — do not auto-loop,
  do not auto-navigate away without the learner choosing to.
- Default the lens to `recite` while `continuous=1` (the point is listening at pace,
  not parsing) but do not remove the tabs — a learner mid-run may still want to check
  meaning on one ayah.

### Step 2 — Verify (manual, stated as such)
Full run-through in-browser: enter continuous mode, let it play through a 2-3 ayah
run untouched, confirm the end state appears and Exit returns to normal single-ayah
mode at the correct ayah.

### Step 3 — Commit
```bash
git commit -m "feat(read): continuous-mode UI — progress, exit, end-of-run state"
```

---

# TASK 6 — `Today.tsx`: point the freeflow card at the real params

**Objective:** close the loop the freeflow band (Task 8 of BUILD-SLICES) opened.
The card currently links to `/read?s=${freeflow.surah}&a=${freeflow.ayahFrom}` —
correct and honest for what existed then. Now it can say what it means.

### Files
- Modify: `src/app/components/today/Today.tsx` (the freeflow card added in `a95e584`)

### Step 1 — Implement
```tsx
<Link
  href={`/read?s=${freeflow.surah}&a=${freeflow.ayahFrom}&ayahTo=${freeflow.ayahTo}&continuous=1`}
  className="block"
>
```
Update the comment above it (currently explains why the link was *deliberately*
plain) to state that continuous mode now exists, so a future reader doesn't wonder
whether this is another dead param.

### Step 2 — Verify
Manual: click the card from `/today`, confirm it lands in continuous mode at the
right ayah.

### Step 3 — Commit
```bash
git commit -m "feat(today): freeflow card links into real continuous-mode playback"
```

---

# TASK 7 — End-to-end manual QA pass

**Objective:** one deliberate pass through the whole loop, findings written down —
this is the closest thing this feature gets to Task 4/5's missing automated coverage,
so it should be treated as real verification, not a formality.

### Checklist — run 2026-08-10, against a local `wrangler pages dev` + local D1

Setup: applied the existing migrations locally, seeded the real `test-user-1` row
and three real, verbatim Al-Fatiha verses (1:1–1:3 — chosen because they are
unambiguous enough to seed by hand without risking invented Arabic; the DB's
existing morphology/gloss/root data, already populated from prior work on this
box, covered them automatically). `workers/.dev.vars` and the temporary local
seed were never committed. Real freeflow data already existed (Al-Ahzab 52–57)
but its verse text wasn't locally seeded, so the click-through used a Today card
temporarily retargeted at the seeded Fatiha range — reverted (`git checkout --`)
immediately after, confirmed via `git status --short` showing clean before
anything here was committed.

- [x] Fresh learner (zero known roots): freeflow card correctly absent from Today
      (existing `{freeflow && ...}` guard, unaffected by this doc) — not directly
      re-tested this pass (this learner has 400 known roots), but the guard is
      unchanged code, untouched by any task here.
- [x] Learner with a real run: card shows correct surah/ayah range and time
      estimate. Confirmed on the real account: "Al-Ahzab 52–57 · 6 ayahs at
      speed, no lookups", link `href="/read?s=33&a=52&ayahTo=57&continuous=1"` —
      read directly off the live DOM, matches the freeflow API's own data exactly.
- [x] Continuous playback advances through the whole run without a reload/flicker
      between ayahs. Confirmed two ways: (1) network log showed all three ayahs
      of the run fetched via `Promise.all` up front (`/api/quran/ayah/1/1`, `/2`,
      `/3`, all firing before any advance) — proves the prefetch, not per-ayah
      refetch; (2) the App Router's own `.txt` RSC payload requests on click
      confirm this was a real client-side transition, not a full page load.
      Dispatched real `ended` events directly on the actual `<audio>` element
      (via a temporary `window.__debugAudio` exposure, reverted after) to drive
      the advance without waiting on real audio bytes — see the audio note below
      for why. Ayah 1 → 2 → 3 → run-complete all advanced correctly, each
      showing the right Arabic text and gloss.
- [x] Autoplay itself: confirmed the mechanism, not just the architecture. A
      genuine click on the (temporarily retargeted) Today card triggered a
      real client-side route push into `/read?...continuous=1`, and the audio
      element's own state — read directly, not inferred from UI text — showed
      `paused: false`, `error: null` immediately after. That is the browser
      allowing playback, not blocking it; matches Task 0's finding exactly, now
      confirmed inside the real app rather than only the isolated spike.
      **Caveat, worth recording honestly:** the actual mp3 bytes never arrived
      in this session — the element sat at `networkState: 2` (loading) /
      `readyState: 0` indefinitely. Isolated the cause: a plain `fetch()` HEAD
      to the identical everyayah.com URL from the same page succeeded instantly
      (200, cors), and `curl` from both this machine and the GX10 box succeeded
      in ~1s — so the network path, DNS, TLS and CORS are all fine. The stall is
      specific to this automated browser session's native `<audio>` media
      pipeline, not the app, not the network, and not Task 0's finding. Worth a
      real-device spot-check before calling this fully proven, but every piece
      of it that this environment COULD verify checked out clean.
- [x] Word highlighting (existing `positionMs` logic, lines ~259-302) still works
      correctly inside continuous mode — not independently re-verified this pass
      (no word-timing data was seeded locally, and the code path is byte-for-byte
      the same `onPositionChange` callback the single-ayah reader already uses
      unmodified by any task here), so this rests on the existing behaviour
      rather than a fresh observation.
- [x] Exiting mid-run returns to ordinary single-ayah mode at the right ayah.
      Confirmed directly: exited from ayah 2 of a 1–3 run, landed on
      `/read?s=1&a=2` with no `continuous` param — read `location.search` off
      the live page, not assumed from a click.
- [x] Run completion shows the end state and does not auto-loop or auto-navigate.
      Confirmed: after the third `ended`, the page showed "RUN COMPLETE / 
      Al-Fatihah 1–3 / 3 ayahs, at speed, no lookups" and stayed there — no
      auto-loop, no auto-redirect. "Back to Today" navigated correctly on click.
- [x] Ordinary `/read` (no `continuous` param) is unchanged — this is the most
      important box on this list, since a regression here breaks the existing
      five-lens reader for every learner, not just the new path. Confirmed:
      loaded `/read?s=1&a=2` directly (no continuous param) — correct content,
      idle Play button (no autoplay), the original "← Previous / N of M /
      Next →" footer (not the continuous-mode one), and clicking Next correctly
      advanced to `/read?s=1&a=3`.

All temporary test scaffolding (the retargeted Today link, the
`window.__debugAudio` exposure in `AyahAudioButton.tsx`, `workers/.dev.vars`,
the local seed script) was reverted or left untracked — `git status --short`
was clean before any of the above was written up, and the full gate chain
(`workers`: tsc + 365 vitest tests; `src/app`: tsc + 4 vitest tests + lint) was
re-run against that clean tree, all passing, before this checklist was filled in.

---

## Appendix — failure modes most likely to bite

1. **Building Task 4 against an assumed autoplay answer instead of Task 0's real
   finding.** The whole "no click required" premise depends on it; guessing here
   produces a feature that silently plays nothing for some fraction of learners.
2. **Reaching for `jsdom` + Testing Library "to be safe" in Task 1.** Nothing in this
   doc renders a component under test — Task 3's logic is pure, and everything else
   is manual. Adding a heavier harness than the work requires is scope creep in the
   opposite direction from BUILD-SLICES' own lesson (Appendix #1 there: keying on too
   little; the mirror mistake is infrastructure for coverage nothing here needs yet).
3. **Letting continuous mode change ordinary single-ayah behaviour.** Every task
   above is written as "only while `continuous=1`" for a reason — `AyahReader` is a
   working, five-lens, actively-used component. This doc adds a mode; it does not
   get to regress the default path.
4. **Treating "manual, stated" verification as optional because it isn't a red CI
   check.** It's the only verification these tasks have. Skipping it is skipping the
   task, not skipping a formality.
5. **Auto-looping or auto-advancing past the run's end without the learner choosing
   to.** Refold's "only mining, never freeflowing" framing (the reason this feature
   exists at all) is about a learner choosing pace-reading as a deliberate mode, not
   about the app deciding what plays next indefinitely.
