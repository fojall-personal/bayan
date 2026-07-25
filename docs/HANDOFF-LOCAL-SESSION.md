# Handoff — resuming from a local session

**Last revised 2026-07-25.** Written from a Claude Code cloud session whose
network policy blocks Cloudflare, Tanzil and corpus.quran.com. Everything not
blocked is already merged to `main`; the tree is clean and `main` is level with
the session branch.

Nothing below is blocked on a secret you could hand over. Where credentials are
involved, the host is unreachable too, so a token would be inert (§2).

Companion documents: `docs/APPLICATION-PLAN-v2.md` (the plan in force) and
`docs/CODE-AUDIT-2026-07-25.md` (measured state, and how it got that way).

---

## 1. Start here

In order. Steps 1–3 unblock the deploy; 4–5 unblock the product.

**1. Set the token, in both places** — CI is currently red on exactly this.

```bash
cd workers && npx wrangler secret put API_TOKEN
```

Then add the same value as an `API_TOKEN` secret under GitHub → Settings →
Secrets and variables → Actions. The build fails loudly without it rather than
shipping `Bearer undefined`.

**2. Migrate and seed the remote database.**

```bash
cd workers
npx wrangler d1 migrations apply languagebuilder --remote
npx wrangler d1 execute languagebuilder --remote --file=src/db/seed-user.sql
```

Nine migrations. `0001` is an idempotent baseline, so it is a no-op against the
existing data. The seed row is required — without it `/api/auth/profile` 404s and
every insert referencing `users(id)` fails its foreign key.

**3. Turn on Cloudflare Access.** Six clicks, in the README. One trap: leaving
the `*` in the Subdomain field protects **only preview URLs** and leaves the site
itself open — you want both. Then set `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` on the
**Pages** project, not the standalone Worker, because Pages serves the API now.

**4. Download the pinned Quran text** — one file, 403 from the cloud session:

```
https://github.com/cpfair/quran-tajweed/files/7281388/quran-uthmani.txt
```

Then run the ingest (§4 has the detail, including a batching gotcha):

```bash
node scripts/ingest-quran.mjs --text /path/to/quran-uthmani.txt > /tmp/quran.sql
```

**5. Download the morphology corpus** from https://corpus.quran.com/download/ and
commit it as a data file. This is what unlocks the app's differentiator (§5).

**Also, independently of all the above:** rotate the token in
`workers/.dev.vars`. It is tracked in git.

```bash
git rm --cached workers/.dev.vars
echo "workers/.dev.vars" >> .gitignore
```

---

## 2. Why these need a local session

Measured, not assumed:

| Host | Result | Consequence |
|---|---|---|
| `api.cloudflare.com` | **000** | No deploys, no remote D1, no Access config — a Cloudflare token would be inert |
| `languagebuilder-frontend.pages.dev` | **000** | The deployed site cannot be checked from here |
| `github.com/…` (non-repo paths) | **403** | Attachment and release downloads blocked; the proxy scopes GitHub to this repo |
| `corpus.quran.com` | **000** | Morphology corpus unreachable |
| `download.tanzil.net` | **000** | Quran text unreachable at source |
| `api-docs.quran.foundation` | **000** | Quran Foundation API unreachable |
| `raw.githubusercontent.com` | **200** | Public repo files are fetchable — this is how the tajweed dataset was obtained |
| `fonts.googleapis.com` | **200** | Reachable; see the correction below |

**A correction worth keeping.** An earlier session concluded the sandbox "cannot
reach Google Fonts". That was wrong — the host answers 200. Headless Chromium had
been launched without the proxy, so only *the browser* could not fetch. If you
drive Playwright here:

```js
proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1,::1' }
```

The bypass is essential, or the proxy swallows `localhost` and the page under
test never loads at all.

---

## 3. Verify after deploying

A green Actions run only proves the build compiled. Every production claim in this
repo is inferred from build output and local runs, so check these once:

- [ ] **Fonts load.** Devtools → Network → Font. Should be self-hosted from
      `/_next/static/media/*.woff2`, no request to fonts.googleapis.com.
- [ ] **A data-backed page renders.** `/dashboard` or `/learning` — not an error
      card.
- [ ] **`GET /api/auth/whoami` returns 200.** See the note below; this one has a
      known open question.
