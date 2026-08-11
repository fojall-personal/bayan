# Bayan Build Slices — for Orinth (local model)

**Companion to:** `.hermes/plans/2026-08-08_213000-daily-loop-to-advanced-arabic.md`
**Audience:** a local coding model. Every task is self-contained: exact paths, complete
code, and one eval that **fails before and passes after**.

---

## How to use this document

Work **one task at a time, in order**. Never start task N+1 before task N's eval passes.

Each task has the same five parts:

1. **Files** — exact paths to create or modify
2. **Eval first** — write the failing test, run it, *see it fail*
3. **Implement** — the change
4. **Verify** — the exact command and its expected output
5. **Commit** — the exact message

**Rules that are not negotiable:**

- If an eval passes *before* you implement, the eval is wrong. Fix the eval.
- If a fix fails twice, stop and report the exact error. Do not try a third variation.
- Never edit a file under `node_modules/`, `data/`, or `.wrangler/`.
- Arabic identifiers in the database are **Buckwalter transliteration** (`min`, `fiY`,
  `{l~a*iY`), not Arabic script. Do not "fix" them into Arabic.
- Run gates before claiming done. A build that compiles is not proof of behaviour.

**Environment:**

```bash
cd /home/fjallouli/workspace/languagebuilder
# route/unit tests
cd workers && npx vitest run                 # all
cd workers && npx vitest run test/routes.test.ts
# gates
node scripts/gen-db-types.mjs --check
node scripts/gen-content-manifest.mjs --check
```

---

## Ground truth (measured — do not re-derive, do not guess)

These come from querying the local D1 at
`.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`. Tests below assert
against them.

