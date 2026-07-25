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

## 5. Also unverified from here

- **The deployed site.** Every claim about production is inferred from the built
  output and local runs. Once CI is green, load the site and check: fonts
  loading, a data-backed page rendering, `/api/auth/whoami`.
- **The real Access handshake.** JWT verification is unit-tested against a local
  JWKS with a real keypair (`scripts/verify-access-jwt.mjs`, re-runnable) —
  valid accepted; wrong-application, wrong-team, expired, unsigned, and
  no-email all rejected. What is untested is a real browser completing a real
  Access login.
