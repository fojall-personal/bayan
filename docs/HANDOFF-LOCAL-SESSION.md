# Handoff: what needs a local session

**Written 2026-07-25 from a Claude Code cloud session.**

This container's network policy blocks several hosts, so a handful of steps can
only be done from a machine with ordinary internet and your Cloudflare
credentials. Everything else is already merged to `main`.

Nothing here is blocked on a secret you could hand over. Where credentials are
involved they are also unusable from the cloud session, because the host itself
is unreachable.

---

## 1. Reachability, measured

| Host | Result | Consequence |
|---|---|---|
| `api.cloudflare.com` | **000** | No deploys, no remote D1, no Access config from a cloud session — a Cloudflare token would be inert |
| `languagebuilder-frontend.pages.dev` | **000** | Cannot verify the deployed site |
| `github.com/...` (non-repo paths) | **403** | Release/attachment downloads blocked; the proxy scopes GitHub to this repo |
| `raw.githubusercontent.com` | **200** | Public repo files are fetchable |
| `fonts.googleapis.com` | **200** | Fonts are reachable (see note below) |
| `corpus.quran.com` | **000** | Morphology corpus cannot be fetched |
| `download.tanzil.net` | **000** | Quran text cannot be fetched from source |
| `api-docs.quran.foundation` | **000** | Quran Foundation API unreachable |

A correction worth recording: an earlier session concluded the sandbox "cannot
reach Google Fonts". That was wrong — the host answers 200. Headless Chromium
had simply been launched without the proxy. Launching it with
`proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1,::1' }`
fixes it; **the bypass is essential**, or the proxy swallows `localhost` and the
page under test never loads.

---

## 2. Cloudflare steps (yours by necessity)

1. **Secrets.**
   ```bash
   cd workers && npx wrangler secret put API_TOKEN
   ```
   Add the same value as an `API_TOKEN` secret in GitHub Actions → the build
   fails loudly without it, which is why CI is currently red.

2. **Remote database.**
   ```bash
   cd workers
   npx wrangler d1 migrations apply languagebuilder --remote
   npx wrangler d1 execute languagebuilder --remote --file=src/db/seed-user.sql
   ```
   Nine migrations; `0001` is an idempotent baseline, so it is a no-op on the
   existing data.

3. **Cloudflare Access** — the six clicks are in the README. The trap: leaving
   the `*` in the Subdomain field protects only preview URLs and leaves the site
   itself open. Then set `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` on the **Pages**
   project (it serves the API now, not the standalone Worker) and confirm with
   `/api/auth/whoami` reporting `"mode":"access"`.

4. **Rotate `workers/.dev.vars`.** It is tracked in git with a real-looking
   token: `git rm --cached workers/.dev.vars`, add it to `.gitignore`, rotate.

---

## 3. The Quran text — blocked, and why it matters

`scripts/ingest-quran.mjs` is written, tested, and ready. It needs one file this
session could not fetch.

**Get the pinned text** (a `github.com` attachment, 403 from the cloud session):

```
https://github.com/cpfair/quran-tajweed/files/7281388/quran-uthmani.txt
```

Then:

```bash
node scripts/ingest-quran.mjs --text /path/to/quran-uthmani.txt > /tmp/quran.sql
cd workers && npx wrangler d1 execute languagebuilder --local --file=/tmp/quran.sql
```

### Why a substitute copy will not do

Tajweed annotations are `(rule, start, end)` **Unicode codepoint** offsets
relative to each ayah, valid only against the exact text they were generated
from (Tanzil Uthmani, ca. 6 Apr 2017). Tanzil's encoding has changed since.

This was tested rather than assumed. `risan/quran-json` — a reasonable-looking
substitute, 6,236 verses, correct vowelled Uthmani — scored **82.3%** on the
alignment check. About **one tajweed mark in six** would have been attached to
the wrong letter, silently. For a tool whose purpose is teaching tajweed, that is
worse than shipping nothing.

