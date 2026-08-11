#!/usr/bin/env node
/**
 * Record what was actually ingested, so the numbers in prose can be gated.
 *
 *   node scripts/gen-content-manifest.mjs           # write content/derived-manifest.json
 *   node scripts/gen-content-manifest.mjs --check   # fail if docs disagree with it
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 *
 * "4,950 derived exercises" was written into six places — two gates, two docs, the
 * README and a component — and every one had to be edited by hand when the number
 * changed. That is the same hazard as the endpoint list, the design tokens, the test
 * count and the README status table, all of which are now generated.
 *
 * The counts cannot come from the repo, because the exercise bank lives in D1 and the
 * generated SQL is transient. So they come from the database that was actually loaded,
 * and are committed here as a record. `--check` then holds the prose to it.
 *
 * The manifest is the claim; the database is the source. If they disagree, regenerate
 * rather than editing the manifest, because the number in a doc should describe what
 * shipped and not what someone hoped had shipped.
 */

import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const OUT = join(root, 'content/derived-manifest.json');

/**
 * Files that state the bank's total size and must therefore stay current.
 *
 * docs/CONTENT-AND-CORPUS-2026-07-26.md is deliberately absent. It is a DATED record of
 * what was true that day — "150 per bucket, 3,750 derived" — and rewriting those figures
 * to today's would falsify a historical document rather than fix a stale one.
 */
const CONSUMERS = [
  'README.md',
  'AGENTS.md',
  'scripts/gen-api-docs.mjs',
  'scripts/gen-design-system.mjs',
  'src/app/components/grammar/ExerciseRunner.tsx',
  // Added after its header sat at 4,950 through five bank regenerations. It was never
  // caught because the phrasing — "holds 4,950, every one traceable" — matched no pattern
  // here, which is the argument for listing a file rather than trusting that prose about
  // the bank only lives where you remember putting it.
  'src/app/lib/lesson-practice.ts',
];

async function localDbPath() {
  const dir = join(root, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  const files = await readdir(dir).catch(() => []);
  const sqlite = files.find((f) => f.endsWith('.sqlite'));
  return sqlite ? join(dir, sqlite) : null;
}

if (check) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(OUT, 'utf-8'));
  } catch {
    process.stderr.write(
      '✘ content/derived-manifest.json is missing. Run: node scripts/gen-content-manifest.mjs\n'
    );
    process.exit(1);
  }

  const expected = manifest.exerciseBank.total.toLocaleString('en-US');
  const stale = [];
  for (const rel of CONSUMERS) {
    const src = await readFile(join(root, rel), 'utf-8').catch(() => null);
    if (src === null) continue;
    // Only claims about the WHOLE bank. An earlier version matched any number before
    // "derived", "graded" or "item", which flagged the comprehension subtotal and the
    // per-bucket cap as stale totals — three of its nine findings were numbers that were
    // correct about something else.
    //
    // Whitespace is collapsed first, and that is not cosmetic: the README wraps its prose
    // at 80 columns, so "4,950 derived\n  exercises" put a newline between the number and
    // the word. The pattern required a single space, so the check PASSED on a README that
    // still said 4,950 after the bank tripled — a gate reporting success on the exact
    // drift it exists to catch.
    const flat = src.replace(/\s+/g, ' ');
    const TOTAL_CLAIM = /([\d,]{3,})(?=[- ](?:derived exercises|graded exercises|item graded bank|item bank))/g;
    for (const m of flat.matchAll(TOTAL_CLAIM)) {
      if (m[1] !== expected) stale.push(`${rel}: says ${m[1]}, bank holds ${expected}`);
    }
    // The comprehension subtotal, phrased in the README as "N items from 77,429 word
    // glosses". Checked separately because it is a different number about a different
    // thing, and conflating the two is what let it sit wrong.
    const comprehension = manifest.exerciseBank.comprehension?.toLocaleString('en-US');
    if (comprehension) {
      for (const m of flat.matchAll(/([\d,]{3,}) items from 77,429 word glosses/g)) {
        if (m[1] !== comprehension) {
          stale.push(`${rel}: says ${m[1]} comprehension items, there are ${comprehension}`);
        }
      }
    }
    // The kind count. The total was gated from the start; the kind count was not, and
    // silently drifted once already — KIND_LABELS in progress/page.tsx fell to 7 while
    // the bank grew to 25, and nothing here would have caught the PROSE claim doing the
    // same thing, only the label map (a separate gate, scripts/check-kind-labels.mjs).
    // Scoped to "N kinds" / "N distinct kinds" so it doesn't collide with an unrelated
    // small number that happens to precede the word "kinds" for some other reason.
    const expectedKinds = String(Object.keys(manifest.exerciseBank.byKind).length);
    const KINDS_CLAIM = /(\d{1,3})(?=[- ](?:distinct )?kinds)/g;
    for (const m of flat.matchAll(KINDS_CLAIM)) {
      if (m[1] !== expectedKinds) {
        stale.push(`${rel}: says ${m[1]} kinds, bank holds ${expectedKinds}`);
      }
    }
  }
  if (stale.length > 0) {
    process.stderr.write(
      `✘ ${stale.length} stale exercise count(s):\n` +
        stale.map((s) => `    ${s}\n`).join('') +
        `  The bank holds ${expected}. Update the prose, or regenerate the bank.\n`
    );
    process.exit(1);
  }
  process.stdout.write(
    `✅ derived-content counts agree across ${CONSUMERS.length} files (${expected} exercises)\n`
  );
  process.exit(0);
}