- [ ] **Two different people log in and see two different, private profiles.**
      This is the only real test of Access, and it cannot be simulated.
- [ ] **A restore works.** D1 Time Travel gives 30 days for free. Test it *before*
      inviting anyone — an untested backup is not a backup.

### The one open question: `whoami` through Pages

`GET /api/auth/whoami` returns 200 through the standalone Worker (`wrangler dev`)
and **404 through `wrangler pages dev`** — same code, and the route is
demonstrably in the bundle (md5 changes on rebuild, `whoami` present in
`_worker.js`) while its siblings are live on that origin (`/api/auth/profile`
200, `POST /api/auth/onboarding` reaches its handler).

My first theory — a parent-level `app.get('/api/auth/whoami')` shadowed by
`app.route('/api/auth', authRoutes)` — was wrong. Moving it into the sub-app is
better design regardless, but did not change the 404. Most likely a pages-dev
resolution or caching quirk rather than an app defect, since everything else
resolves through the same path. I could not confirm it: clearing wrangler's tmp
directory to force a clean reload left pages dev unable to start, because it
fails on an outbound fetch this environment blocks.

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  https://languagebuilder-frontend.pages.dev/api/auth/whoami
```

200 means it was a local quirk and nothing needs doing. A 404 means the route
needs relocating — and since `whoami` is the intended way to confirm Access is
working, fix it before relying on it for that. Nothing else depends on it.

### What *is* already tested about Access

JWT verification is unit-tested against a locally served JWKS with a real
keypair — re-run it any time with `node scripts/verify-access-jwt.mjs`:

| Case | Result |
|---|---|
| valid token | accepted |
| token for a **different Access application** | rejected (audience) |
| token from a different team domain | rejected (issuer) |
| expired token | rejected |
| unsigned `alg=none` garbage | rejected |
| token with no email claim | rejected by our own check |

The audience check is the one that matters: without it, a valid token for *any*
Access application in *any* Cloudflare account would be accepted. What is untested
is a real browser completing a real Access login.

---

## 4. The Quran ingest

`scripts/ingest-quran.mjs` is written and tested. It needs the file from §1 step 4.

```bash
node scripts/ingest-quran.mjs --text /path/to/quran-uthmani.txt > /tmp/quran.sql
cd workers && npx wrangler d1 execute languagebuilder --local --file=/tmp/quran.sql
```

### Why a substitute copy will not do

Tajweed annotations are `(rule, start, end)` **Unicode codepoint** offsets
relative to each ayah, valid only against the exact text they were generated from
(Tanzil Uthmani, ca. 6 Apr 2017). Tanzil's encoding has changed since.

Tested, not assumed. `risan/quran-json` — a reasonable-looking substitute with
6,236 verses of correct vowelled Uthmani — scored **82.3%** on the alignment
check. About **one tajweed mark in six** would have been attached to the wrong
letter, silently. For a tool whose purpose is teaching tajweed, that is worse than
shipping nothing.

So the script **refuses to emit below 99.5% alignment** and exits 2. It checks the
five rules whose target letter is fixed by definition: hamzat wasl on an alef, lam
shamsiyyah on a lam, ghunnah and iqlab on noon or meem, qalqalah on ق ط ب ج د.
Verified working — the substitute is rejected with a diagnostic naming the
misaligned annotations, and nothing is written.

### Two practical notes

- **Batch the SQL.** The full ingest is 6,236 INSERTs / 5.2 MB, and
  `wrangler d1 execute --file` hit an interactive confirmation that a
  non-interactive shell auto-answers "no" — so nothing was applied and it looked
  like success. Split into chunks of a few hundred statements, or use `d1 import`.
- **Record the checksum.** The script prints the source SHA-256. Consider
  asserting it in CI so a swapped text file cannot silently misalign 60,057
  annotations (plan risk R5).

### Already verified

Using a `--force` run on the substitute, then clearing it: schema, SQL and both
consuming routes work. `/api/tajweed/verses/1` returned 7 verses with text,
simplified text and 7 tajweed tags on 1:1; `/api/memorization/review/today`
returned 200. `quran_verses` was then emptied, because empty is honest — the
routes return `[]` rather than wrong colours.

---

## 5. The morphology corpus

`corpus.quran.com` is unreachable, so the Quranic Arabic Corpus — root, lemma,
POS, form and case for every word in the Quran — cannot be fetched here. It
underpins F4 (generated comprehension checks), F8 (grounded explanations) and F9
(pattern drills): the features that make the app's differentiator work.

Download it, commit it as a data file, and mind plan risk R3: the annotation is
GNU GPL and requires attribution with a link to corpus.quran.com. Hosting one
instance for friends is network use rather than distribution, so the licence risk
is low (R3 was downgraded on that basis), but the attribution is still required.

---

## 6. Already done — do not redo

- **Stages 1–6 of the plan's roadmap**, except the parts blocked above. See
  `docs/APPLICATION-PLAN-v2.md` §10 for what each covered.
- **39 vitest cases** over grading, `normalizeArabic`, scoring, path assignment,
  the SM-2 scheduler and the ingest gate, wired into CI ahead of deploy. Adding
  them found a live bug: at quality 3 the scheduler computed
  `round(interval * 1.2)`, and `round(1 * 1.2)` is 1, so a learner answering "OK"
  every time never advanced past a one-day interval.
- **Fonts self-hosted** with `next/font` — 26 woff2 files, 66 inlined
  `@font-face` rules, no external reference. Verified in a proxied browser: the
  same Arabic string measures 277px in Amiri vs 394px in generic serif.
- **The 18-question placement bank is loaded**, generated from the JSON by
  `scripts/gen-assessment.mjs`. The app previously asked 7 questions hardcoded in
  a component, which carried their own copy of the الرحيم error.
- **Retaking the assessment works.** A single stored result used to lock the flow
  away permanently, and both buttons on the results screen had no handler.
- **Accessibility**: a keyboard-operable `Tabs` component on all three switchers
  (arrow keys, Home/End, one tab stop), a focus trap and Escape on the mobile
  menu, and direction-aware text inputs — the tutor input was hardcoded RTL, so
  English typed backwards.
- **Zero placeholder-as-feature code**, except the one noted in §7. `/advanced`
  no longer awards a point for typing six characters; no `alert()` calls remain.
- **ESLint** configured; it found five real errors on its first run, including a
  `module` variable shadow Next flags specifically. Now clean.
- **Docs match the code.** `AGENTS.md` listed five endpoints that never existed
  and omitted a dozen real ones; its list is now generated from the mounted
  routes. Nine superseded documents were deleted.
- **Two bugs found only by driving the real app**: `/tajweed` showed "Loading…"
  permanently (initialised `loading = true` while the fetch only ran for one tab),
  and `/progress` overflowed a 375px viewport.

---

## 7. Open, but not blocked by this environment

Unreachable components are down to **4 files / 237 LOC**, from 17 / 1,144 at audit
time:

| File | Status |
|---|---|
| `components/audio/AudioPlayer.tsx` | Blocked on F10 — needs reciter audio URLs from the Quran Foundation API (§2) |
| `hooks/useAudioRecorder.ts` | Same: F10 self-recording |
| `components/assessment/QuizQuestion.tsx` | Duplicates markup now inline in `LearningPage`. Refactor onto it, or delete |
| `components/ui/Select.tsx` | No form needs a select yet; the first that does should use it |

Also open:

- **`ReviewSession.handlePlayAudio` is still a fake** — a 3-second `setTimeout`
  with a "Placeholder audio playback" comment. The last
  placeholder-presented-as-a-feature in the codebase. It needs the same audio
  URLs, so it is blocked alongside F10 rather than being an oversight.
- **The memorization tracker has no way to add an ayah.** The endpoint, the
  scheduler and migration 0005 all work; no UI calls `POST /api/memorization/add`.
  This is the largest gap between "marked complete" and "usable", it needs no
  Quran text, and it is the obvious next build.
- **The tutor is a keyword matcher.** Its F8 redesign — render the corpus record
  and let a model only narrate it — is blocked on the morphology corpus (§5), so
  it is a data dependency rather than a model one.
- **Two `react-hooks/exhaustive-deps` warnings** (`DeepDiveView`,
  `SurahProgress`). Intentional as written, but worth resolving with `useCallback`
  rather than leaving warnings in the build.