So the script **refuses to emit below 99.5% alignment** (exit code 2). It checks
the five rules whose target letter is fixed by definition — hamzat wasl on an
alef, lam shamsiyyah on a lam, ghunnah/iqlab on noon or meem, qalqalah on
ق ط ب ج د. Verified working: the substitute is rejected with a diagnostic, and
nothing is written.

### Two practical notes

- **Batch the SQL.** The full ingest is 6,236 INSERTs / 5.2 MB, and
  `wrangler d1 execute --file` hit an interactive confirmation that a
  non-interactive shell auto-answers "no", so nothing was applied. Split into
  chunks (a few hundred statements) or use `d1 import`.
- **Checksum the text.** The script prints the source SHA-256. Record it, and
  consider asserting it in CI so a swapped text file cannot silently misalign
  60,057 annotations (plan risk R5).

**Verified already**, using a `--force` run on the substitute and then clearing
it: schema, SQL, and both consuming routes work. `/api/tajweed/verses/1` returned
7 verses with text, simplified text, and 7 tajweed tags on 1:1;
`/api/memorization/review/today` returned 200. `quran_verses` was then emptied,
because empty is honest — the routes return `[]` rather than wrong colours.

---

## 4. Morphology corpus — blocked

`corpus.quran.com` is unreachable, so the Quranic Arabic Corpus (root, lemma,
POS, form, case for every word) cannot be fetched here. It underpins F4
(generated comprehension checks), F8 (grounded explanations) and F9 (pattern
drills) — the features that make the app's differentiator work.

Download it locally, commit it as a data file, and mind plan risk R3: the
annotation is GNU GPL and requires attribution with a link to corpus.quran.com.
Hosting one instance for friends is network use rather than distribution, so the
licence is low-risk (R3 was downgraded), but attribution is still required.

---

## 5. Done in the cloud session since this doc was written

Recorded so the local session does not redo it:

- **Test suite added** — 39 vitest cases over grading, `normalizeArabic`,
  assessment scoring, path assignment, the SM-2 scheduler and the ingest
  alignment gate, wired into CI ahead of deploy. Adding them found a live bug:
  at quality 3 the scheduler computed `round(interval * 1.2)`, and
  `round(1 * 1.2)` is 1, so a learner answering "OK" every time never advanced
  past a one-day interval. Fixed.
- **Fonts self-hosted** with `next/font` instead of an `@import` — 26 woff2
  files, 66 inlined `@font-face` rules, zero external references. Verified in a
  proxied browser: Amiri renders the Arabic (277px vs 394px for generic serif on
  the same string), Reem Kufi the display type.
- **Placement bank loaded** — the app asked 7 questions hardcoded in
  `AssessmentFlow.tsx` while an 18-question bank sat unused, and the hardcoded
  copy carried its own version of the الرحيم error.
  `scripts/gen-assessment.mjs` generates a module from the JSON (it lives outside
  the Next root so it cannot be imported directly). Walked all 18 in a browser.
- **Retaking the assessment is possible again.** `/assessment` returned results
  whenever any existed, and both buttons on the results screen had no handler, so
  a single stored result locked the flow away permanently.
- **Fake scoring removed.** `/advanced` awarded a point for any input longer than
  five characters. Grading a recalled ayah needs the ayah text, which is not
  loaded, so it now counts attempts — true, rather than a meaningless score. The
  cross-reference card, which `alert()`ed a description of an unbuilt feature, is
  gone. No `alert()` calls remain anywhere.
- **Dashboard routed** at `/dashboard` — Module 05's component had been unreachable.
- **The old audit's bug list is closed out.** All 16 `BUG-xxx` items from
  `docs/audit-bug-list.md` are resolved; the last two were fixed in this pass —
  suggestion chips in the tutor only filled the input box, so a click read as a
  dead control (BUG-010), and two emoji headings plus three emoji category icons
  remained (BUG-013). `BUG-016` needed nothing: Next emits the viewport meta.
  That file and five other superseded documents have been deleted.