const dbPath = await localDbPath();
if (!dbPath) {
  process.stderr.write(
    '✘ no local D1 database found. Apply migrations and load the derived content first.\n'
  );
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
const byKind = db
  .prepare(`SELECT kind, COUNT(*) AS n FROM grammar_exercise_bank GROUP BY kind ORDER BY kind`)
  .all();
const buckets = db
  .prepare(
    `SELECT COUNT(*) AS n FROM (SELECT kind, level FROM grammar_exercise_bank GROUP BY kind, level)`
  )
  .get();
const total = byKind.reduce((n, r) => n + r.n, 0);
const surahs = db
  .prepare(`SELECT COUNT(DISTINCT surah_id) AS n FROM grammar_exercise_bank`)
  .get();
const units = db.prepare(`SELECT COUNT(*) AS n FROM memorization_units`).get();
const glosses = db.prepare(`SELECT COUNT(*) AS n FROM quran_word_gloss`).get();
const timings = db
  .prepare(`SELECT COUNT(*) AS n FROM quran_word_timing`)
  .get();
db.close();

const manifest = {
  _comment:
    'GENERATED by scripts/gen-content-manifest.mjs from the loaded database. Do not ' +
    'hand-edit: regenerate after ingesting, so the numbers quoted in docs describe ' +
    'what actually shipped.',
  exerciseBank: {
    total,
    // The comprehension half, called out because the README states it separately and
    // that number went stale unnoticed: F4 still said 1,200 after the cap rose to 400
    // per bucket and the real figure became 3,536. The total-only check could not see
    // it, since a subtotal is not the total.
    comprehension: byKind
      .filter((r) => r.kind === 'word_meaning' || r.kind === 'find_word')
      .reduce((n, r) => n + r.n, 0),
    buckets: buckets.n,
    surahsCovered: surahs.n,
    byKind: Object.fromEntries(byKind.map((r) => [r.kind, r.n])),
  },
  memorizationUnits: units.n,
  wordGlosses: glosses.n,
  wordTimings: timings.n,
};

await writeFile(OUT, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
process.stdout.write(
  `wrote content/derived-manifest.json — ${total.toLocaleString('en-US')} exercises across ` +
    `${buckets.n} buckets, ${surahs.n} surahs\n`
);