```
quran_word_morphology rows (SEGMENTS, not words): 128,219
distinct ayahs:                                     6,236
distinct roots:                                     1,642
distinct function lemmas (root IS NULL):              175
distinct function (lemma,pos) PAIRS  <- what you count:  215

Ayahs fully readable, by roots known (verified by running the Task 3 SQL):
  roots  | today (roots only) | + top-50 fn pairs known | if NO fn words known
     63  |        272         |          216            |         41
    300  |      2,291         |        1,891            |        198
    400  |      3,044         |        2,511            |        244

  top  20 (lemma,pos) pairs = 77.3% of function-word segments
  top  50 pairs             = 94.0%
  top 100 pairs             = 98.9%
  all 215 pairs             = 100%   (24,640 function-word segments)

Top function lemmas (Buckwalter, root IS NULL):
  min 3226(P) · fiY 1701(P) · <in~ 1682(ACC) · maA 1476(REL) · EalaY` 1445(P)
  {l~a*iY 1442(REL) · laA 1406(NEG) · <ilaY` 742(P) · maA 705(NEG) · man 650(REL)
  <in 578(COND) · >an 578(SUB)
```

**Note the two `maA` rows.** Same lemma, different `pos` — REL 1,476 and NEG 705.
Function-word identity is therefore **(lemma, pos)**, never lemma alone. This is the
single most common mistake available in this whole document; a `PRIMARY KEY` on lemma
alone silently merges them and Task 5's drill becomes impossible.

**Schema you will join against** (verified from the live DB):

```sql
CREATE TABLE quran_word_morphology (
  surah_id INTEGER NOT NULL, ayah_id INTEGER NOT NULL,
  word_index INTEGER NOT NULL, segment_index INTEGER NOT NULL,
  form TEXT, tag TEXT, lemma TEXT, root TEXT, pos TEXT,
  verb_form TEXT, aspect TEXT, voice TEXT, mood TEXT, person TEXT,
  gender TEXT, number TEXT, case_case TEXT, state TEXT,
  PRIMARY KEY (surah_id, ayah_id, word_index, segment_index)
);

CREATE TABLE user_known_root (            -- copy this shape for the new table
  user_id TEXT NOT NULL, root TEXT NOT NULL,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  strength INTEGER NOT NULL DEFAULT 1 CHECK (strength BETWEEN 1 AND 5),
  PRIMARY KEY (user_id, root)
);
```

**Test harness:** `workers/test/helpers/harness.ts` gives you `harness()` which applies
the **real migration files** in filename order against in-memory SQLite and dispatches
through the real Hono middleware chain. Content tables are **empty by design** — SQLite
still raises on an unknown column with zero rows, which is what catches wrong column
names. If a test needs data, insert it in the test.

---

## Status (updated 2026-08-10)

| Task | State |
|---|---|
| 1 | ✅ done — `c00ab2e` |
| 2 | ✅ done — `183a32c` |
| 3 | ✅ done — `1c476ea` (implemented by the planning agent, not Orinth); follow-up fix `ce96af1` |
| 4 | ✅ done — `18297df` |
| 5 | ✅ done — `bf99f9f`, follow-up `8336667` |
| 6 | ✅ done — `b68e98f` |
| 7 | ✅ done — `34159bc` (production items), `c66c2d0` (UI) |
| 8 | open |

**Two process rules learned the hard way — they apply to every remaining task.**

1. **Never put a long-running server command inside a numbered step.** Task 3's
   original prompt included `npx wrangler dev` in its verify block. That command never
   exits, so a worker executing steps in order hangs forever and commits nothing —
   which is exactly what happened (zero commits, clean tree, no partial edits). Live
   API verification is the reviewer's job, not the implementing worker's. A worker's
   verification is: tests, gates, `npm run build`, and greps.

2. **Print the real exit code after every gate.** These scripts print their complaint
   to stdout and exit non-zero, so piping through `tail`/`head` shows the message but
   reports success. Task 2 was committed with `gen-api-docs --check` exiting 1 because
   of this. Always:
   ```bash
   node scripts/<gate>.mjs --check > /tmp/g.txt 2>&1; echo "EXIT=$?"; cat /tmp/g.txt
   ```

**A third, structural:** do not ship a slice that adds an endpoint without a UI caller.
`gen-api-docs --check` fails on orphan endpoints by design. Either pair the endpoint
with its caller in one task, or state explicitly in the task that the gate is expected
red and which later task closes it.

---

## Slice map

| Task | What | Eval | Effort |
|---|---|---|---|
| 1 | Migration: `user_known_function_word` | migration applies, PK is (user_id,lemma,pos) | XS |
| 2 | `GET/POST/DELETE /api/progress/function-words` | route tests | S |
| 3 | Coverage counts function words | route test asserts the drop | S |
| 4 | `KIND_LABELS` bug — 10 kinds render as raw enums | check script | XS |
| 5 | Homograph drill (`maA` REL vs NEG) generator | generator + content check | M |
| 6 | Typed recall in hifz review (feeds `gradeFromAccuracy`) | grading tests | M |
| 7 | Tashkil production items (reverse `normaliseArabic`) | unit + route tests | M |
| 8 | Freeflow reading band (>=98% coverage run) | route test | M |

Tasks 1-3 are one feature split into three commits. Do not merge them.

---

# TASK 1 — Migration: `user_known_function_word`

**Objective:** add the table that records which function words a learner knows.
Nothing reads it yet. One commit, one file.

### Files
- Create: `workers/src/db/migrations/0023_known_function_words.sql`
- Modify: `workers/test/harness.test.ts` (add one assertion)

### Step 1 — Write the failing test

Open `workers/test/harness.test.ts` and add this case inside the existing top-level
`describe(...)` block:

```ts
  it('has the function-word knowledge table with a (user, lemma, pos) key', () => {
    h = harness();
    // Same shape as user_known_root, plus pos — because `maA` is REL 1,476 times
    // and NEG 705 times, and they are different words to learn.
    h.db.prepare(
      `INSERT INTO user_known_function_word (user_id, lemma, pos) VALUES (?, ?, ?)`
    ).run(TEST_USER, 'maA', 'REL');
    h.db.prepare(
      `INSERT INTO user_known_function_word (user_id, lemma, pos) VALUES (?, ?, ?)`
    ).run(TEST_USER, 'maA', 'NEG');

    const n = h.db
      .prepare(`SELECT COUNT(*) AS n FROM user_known_function_word WHERE user_id = ?`)
      .get(TEST_USER) as { n: number };
    // Two rows, not one: the PK must include pos.
    expect(n.n).toBe(2);
  });
```

**House style, verified:** `workers/test/harness.test.ts` already imports both `harness`
and `TEST_USER`, and declares a shared `let h` with an `afterEach(() => { h?.close(); })`.
Assign to that `h` — do **not** add a local `const h` or your own `try/finally`, and do
not add an import; both are already there.

**Baseline before you start:** that file has **3 passing tests**. After this task it must
have 4.

### Step 2 — Run it and SEE IT FAIL

```bash
cd workers && npx vitest run test/harness.test.ts
```
Expected: **FAIL** — `no such table: user_known_function_word`.

If it fails for any other reason, stop and report.

### Step 3 — Implement

Create `workers/src/db/migrations/0023_known_function_words.sql`:

```sql
-- Which function words a learner knows.
--
-- Coverage counted an ayah readable when every ROOTED word in it had a known root,
-- and treated everything else as free. Measured against this corpus, that is 27,462
-- of 77,429 word tokens — 35.5% — assumed known: prepositions (9,886), conjunctions
-- (4,090), relative pronouns (2,202), negations (1,258), demonstratives (773).
-- Those are the words that carry the syntax, so the old number was not a small
-- overstatement of reading ability; it was an overstatement of exactly the part that
-- decides what a sentence means.
--
-- The good news is the shape of the distribution. There are only 175 distinct
-- function lemmas -- 215 (lemma,pos) pairs -- in the whole Quran, and:
--     top 20 lemmas = 77.3% of all function-word segments
--     top 50 lemmas = 94.0%
--     top 100       = 98.9%
-- So 50 items, four a day for a fortnight, closes almost the entire hole.
--
-- KEY IS (user_id, lemma, pos), NOT (user_id, lemma).
-- `maA` is a relative pronoun 1,476 times and a negation 705 times. `<in` is
-- conditional; `<in~` is the accusative particle. These are different words that
-- happen to share a spelling, they are learned separately, and telling them apart in
-- context IS the advanced skill. A key on lemma alone silently merges them.
--
-- Buckwalter throughout, matching quran_word_morphology.lemma / .pos exactly.
-- Joining on anything else would silently drop rows.

CREATE TABLE IF NOT EXISTS user_known_function_word (
  user_id    TEXT NOT NULL,
  lemma      TEXT NOT NULL,
  pos        TEXT NOT NULL,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  strength   INTEGER NOT NULL DEFAULT 1 CHECK (strength BETWEEN 1 AND 5),
  PRIMARY KEY (user_id, lemma, pos)
);

-- Coverage joins every unrooted segment against this table per user.
CREATE INDEX IF NOT EXISTS idx_known_fw_user ON user_known_function_word (user_id);
CREATE INDEX IF NOT EXISTS idx_known_fw_lemma ON user_known_function_word (lemma, pos);
```

### Step 4 — Verify

```bash
cd workers && npx vitest run test/harness.test.ts
```
Expected: **PASS**.

Then the type gate (it reads migrations and regenerates row types):

```bash
cd /home/fjallouli/workspace/languagebuilder
node scripts/gen-db-types.mjs          # regenerate
node scripts/gen-db-types.mjs --check  # must print OK
```

If `--check` fails, run the non-`--check` form first, commit the regenerated file
together with the migration, then re-run `--check`.

### Step 5 — Commit

```bash
git add workers/src/db/migrations/0023_known_function_words.sql workers/test/harness.test.ts workers/src/db/schema.ts
git commit -m "feat(db): add user_known_function_word keyed on (user, lemma, pos)"
```

---

# TASK 2 — Function-word API

**Objective:** read the list, mark one known, unmark it. Coverage still ignores it —
that is Task 3. This task must not touch `/coverage`.

### Files
- Modify: `workers/src/routes/progress.ts`
- Modify: `workers/test/routes.test.ts`

### Step 1 — Write the failing tests

Add to `workers/test/routes.test.ts`:

```ts
describe('function words', () => {
  // The harness applies real migrations but leaves content tables empty, so a test
  // that needs corpus rows inserts them. Two `maA` senses is the case that matters.
  function seedFunctionWords(h: Harness) {
    const ins = h.db.prepare(
      `INSERT INTO quran_word_morphology
         (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`
    );
    // 3 x maA/REL, 2 x maA/NEG, 1 x min/P
    ins.run(1, 1, 1, 1, 'maA', 'maA', 'REL');
    ins.run(1, 2, 1, 1, 'maA', 'maA', 'REL');
    ins.run(1, 3, 1, 1, 'maA', 'maA', 'REL');
    ins.run(2, 1, 1, 1, 'maA', 'maA', 'NEG');
    ins.run(2, 2, 1, 1, 'maA', 'maA', 'NEG');
    ins.run(3, 1, 1, 1, 'min', 'min', 'P');
  }

  it('lists function words by frequency, with the two maA senses separate', async () => {
    const h = H();
    seedFunctionWords(h);
    const { status, body } = await h.json<{ data: { items: any[] } }>(
      '/api/progress/function-words'
    );
    expect(status).toBe(200);
    const items = body.data.items;
    expect(items[0]).toMatchObject({ lemma: 'maA', pos: 'REL', occurrences: 3 });
    // Same lemma, different pos, listed as its own row.
    expect(items.find((i) => i.pos === 'NEG')).toMatchObject({
      lemma: 'maA',
      occurrences: 2,
    });
    expect(items.every((i) => i.known === false)).toBe(true);
  });

  it('marks one sense known without marking the other', async () => {
    const h = H();
    seedFunctionWords(h);
    const post = await h.json<{ data: any }>(
      '/api/progress/function-words/maA/REL/known',
      { method: 'POST' }
    );
    expect(post.status).toBe(200);
    expect(post.body.data).toMatchObject({ lemma: 'maA', pos: 'REL', occurrences: 3 });

    const { body } = await h.json<{ data: { items: any[] } }>(
      '/api/progress/function-words'
    );
    const rel = body.data.items.find((i) => i.pos === 'REL');
    const neg = body.data.items.find((i) => i.pos === 'NEG');
    expect(rel.known).toBe(true);
    // The whole point of the composite key.
    expect(neg.known).toBe(false);
  });

  it('refuses a (lemma,pos) pair the corpus does not attest', async () => {
    const h = H();
    seedFunctionWords(h);
    const { status } = await h.json('/api/progress/function-words/zzz/P/known', {
      method: 'POST',
    });
    expect(status).toBe(404);
  });

  it('unmarks a function word', async () => {
    const h = H();
    seedFunctionWords(h);
    await h.json('/api/progress/function-words/min/P/known', { method: 'POST' });
    const del = await h.json('/api/progress/function-words/min/P/known', {
      method: 'DELETE',
    });
    expect(del.status).toBe(200);
    const { body } = await h.json<{ data: { items: any[] } }>(
      '/api/progress/function-words'
    );
    expect(body.data.items.find((i) => i.lemma === 'min').known).toBe(false);
  });
});
```

**House style, verified against the file.** `workers/test/routes.test.ts` does NOT create
a harness per test. It declares:

```ts
let h: Harness | null = null;
afterEach(() => { h?.close(); h = null; });
const H = () => (h ??= harness());
```

so every test calls `H()` and the `afterEach` closes it. `Harness` is already imported as
a type. Use `H()`; do not write `const h = harness()` or your own `try/finally`.

### Step 2 — Run and SEE THEM FAIL

```bash
cd workers && npx vitest run test/routes.test.ts -t "function words"
```
Expected: **4 failing** (404s — routes do not exist).

### Step 3 — Implement

Append to `workers/src/routes/progress.ts` (after the existing roots handlers):

```ts
/**
 * GET    /api/progress/function-words            — the 175 function words, by frequency
 * POST   /api/progress/function-words/:lemma/:pos/known
 * DELETE /api/progress/function-words/:lemma/:pos/known
 *
 * Coverage assumed every unrooted word was already known — 35.5% of the text, and
 * precisely the words that carry the syntax. These endpoints are the missing state.
 *
 * Addressed by (lemma, pos), never lemma alone: `maA` is REL 1,476 times and NEG 705
 * times. Two words, one spelling, learned separately.
 */
progressRoutes.get('/function-words', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const items = await db.query<{
      lemma: string;
      pos: string;
      occurrences: number;
      known: number;
    }>(
      `SELECT m.lemma,
              m.pos,
              COUNT(*) AS occurrences,
              CASE WHEN k.lemma IS NULL THEN 0 ELSE 1 END AS known
         FROM quran_word_morphology m
         LEFT JOIN user_known_function_word k
           ON k.user_id = ? AND k.lemma = m.lemma AND k.pos = m.pos
        WHERE m.root IS NULL
          AND m.lemma IS NOT NULL AND m.lemma <> ''
          AND m.pos IS NOT NULL
        GROUP BY m.lemma, m.pos
        ORDER BY occurrences DESC, m.lemma, m.pos`,
      [userId]
    );

    return c.json({
      data: {
        items: items.map((i) => ({
          lemma: i.lemma,
          pos: i.pos,
          occurrences: i.occurrences,
          known: i.known === 1,
        })),
      },
      // Measured, so the learner can check the claim rather than trust it.
      basis:
        'Function words are segments with no root — particles, pronouns, negations. ' +
        'There are 215 (lemma,pos) pairs in the Quran; the top 50 cover 94% of all ' +
        'function-word ' +
        'occurrences. Listed separately per part of speech, because maA is a relative ' +
        'pronoun 1,476 times and a negation 705 times.',
    });
  } catch (error) {
    console.error('Function words error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

progressRoutes.post('/function-words/:lemma/:pos/known', async (c) => {
  const userId = c.get('userId');
  const lemma = c.req.param('lemma');
  const pos = c.req.param('pos');
  const db = getDb(c);

  try {
    // Same refusal as roots: an unattested pair can never make an ayah readable,
    // so accepting a typo would inflate the count with nothing.
    const exists = await db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM quran_word_morphology
        WHERE lemma = ? AND pos = ? AND root IS NULL`,
      [lemma, pos]
    );
    if (!exists || exists.n === 0) {
      return c.json(
        { error: `The corpus has no function word "${lemma}" as ${pos}` },
        404
      );
    }

    await db.run(
      `INSERT OR IGNORE INTO user_known_function_word (user_id, lemma, pos)
       VALUES (?, ?, ?)`,
      [userId, lemma, pos]
    );

    return c.json({ data: { lemma, pos, occurrences: exists.n } });
  } catch (error) {
    console.error('Mark function word known error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

progressRoutes.delete('/function-words/:lemma/:pos/known', async (c) => {
  const userId = c.get('userId');
  const lemma = c.req.param('lemma');
  const pos = c.req.param('pos');
  const db = getDb(c);

  try {
    await db.run(
      `DELETE FROM user_known_function_word
        WHERE user_id = ? AND lemma = ? AND pos = ?`,
      [userId, lemma, pos]
    );
    return c.json({ data: { lemma, pos } });
  } catch (error) {
    console.error('Unmark function word error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
```

### Step 4 — Verify

```bash
cd workers && npx vitest run test/routes.test.ts -t "function words"   # 4 passing
cd workers && npx vitest run                                           # nothing else broke
cd /home/fjallouli/workspace/languagebuilder
node scripts/gen-api-docs.mjs --check
```

`gen-api-docs.mjs --check` gates the endpoint list in `AGENTS.md` **and a status table
in `README.md`** (route/nav/endpoint/migration/test-block counts).

**It is already red before you start.** Task 1 added migration 0023 and a test, so the
README table is stale (it will say it should read 23 migrations, 249 test blocks). That
is expected debt from Task 1, not something you broke. Your three new endpoints change
the endpoint count too, so one regeneration fixes both:

```bash
node scripts/gen-api-docs.mjs
node scripts/gen-api-docs.mjs --check   # now OK
```

Include `README.md` in the commit — this repo has a precedent commit for exactly this
("Regenerate README status table (212->248 test blocks, 21->22 migrations)").

### Step 5 — Commit

```bash
git add workers/src/routes/progress.ts workers/test/routes.test.ts AGENTS.md README.md
git commit -m "feat(api): function-word knowledge endpoints keyed on (lemma,pos)"
```

---

# TASK 3 — Coverage counts function words

**Objective:** an ayah is readable when its rooted words **and** its function words are
known. This is the task that makes the headline number true.

**Warning — read before starting.** The reported coverage will **drop**. That is the
point. Measured on the real corpus: a learner with the top 400 roots sees 3,044 ayahs
today; with the top 50 function words also known that is 2,743; with no function words
known it is 244. Do not "fix" the drop. Do not add a fudge factor. The UI copy in Step 3
explains it to the learner.

### Files
- Modify: `workers/src/routes/progress.ts` (the `/coverage` handler + `ayahsReadable`)
- Modify: `workers/test/routes.test.ts`
- Modify: `src/app/components/today/Today.tsx` (copy only)

### Step 1 — Write the failing test

```ts
describe('coverage counts function words', () => {
  // One ayah: two rooted words (both known) and one function word (not known).
  // Under the old model this ayah is "100% readable". It is not.
  function seedOneAyah(h: ReturnType<typeof harness>) {
    const ins = h.db.prepare(
      `INSERT INTO quran_word_morphology
         (surah_id, ayah_id, word_index, segment_index, form, lemma, root, pos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    ins.run(1, 1, 1, 1, 'kitaAb', 'kitaAb', 'ktb', 'N');
    ins.run(1, 1, 2, 1, 'Ealima', 'Ealima', 'Elm', 'V');
    ins.run(1, 1, 3, 1, 'min', 'min', null, 'P');
    h.db.prepare(`INSERT INTO user_known_root (user_id, root) VALUES (?, ?)`)
      .run(TEST_USER, 'ktb');
    h.db.prepare(`INSERT INTO user_known_root (user_id, root) VALUES (?, ?)`)
      .run(TEST_USER, 'Elm');
  }

  it('does NOT count an ayah readable while its function word is unknown', async () => {
    const h = harness();
    try {
      seedOneAyah(h);
      const { body } = await h.json<{ data: any }>('/api/progress/coverage');
      // Every rooted word is known, but `min` is not.
      expect(body.data.ayahsReadable).toBe(0);
      expect(body.data.functionWordsKnown).toBe(0);
      expect(body.data.functionWordsTotal).toBe(1);
    } finally {
      h.close();
    }
  });

  it('counts it once the function word is known too', async () => {
    const h = harness();
    try {
      seedOneAyah(h);
      h.db.prepare(
        `INSERT INTO user_known_function_word (user_id, lemma, pos) VALUES (?, ?, ?)`
      ).run(TEST_USER, 'min', 'P');

      const { body } = await h.json<{ data: any }>('/api/progress/coverage');
      expect(body.data.ayahsReadable).toBe(1);
      expect(body.data.functionWordsKnown).toBe(1);
    } finally {
      h.close();
    }
  });

  it('reports the function-word dimension in the basis string', async () => {
    const h = harness();
    try {
      seedOneAyah(h);
      const { body } = await h.json<{ basis: string }>('/api/progress/coverage');
      // The old string promised unrooted words "count as known". That is now false,
      // and a stale basis line is a lie the UI repeats verbatim.
      expect(body.basis).not.toMatch(/count as known/i);
      expect(body.basis).toMatch(/function word/i);
    } finally {
      h.close();
    }
  });

  it('marking a function word known unlocks ayahs (delta is reported)', async () => {
    const h = harness();
    try {
      seedOneAyah(h);
      const post = await h.json<{ data: any }>(
        '/api/progress/function-words/min/P/known',
        { method: 'POST' }
      );
      // Same payoff shape the roots endpoint already returns.
      expect(post.body.data.ayahsUnlocked).toBe(1);
      expect(post.body.data.ayahsReadable).toBe(1);
    } finally {
      h.close();
    }
  });
});
```

### Step 2 — Run and SEE THEM FAIL

```bash
cd workers && npx vitest run test/routes.test.ts -t "coverage counts function words"
```
Expected: **4 failing**. Test 1 fails with `ayahsReadable === 1` (the bug), tests 2-4
fail on missing fields.

### Step 3 — Implement

**3a.** Replace the `ayahsReadable()` helper (around line 141) so both dimensions gate:

```ts
/**
 * Ayahs where every rooted word AND every function word is known.
 *
 * The function-word half is not a refinement. 27,462 of 77,429 word tokens carry no
 * root, and the old query counted all of them as known — so "fully readable" was
 * asserted over 64.5% of the text and assumed for the rest.
 */
async function ayahsReadable(db: Database, userId: string): Promise<number> {
  const row = await db.get<{ n: number }>(
    `WITH known AS (SELECT root FROM user_known_root WHERE user_id = ?),
          known_fw AS (
            SELECT lemma, pos FROM user_known_function_word WHERE user_id = ?
          )
     SELECT COUNT(*) AS n FROM (
       SELECT surah_id, ayah_id
         FROM quran_word_morphology
        GROUP BY surah_id, ayah_id
       HAVING SUM(CASE WHEN root IS NOT NULL
                        AND root NOT IN (SELECT root FROM known)
                       THEN 1 ELSE 0 END) = 0
          AND SUM(CASE WHEN root IS NULL
                        AND lemma IS NOT NULL AND lemma <> '' AND pos IS NOT NULL
                        AND NOT EXISTS (
                              SELECT 1 FROM known_fw f
                               WHERE f.lemma = quran_word_morphology.lemma
                                 AND f.pos = quran_word_morphology.pos)
                       THEN 1 ELSE 0 END) = 0
     )`,
    [userId, userId]
  );
  return row?.n ?? 0;
}
```

**3b.** In the `/coverage` handler, replace the big query's `ayah_state` CTE and add the
two new counts:

```ts
      `WITH known AS (
         SELECT root FROM user_known_root WHERE user_id = ?
       ),
       known_fw AS (
         SELECT lemma, pos FROM user_known_function_word WHERE user_id = ?
       ),
       ayah_state AS (
         SELECT surah_id, ayah_id,
                SUM(CASE WHEN root IS NOT NULL
                          AND root NOT IN (SELECT root FROM known)
                         THEN 1 ELSE 0 END) AS unknown_rooted,
                SUM(CASE WHEN root IS NULL
                          AND lemma IS NOT NULL AND lemma <> '' AND pos IS NOT NULL
                          AND NOT EXISTS (
                                SELECT 1 FROM known_fw f
                                 WHERE f.lemma = quran_word_morphology.lemma
                                   AND f.pos = quran_word_morphology.pos)
                         THEN 1 ELSE 0 END) AS unknown_fn
         FROM quran_word_morphology
         GROUP BY surah_id, ayah_id
       )
       SELECT
         (SELECT COUNT(*) FROM ayah_state
           WHERE unknown_rooted = 0 AND unknown_fn = 0)               AS ayahs_readable,
         (SELECT COUNT(*) FROM ayah_state)                            AS ayahs_total,
         (SELECT COUNT(*) FROM known)                                 AS roots_known,
         (SELECT COUNT(DISTINCT root) FROM quran_word_morphology
           WHERE root IS NOT NULL)                                    AS roots_total,
         (SELECT COUNT(*) FROM known_fw)                              AS fn_known,
         (SELECT COUNT(*) FROM (
            SELECT 1 FROM quran_word_morphology
             WHERE root IS NULL AND lemma IS NOT NULL AND lemma <> ''
               AND pos IS NOT NULL
             GROUP BY lemma, pos))                                    AS fn_total,
         (SELECT COUNT(*) FROM quran_word_morphology
           WHERE root IN (SELECT root FROM known))                    AS segments_known,
         (SELECT COUNT(*) FROM quran_word_morphology
           WHERE root IS NOT NULL)                                    AS segments_rooted,
         (SELECT COUNT(*) FROM (
            SELECT surah_id FROM ayah_state
            GROUP BY surah_id
            HAVING SUM(unknown_rooted) = 0 AND SUM(unknown_fn) = 0))  AS surahs_readable`,
      [userId, userId]
```

**3c.** Add the two fields to the response `data` object and replace `basis`:

```ts
        functionWordsKnown: row.fn_known,
        functionWordsTotal: row.fn_total,
```

```ts
      basis:
        'An ayah counts as readable when every rooted word has a known root AND every ' +
        'function word (particles, pronouns, negations — 35.5% of the text, and the ' +
        'part that carries the syntax) is known. There are 215 function words ' +
        '(counted per part of speech); the top 50 cover 94% of their occurrences.',
```

**3d.** Make the POST handler report the delta. In
`progressRoutes.post('/function-words/:lemma/:pos/known')`, wrap the insert exactly as
the roots handler does:

```ts
    const before = await ayahsReadable(db, userId);
    await db.run(
      `INSERT OR IGNORE INTO user_known_function_word (user_id, lemma, pos)
       VALUES (?, ?, ?)`,
      [userId, lemma, pos]
    );
    const after = await ayahsReadable(db, userId);

    return c.json({
      data: {
        lemma,
        pos,
        occurrences: exists.n,
        ayahsUnlocked: after - before,
        ayahsReadable: after,
        ayahsTotal: 6236,
      },
    });
```

**3e.** Update the learner-facing copy in `src/app/components/today/Today.tsx`. Two
edits, both text-only:

- The paragraph at the bottom of the coverage card currently ends with a claim that is
  now false. Replace the sentence *"An ayah counts once every rooted word in it has a
  root you know."* with:

  > An ayah counts once you know every word in it — both the roots and the function
  > words (من، في، الذي، إن). Function words are 35.5% of the text and were previously
  > assumed known, so this number is lower than it used to be and truer than it was.
  > 63 roots cover half the rooted words, and the 50 commonest function words cover
  > 94% of the rest.

- Add a fifth stat to the grid array, after `Words met`:

```tsx
              {
                label: 'Function words',
                value: coverage.functionWordsKnown.toLocaleString(),
                sub: `of ${coverage.functionWordsTotal} · top 50 = 94%`,
              },
```

  Add the two fields to the `Coverage` interface at the top of the file:

```ts
  functionWordsKnown: number;
  functionWordsTotal: number;
```

  The grid is `grid-cols-2 sm:grid-cols-4` and now has five items; change it to
  `sm:grid-cols-5` so the last cell does not orphan onto its own row.

### Step 4 — Verify

```bash
cd workers && npx vitest run test/routes.test.ts -t "coverage counts function words"  # 4 pass
cd workers && npx vitest run                                                          # full suite
cd /home/fjallouli/workspace/languagebuilder
node scripts/gen-design-system.mjs --check
cd src/app && npm run build
```

**Reachability check** (this repo's Definition of Done — a build is not proof):

```bash
cd /home/fjallouli/workspace/languagebuilder
grep -n "functionWordsKnown" src/app/components/today/Today.tsx   # must appear
grep -rn "components/today/Today" src/app/app/today/page.tsx      # proves it is routed
```

### Step 5 — Commit

```bash
git add workers/src/routes/progress.ts workers/test/routes.test.ts src/app/components/today/Today.tsx
git commit -m "fix(coverage): count function words — 35.5% of tokens were assumed known"
```

### The SQL in 3a/3b was executed before being written here

Do not rewrite it speculatively. It was run against a copy of the real dev database
(128,219 morphology rows) and returned:

```
ayahs_readable=2511  ayahs_total=6236  fn_known=50  fn_total=215  surahs_readable=1
```
for a learner with the top 400 roots and top 50 function-word pairs. The correlated
`NOT EXISTS` referencing the un-aliased `quran_word_morphology.lemma` inside an
aggregate **works as written** — that is the form that was tested.

If you do hit a parser error, alias the table in the CTE (`FROM quran_word_morphology m`)
and use `m.lemma` / `m.pos` in the subquery. Do **not** switch to `NOT IN` with a
two-column tuple; SQLite does not support row values there in the version D1 ships.

### Expected full-corpus behaviour after this change

Against the seeded dev DB, `fn_total` is **215** and a 400-root learner drops from
3,044 readable ayahs to 2,511 once the top 50 function words are known — and to 244
with none known. If you see 3,044 unchanged after implementing, the function-word
clause is not firing: check that `pos IS NOT NULL` is not filtering everything, and
that you passed `userId` **twice** in the params array.

---

# TASK 4 — `KIND_LABELS` renders 10 kinds as raw database enums

**Objective:** a small, visible bug, isolated from the coverage work. Do this one when
you want a quick clean commit.

**The bug.** `src/app/app/progress/page.tsx` has a `KIND_LABELS` map whose own comment
says it exists so raw enums do not leak into the UI — *"showing those to a learner would
be leaking a column name into the UI"*. I ran the Task 4 eval below against the current
tree; it reports **18 unlabelled kinds**:

```
subject_agreement · definiteness · mood · voice · negation · word_role
relative_pronoun · demonstrative · conditional · sentence_type · mubtada_khabar
subject_word · object · idafa · derived_noun · fronting · jinas · simile
```

Each of those renders as a raw database enum on the learner's main diagnostic screen.

**This also resolves the "25 vs 17" doc confusion.** `ExerciseRunner` offers **25**
selectable kinds; the bank currently holds rows for **17** of them; `KIND_LABELS` names
**7** (plus 3 lesson modules). AGENTS.md's "25 kinds" describes the *filter list*, not
the bank. All three numbers are real and they describe different things — say so rather
than picking one and overwriting the others.

The labels already exist in `ExerciseRunner`'s `KINDS` array. The two files simply
drifted, which is exactly what the comment *"Mirrors the list in ExerciseRunner so both
screens name a kind the same way"* was supposed to prevent.

Verified kind counts in the dev DB:

```
aspect 3000 · case_ending 3000 · definiteness 3000 · pos_id 3000 · subject_agreement 3000
root_id 2400 · mood 2298 · jinas 1707 · verb_form 1670 · word_role 1272
demonstrative 769 · relative_pronoun 665 · negation 651 · voice 539
conditional 401 · sentence_type 252 · simile 58            (17 kinds, 38,995 total)
```

### Files
- Create: `scripts/check-kind-labels.mjs`
- Modify: `src/app/app/progress/page.tsx`

### Step 1 — Write the failing eval

Create `scripts/check-kind-labels.mjs`:

```js
#!/usr/bin/env node
// Every exercise kind the UI can display must have a human label.
//
// KIND_LABELS drifted to 7 while the bank grew to 17, so ten kinds rendered as raw
// column values on /progress. gen-content-manifest gates the exercise TOTAL but not
// the kind list, so nothing caught it.
//
// Source of truth is ExerciseRunner's KINDS array: it is the filter the learner picks
// from, so any kind selectable there must be nameable on /progress.

import { readFileSync } from 'node:fs';

const RUNNER = 'src/app/components/grammar/ExerciseRunner.tsx';
const PROGRESS = 'src/app/app/progress/page.tsx';

const runner = readFileSync(RUNNER, 'utf-8');
const progress = readFileSync(PROGRESS, 'utf-8');

const kinds = [...runner.matchAll(/\{\s*value:\s*'([a-z_]+)'/g)]
  .map((m) => m[1])
  .filter((k) => k.length > 0);

// Scoped to the KIND_LABELS block rather than the whole file. A loose scan for
// `  key: '` would also pick up any other 2-space-indented object literal, and would
// break the moment someone reformatted the map.
const block = progress.match(/const KIND_LABELS[^=]*=\s*\{(.*?)\n\};/s);
if (!block) {
  console.error(`✗ could not find the KIND_LABELS map in ${PROGRESS}`);
  process.exit(1);
}
const labelled = new Set([...block[1].matchAll(/([a-z_]+)\s*:\s*['"]/g)].map((m) => m[1]));

const missing = kinds.filter((k) => !labelled.has(k));

if (kinds.length === 0) {
  console.error(`✗ parsed no kinds from ${RUNNER} — the regex or the file shape changed`);
  process.exit(1);
}

if (missing.length > 0) {
  console.error(`✗ ${missing.length} exercise kind(s) have no label in ${PROGRESS}:`);
  for (const k of missing) console.error(`    ${k}`);
  console.error('  These render as raw database enums on the progress screen.');
  process.exit(1);
}

console.log(`✅ all ${kinds.length} exercise kinds have labels`);
```

### Step 2 — Run and SEE IT FAIL

```bash
cd /home/fjallouli/workspace/languagebuilder
node scripts/check-kind-labels.mjs
```
Expected: **FAIL**, listing exactly 18 unlabelled kinds (verified — the regexes above
parse 25 kinds from `ExerciseRunner` and 10 labels from `progress/page.tsx` on the
current tree). If it reports a different count, the files changed since this was
written; trust the script, not this number.

### Step 3 — Implement

In `src/app/app/progress/page.tsx`, extend `KIND_LABELS` so every kind in
`ExerciseRunner`'s `KINDS` has an entry. **Copy the label text from `ExerciseRunner`
verbatim** — the whole point is that the two screens name a kind identically. Also fix
the stale comment: it says *"the seven exercise kinds"*; the bank has 17.

### Step 4 — Verify

```bash
node scripts/check-kind-labels.mjs      # ✅
cd src/app && npm run build
```

### Step 5 — Commit

```bash
git add scripts/check-kind-labels.mjs src/app/app/progress/page.tsx
git commit -m "fix(progress): label all 17 exercise kinds; add a gate so they cannot drift"
```

---

# TASK 5 — Homograph drill: which `maA` is this?

**Objective:** the first exercise kind that trains *parsing under ambiguity* rather than
recall. Same corpus, no new data.

**Why this one matters.** Telling identical spellings apart in context is exactly the
skill that separates a reader from a decoder, and the corpus already labels the answer
in `pos`. Deliberate confusion-pairing is established drill design (the same principle
as mutashabihat in hifz).

**Measured homograph families** (run against the dev DB — `lemma`s with 2+ parts of
speech and at least 20 occurrences in the minority sense):

```
maA      7 senses, 2,565 total : REL 1476 · NEG 705 · PREV 162 · INTG 95 · SUB 83 · COND 23 · SUP 21
laA      2 senses, 1,738       : NEG 1406 · PRO 332
{l~a*iY  2 senses, 1,464       : REL 1442 · COND 22
man      3 senses,   871       : REL 650 · COND 184 · INTG 37
>an      2 senses,   625       : SUB 578 · INT 47
Hat~aY`  2 senses,   142       : P 95 · INC 47
lawolaA^ 2 senses,    75       : EXH 40 · COND 35
```

Note `maA` has **seven** attested roles, not two. Do not hardcode a two-way choice.

### Files
- Create: `scripts/gen-homograph-exercises.mjs`
- Modify: `workers/test/routes.test.ts`

### Step 1 — Write the failing eval

The generator must be idempotent and self-checking, matching the other `gen-*` scripts:
running with `--check` fails if the database contents disagree with what the generator
would produce.

Add to `workers/test/routes.test.ts`:

```ts
describe('homograph exercises', () => {
  it('serves homograph items with all options sharing one spelling', async () => {
    const h = harness();
    try {
      // Column list verified against the live schema. grammar_exercise_bank requires
      // word_arabic, explanation, word_index and segment_index — all NOT NULL — and
      // there is no `source` column. UNIQUE(kind,surah,ayah,word_index,segment_index).
      h.db.prepare(
        `INSERT INTO grammar_exercise_bank
           (id, kind, level, word_arabic, word_buckwalter, prompt, answer, options,
            explanation, surah_id, ayah_id, word_index, segment_index)
         VALUES (?, 'homograph', 3, ?, 'maA', ?, 'REL', ?, ?, 2, 3, 4, 1)`
      ).run(
        'hom-test-1',
        'مَا',
        'In this ayah, what job does مَا do?',
        JSON.stringify(['REL', 'NEG']),
        'Here مَا introduces a relative clause rather than negating the verb.'
      );

      const { status, body } = await h.json<{ data: { exercises: any[] } }>(
        '/api/grammar/exercises?kind=homograph'
      );
      expect(status).toBe(200);
      expect(body.data.exercises.length).toBeGreaterThan(0);
      const ex = body.data.exercises[0];
      expect(ex.options).toContain(ex.answer);
      // A homograph item is only a homograph item if the distractor is the SAME
      // spelling in a different role.
      expect(ex.options.length).toBeGreaterThanOrEqual(2);
    } finally {
      h.close();
    }
  });
});
```

Run it — it should **fail** only if `grammar_exercise_bank` rejects `kind='homograph'`
or the route filters unknown kinds. If it passes immediately, the route is generic and
the real eval is the generator check below; say so and move on rather than inventing a
failure.

### Step 2 — The generator

Create `scripts/gen-homograph-exercises.mjs`. Model it on the existing
`scripts/gen-syntax-exercises.mjs` — **read that file first** and copy its structure:
argument handling (`--check`), SHA/source pinning, and the "emit only where the data is
unambiguous" rule.

Required behaviour:

1. Find every `lemma` that appears with **two or more distinct `pos` values** and at
   least 20 occurrences in the minority sense — the seven families listed above. Derive
   them with a query, do not hardcode the list; then assert the query returns exactly
   those seven so a corpus change is visible rather than silent.
2. For each, emit items: show the **ayah text** with the target word marked, ask which
   role it plays, options = the attested `pos` values **for that lemma** (so a `maA`
   item can have up to 7 options; cap the option list at 4 by always including the
   correct answer plus the 3 commonest other senses).
3. `level`: 3 for a two-way family, 4 for three-or-more.
4. **Skip any ayah where the same lemma appears twice in different roles** — the prompt
   could not identify which occurrence it means.
5. Cap at 40 items per family so the bank stays balanced; select by spreading across
   surahs, not the first 40 rows.
6. `--check` mode: recompute and compare against the DB; exit 1 on drift, and **say
   explicitly when the corpus file is absent** rather than passing silently (this repo
   already has that convention — see the note in `AGENTS.md` about `check-content` and
   `gen-root-lessons` degrading to structural checks).

### Step 3 — Verify

```bash
node scripts/gen-homograph-exercises.mjs           # generates
node scripts/gen-homograph-exercises.mjs --check   # ✅
node scripts/gen-content-manifest.mjs --check      # totals still agree
cd workers && npx vitest run test/routes.test.ts -t "homograph"
```

Then **add the kind to the UI** or it is unreachable:
- `src/app/components/grammar/ExerciseRunner.tsx` → add to `KINDS`
- `src/app/app/progress/page.tsx` → add to `KIND_LABELS`
- `node scripts/check-kind-labels.mjs` must still pass (Task 4's gate now protects you)

### Step 4 — Commit

```bash
git add scripts/gen-homograph-exercises.mjs workers/test/routes.test.ts src/app/components/grammar/ExerciseRunner.tsx src/app/app/progress/page.tsx
git commit -m "feat(exercises): homograph drill — which maA is this"
```

---

# TASK 6 — Typed recall in the main hifz review

**Objective:** stop feeding FSRS a self-report. Measure the recitation, then grade.

**This is almost entirely wiring — read this before writing code.** Every piece already
exists:

| Piece | Where | Status |
|---|---|---|
| `gradeRecall(expected, given)` → `{accuracy, missed[], ...}` | `src/app/lib/arabic-compare.ts:77` | written, word-level, handles Uthmani spelling variants |
| `gradeFromAccuracy(accuracy)` → FSRS grade | `workers/src/lib/space-repetition.ts:221` | written, asymmetric bands |
| A typed-recall UI | `components/memorization/AdvancedMemorizationTools.tsx:87` | written, uses `gradeRecall` |
| The main review flow | `components/memorization/ReviewSession.tsx:29-33` | **self-graded — uses none of the above** |

So the single most valuable screen in the app is behind an "Advanced" label, and the
default path asks the learner to rate their own memory. Karpicke & Roediger (2008) is
the reason that matters: learners' predictions of their own retention were
*uncorrelated* with actual retention, and all four of their conditions felt identical
during learning while differing 80% vs 33% a week later.

**Design decision (do not deviate):** typed recall becomes the *default* path, and the
four self-grade buttons remain as an explicit **"I recited it aloud instead"** fallback.
Do not delete self-grading — recitation aloud without typing is legitimate practice, and
a hifz app that forces typing on a phone will be abandoned. Measure when you can; fall
back honestly when you cannot.

### Files
- Modify: `src/app/components/memorization/ReviewSession.tsx`
- Modify: `workers/src/routes/memorization.ts` (accept an accuracy on `/review`)
- Modify: `workers/test/routes.test.ts`
- Modify: `workers/test/grading.test.ts`

### Step 1 — Write the failing tests

In `workers/test/grading.test.ts` — pin the mapping the route will rely on:

```ts
describe('accuracy drives the FSRS grade', () => {
  it('maps measured accuracy onto the four grades', () => {
    expect(gradeFromAccuracy(0.30)).toBe('again');
    expect(gradeFromAccuracy(0.65)).toBe('hard');
    expect(gradeFromAccuracy(0.90)).toBe('good');
    expect(gradeFromAccuracy(1.00)).toBe('easy');
  });
});
```

In `workers/test/routes.test.ts`:

```ts
describe('memorization review accepts a measured accuracy', () => {
  function seedEntry(h: ReturnType<typeof harness>, id = 'mem-1') {
    h.db.prepare(
      `INSERT INTO memorization (id, user_id, surah_id, ayah_from, ayah_to, status)
       VALUES (?, ?, 112, 1, 4, 'learning')`
    ).run(id, TEST_USER);
    return id;
  }

  it('grades from accuracy when one is supplied', async () => {
    const h = harness();
    try {
      const id = seedEntry(h);
      const { status, body } = await h.json<{ data: any }>(
        `/api/memorization/${id}/review`,
        { method: 'POST', body: JSON.stringify({ accuracy: 0.35 }) }
      );
      expect(status).toBe(200);
      // 0.35 is a lapse, so the schedule must come back to today.
      expect(body.data.grade).toBe('again');
      expect(body.data.interval).toBe(0);
    } finally {
      h.close();
    }
  });

  it('still accepts an explicit grade (recited aloud, not typed)', async () => {
    const h = harness();
    try {
      const id = seedEntry(h);
      const { status, body } = await h.json<{ data: any }>(
        `/api/memorization/${id}/review`,
        { method: 'POST', body: JSON.stringify({ grade: 'good' }) }
      );
      expect(status).toBe(200);
      expect(body.data.grade).toBe('good');
    } finally {
      h.close();
    }
  });

  it('rejects an out-of-range accuracy rather than silently clamping', async () => {
    const h = harness();
    try {
      const id = seedEntry(h);
      const { status } = await h.json(`/api/memorization/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ accuracy: 1.4 }),
      });
      expect(status).toBe(400);
    } finally {
      h.close();
    }
  });

  it('records which grading path was used', async () => {
    const h = harness();
    try {
      const id = seedEntry(h);
      const { body } = await h.json<{ data: any }>(`/api/memorization/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ accuracy: 0.95 }),
      });
      // A schedule built from a measurement and one built from an opinion are not
      // the same evidence, and later analysis needs to tell them apart.
      expect(body.data.gradedFrom).toBe('accuracy');
    } finally {
      h.close();
    }
  });
});
```

Run: `cd workers && npx vitest run test/routes.test.ts -t "measured accuracy"` →
**4 failing**.

### Step 2 — Implement the route

In `workers/src/routes/memorization.ts`, the `POST /:id/review` handler currently
requires `grade`. Accept **either**:

```ts
    const body = await c.req.json();
    const hasAccuracy = body.accuracy !== undefined;

    let grade: Grade;
    if (hasAccuracy) {
      // Reject rather than clamp: an accuracy outside 0..1 means the caller computed
      // it wrongly, and silently clamping would bury that in a plausible schedule.
      if (
        typeof body.accuracy !== 'number' ||
        Number.isNaN(body.accuracy) ||
        body.accuracy < 0 ||
        body.accuracy > 1
      ) {
        return c.json({ error: 'accuracy must be a number between 0 and 1' }, 400);
      }
      grade = gradeFromAccuracy(body.accuracy);
    } else {
      if (!isGrade(body.grade)) {
        return c.json({ error: `grade must be one of ${GRADE_VALUES.join(', ')}` }, 400);
      }
      grade = body.grade;
    }
```

Return `grade` and `gradedFrom: hasAccuracy ? 'accuracy' : 'self'` in the response
`data`, alongside the existing schedule fields. Import `gradeFromAccuracy` from
`../lib/space-repetition` (it is already exported).

### Step 3 — Implement the UI

In `ReviewSession.tsx`:

1. Default to a **typed recall** step: show the ayah reference (surah + ayah range) and
   a textarea, **not** the text itself. Revealing the text first makes it a reading
   exercise.
2. On submit, call `gradeRecall(expectedText, typed)` from `@/lib/arabic-compare`, then
   `POST /api/memorization/:id/review` with `{ accuracy: result.accuracy }`.
3. Show the diff — `result.missed` holds indices into the expected word list, so
   highlight exactly which words were wrong. This is the feedback the four buttons
   could never give.
4. Keep the four grade buttons behind a secondary control labelled
   **"I recited it aloud"**, posting `{ grade }` as today.

Use the existing `Input`/`Button`/`Card` components. Arabic input needs
`dir="rtl" lang="ar"` and the `text-naskh` class per the design rules in `AGENTS.md`.

### Step 4 — Verify

```bash
cd workers && npx vitest run                       # whole suite green
cd /home/fjallouli/workspace/languagebuilder
node scripts/gen-api-docs.mjs --check
cd src/app && npm run build
grep -n "gradeRecall" src/app/components/memorization/ReviewSession.tsx   # must appear
```

### Step 5 — Commit

```bash
git add workers/src/routes/memorization.ts workers/test/ src/app/components/memorization/ReviewSession.tsx
git commit -m "feat(hifz): grade review from measured recall, not self-report"
```

---

# TASK 7 — Tashkil production items

**Objective:** the first item type where the learner **produces** Arabic instead of
recognising it. Reverse an existing function and you have an exercise over 77,429 words.

`normaliseArabic()` in `workers/src/lib/tutor-grounding.ts` already strips diacritics
(carefully — by codepoint arithmetic, with a comment explaining that inline Arabic
ranges have repeatedly swallowed the letters themselves in this repo). Strip the
harakat from an ayah, ask the learner to restore them, compare against the Uthmani
original. The answer key is the text itself.

**Scope this task to case endings only, not full vowelling.** Full tashkil of a whole
ayah is a punishing first rung and the grading is noisy. Restrict to the **final**
diacritic of each word — that is the i'rab, which is the actual skill.

### Files
- Create: `workers/src/lib/tashkil.ts`
- Create: `workers/test/tashkil.test.ts`
- Modify: `workers/src/routes/grammar.ts` (serve the items)

### Step 1 — Write the failing unit tests

`workers/test/tashkil.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stripFinalHarakat, gradeTashkil } from '../src/lib/tashkil';

describe('stripFinalHarakat', () => {
  it('removes only the final diacritic, keeping internal vowels', () => {
    // الْحَمْدُ -> الْحَمْد : internal sukun/fatha stay, the final damma goes.
    const out = stripFinalHarakat('الْحَمْدُ');
    expect(out).not.toMatch(/ُ$/);
    expect(out).toMatch(/َ/); // the internal fatha survives
  });

  it('leaves a word that has no final diacritic unchanged', () => {
    expect(stripFinalHarakat('مِنْ')).toBe('مِنْ');
  });
});

describe('gradeTashkil', () => {
  it('accepts the exact ending', () => {
    expect(gradeTashkil('الْحَمْدُ', 'الْحَمْدُ').correct).toBe(true);
  });

  it('rejects the wrong case', () => {
    // damma (nominative) vs fatha (accusative) is the whole point.
    expect(gradeTashkil('الْحَمْدُ', 'الْحَمْدَ').correct).toBe(false);
  });

  it('reports which words were wrong', () => {
    const r = gradeTashkil('الْحَمْدُ لِلَّهِ', 'الْحَمْدَ لِلَّهِ');
    expect(r.missed).toEqual([0]);
    expect(r.accuracy).toBeCloseTo(0.5);
  });
});
```

Run: `cd workers && npx vitest run test/tashkil.test.ts` → **FAIL**, module not found.

### Step 2 — Implement `workers/src/lib/tashkil.ts`

Rules:
- Reuse the codepoint approach from `normaliseArabic` — **do not write an inline Arabic
  character class**; that mistake has already cost this repo a bug where every word
  normalised to the empty string.
- Harakat codepoints to treat as "final diacritic": fatha `U+064E`, damma `U+064F`,
  kasra `U+0650`, sukun `U+0652`, and the tanwin `U+064B`–`U+064D`. Shadda `U+0651`
  may precede the final vowel — keep the shadda, strip the vowel after it.
- `gradeTashkil(expected, given)` returns `{ correct, accuracy, missed[] }`, the same
  shape `gradeRecall` returns, so the UI can share rendering.

### Step 3 — Serve the items

Add `GET /api/grammar/tashkil?surah=&ayah=` to `workers/src/routes/grammar.ts`,
returning the stripped text plus per-word metadata (`case_case` from
`quran_word_morphology`, so the explanation can name *why* the ending is what it is).

Add a route test asserting the endpoint never returns the answer key in the same
payload as the prompt.

### Step 4 — Verify

```bash
cd workers && npx vitest run test/tashkil.test.ts   # pass
cd workers && npx vitest run                        # suite green
node scripts/gen-api-docs.mjs && node scripts/gen-api-docs.mjs --check
```

### Step 5 — Commit

```bash
git add workers/src/lib/tashkil.ts workers/test/tashkil.test.ts workers/src/routes/grammar.ts AGENTS.md
git commit -m "feat(grammar): tashkil production items — restore the case endings"
```

**UI note (separate commit, after this one):** typing Arabic diacritics is impossible on
most keyboards. The input must be a **tap palette** — fatha / damma / kasra / sukun /
tanwin buttons applied to a selected word — not a text field. If you build the text
field version, learners will abandon it and the most important item type in the plan
dies. Build the palette or leave the UI for a later task.

---

# TASK 8 — Freeflow reading band

**Objective:** the missing half of the reading loop. Bayan has the effortful i+1 band
("Just past your edge") and nothing for building **speed**.

Refold names "only mining, never freeflowing" as a top-3 learner mistake: a learner who
only ever does hard work stays slow forever. Reading a run of ayat you already know, at
pace, with audio, is the automaticity drill.

### Files
- Modify: `workers/src/routes/progress.ts`
- Modify: `workers/test/routes.test.ts`
- Modify: `src/app/components/today/Today.tsx`

### Step 1 — The eval

```ts
describe('freeflow band', () => {
  it('returns only contiguous runs at or above the coverage threshold', async () => {
    // Seed a surah where ayahs 1-3 are fully known and ayah 4 is not.
    // The run must be 1-3, and must not silently include 4.
    // ... (seed via quran_word_morphology + user_known_root as in earlier tasks)
    const { status, body } = await h.json<{ data: { runs: any[] } }>(
      '/api/progress/freeflow?minWords=3'
    );
    expect(status).toBe(200);
    expect(body.data.runs[0]).toMatchObject({ surah: 1, ayahFrom: 1, ayahTo: 3 });
  });
});
```

### Step 2 — Implement `GET /api/progress/freeflow`

Return **contiguous runs** of ayat at >=98% known words (rooted *and* function — this
task depends on Task 3), longest first, with total word count so the UI can say "about
90 seconds". Contiguity is the point: scattered single ayat are not reading.

### Step 3 — Surface it on Today

Add a fourth card to the "Then" section, linking to `/read` in a continuous mode with
audio autoplay. Copy: *"Read a page you already know — at speed, no lookups. This is
where reading gets fast."*

### Step 4 — Verify + commit

```bash
cd workers && npx vitest run
node scripts/gen-api-docs.mjs && node scripts/gen-api-docs.mjs --check
cd src/app && npm run build
git commit -m "feat(read): freeflow band — contiguous runs above the 98% threshold"
```

---

## Appendix — the failure modes most likely to bite

1. **Keying function words on lemma alone.** `maA` is seven different words. Task 1's
   test exists specifically to catch this.
2. **"Fixing" the coverage drop.** It is supposed to drop. 3,044 → 2,511 at 400 roots.
3. **Editing an orphaned component.** `components/onboarding/Onboarding.tsx`,
   `components/layout/Sidebar.tsx` and `components/layout/MobileNav.tsx` are **not
   imported by any route**. Trace the import chain from `app/<route>/page.tsx` before
   editing any component, per this repo's Definition of Done.
4. **Trusting a green build.** A build proves compilation, not behaviour. Every task
   here ends with a grep or a test, not a build.
5. **Writing an inline Arabic regex character class.** Use codepoint arithmetic, as
   `normaliseArabic` does. This has already caused a real bug in this repo.
6. **Skipping `gen-api-docs.mjs --check`.** Adding an endpoint without regenerating
   fails CI, and the failure message is not obvious.