- **Documentation now matches the code.** `AGENTS.md` listed five endpoints that
  never existed (`/api/auth/verify`, `GET /api/auth/onboarding`,
  `POST /api/memorization/record`, `POST /api/tajweed/analyze`,
  `GET /api/tutor/chat`) and omitted a dozen real ones; its endpoint section is
  now generated from the mounted routes. Its stack table claimed shadcn/ui and
  KV, neither of which is used.

---

## 6. Still open, and doable anywhere

Unreachable components are down to **4 files / 237 LOC** (from 17 / 1,144 at
audit time). What remains, and why:

| File | Status |
|---|---|
| `components/audio/AudioPlayer.tsx` | Blocked on F10 — needs reciter audio URLs from the Quran Foundation API (§1 unreachable) |
| `hooks/useAudioRecorder.ts` | Same: F10 self-recording |
| `components/assessment/QuizQuestion.tsx` | Duplicates markup now inline in `LearningPage`. Refactor `LearningPage` onto it, or delete |
| `components/ui/Select.tsx` | No form needs a select yet. First one that does should use it |

`ReviewSession.handlePlayAudio` is still a fake — a 3-second `setTimeout` with a
"Placeholder audio playback" comment. It is the last placeholder-presented-as-a-
feature in the codebase, and it needs the same audio URLs, so it is blocked
alongside F10 rather than being an oversight.

Also still open:

- **The tutor is a keyword matcher.** Its F8 redesign — render the corpus record,
  let a model only narrate it — is blocked on the morphology corpus (§4), so it
  is a data dependency rather than a model one.
- **Two `react-hooks/exhaustive-deps` warnings** (`DeepDiveView`,
  `SurahProgress`). Intentional as written, but worth resolving with
  `useCallback` rather than leaving warnings in the build.

---

## 7. One open question: `/api/auth/whoami` through Pages

Worth a single curl on the first real deploy.

`GET /api/auth/whoami` returns 200 through the standalone Worker
(`wrangler dev`) and **404 through `wrangler pages dev`** — same code, same
bundle, and the bundle demonstrably contains the route (md5 changes on rebuild,
`whoami` present in `_worker.js`). Its sibling routes in the same sub-app are
live on that origin: `/api/auth/profile` returns 200 and
`POST /api/auth/onboarding` reaches its handler.

I first assumed a parent-level `app.get('/api/auth/whoami')` was being shadowed
by `app.route('/api/auth', authRoutes)`, and moved it into the sub-app. That is
the better design regardless — it is an auth route — but it did not change the
404, so the shadowing theory was wrong.

Most likely a `wrangler pages dev` asset-resolution or caching quirk rather than
a defect in the app, since every other endpoint resolves correctly through the
same path. I could not confirm it: clearing wrangler's tmp directory to force a
clean reload left pages dev unable to start (it fails on an outbound fetch this
environment blocks).

**To settle it:** after deploying, run

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  https://languagebuilder-frontend.pages.dev/api/auth/whoami
```

If that returns 200, it was a local dev-server quirk and nothing needs doing. If
it 404s on real Pages, the route needs relocating — and since `whoami` is the
intended way to confirm Access is working, fix it before relying on it for that.

Nothing else depends on this endpoint.

---

## 8. Also unverified from here

- **The deployed site.** Every claim about production is inferred from the built
  output and local runs. Once CI is green, load the site and check: fonts
  loading, a data-backed page rendering, `/api/auth/whoami`.
- **The real Access handshake.** JWT verification is unit-tested against a local
  JWKS with a real keypair (`scripts/verify-access-jwt.mjs`, re-runnable) —
  valid accepted; wrong-application, wrong-team, expired, unsigned, and
  no-email all rejected. What is untested is a real browser completing a real
  Access login.
