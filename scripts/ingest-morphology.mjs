#!/usr/bin/env node
/**
 * Ingest the Quranic Arabic Corpus morphology into D1, one row per SEGMENT.
 *
 *   node scripts/ingest-morphology.mjs --text data/quranic-corpus-morphology-0.4.txt > /tmp/morphology.sql
 *   cd workers && npx wrangler d1 execute languagebuilder --local  --file=/tmp/morphology.sql
 *   cd workers && npx wrangler d1 execute languagebuilder --remote --file=/tmp/morphology.sql
 *
 * Source: https://corpus.quran.com/download/ (version 0.4, Kais Dukes, 2011)
 * Licence: GNU GPL. Attribution with a link to corpus.quran.com is REQUIRED
 * wherever this data is displayed — not merely in this header (plan risk R3).
 *
 * ── What was wrong before ───────────────────────────────────────────────────
 *
 * The location field is (surah:ayah:word:segment). The old parser matched
 *   /\((\d+):(\d+):(\d+):\d+\)/
 * discarding the fourth group, and the table keyed
 * UNIQUE(surah_id, ayah_id, word_index) with INSERT OR IGNORE. So every segment
 * after the first, for each of the 42,093 multi-segment words, was silently
 * dropped — and the survivor was the first, which for a prefixed word is the
 * al-/wa-/bi- particle with no lemma and no root.
 *
 * Measured: 77,429 rows stored of 128,219 segments. 54:1 kept {qotarabati, {l,
 * wa, {lo and lost sāʿah, inshaqqa and qamar. Root 'qmr' was absent from the
 * whole table.
 *
 * It also never captured the derived verb form, which is the single most useful
 * field for pattern drills (F9): 8,977 verbs carry one.
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const textPath = args[args.indexOf('--text') + 1];
const allowUnpinned = args.includes('--allow-unpinned');

const log = (m) => process.stderr.write(m + '\n');

if (!textPath || textPath.startsWith('--')) {
  log('usage: node scripts/ingest-morphology.mjs --text <corpus.txt> [--allow-unpinned]');
  process.exit(1);
}

/**
 * SHA-256 of the version 0.4 file, as mirrored at
 * raw.githubusercontent.com/q-ran/quran/master/sources/1.0/quranic-corpus-morphology-0.4.txt
 * (verified to carry the original Kais Dukes copyright block).
 *
 * Pinned for the same reason as the Quran text: a swapped corpus would not fail
 * loudly, it would silently attach the wrong roots to the wrong words.
 */
const PINNED_SHA256 =
  'a1d12923815341face765083805d2148ed2d9f5cc3f7d6665219d887675d8c46';

/** Segment count in v0.4. A parser regression shows up here immediately. */
const EXPECTED_SEGMENTS = 128219;
/** Segments carrying a ROOT. Note this is 39% of segments, DOWN from the old
 *  table's 42.3% — the denominator now includes prefixes and pronouns, which
 *  legitimately have no root. The absolute count is what matters. */
const EXPECTED_WITH_ROOT = 49968;

const raw = await readFile(textPath, 'utf-8');
const sha = createHash('sha256').update(raw).digest('hex');
log(`source:  ${textPath}`);
log(`         sha256 ${sha}`);

if (sha !== PINNED_SHA256 && !allowUnpinned) {
  log('');
  log('REFUSING TO EMIT — this is not the pinned corpus.');
  log(`  expected ${PINNED_SHA256}`);
  log(`  got      ${sha}`);
  log('');
  log('Roots and lemmas are only meaningful against the exact file they were');
  log('published in. Pass --allow-unpinned to override deliberately.');
  process.exit(3);
}

const LOCATION = /^\((\d+):(\d+):(\d+):(\d+)\)$/;
const ROMAN = /\((I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\)/;

/** Pick the first feature present from a list, else null. */
function pick(features, candidates) {
  for (const c of candidates) {
    if (features.includes(c)) return c;
  }
  return null;
}

const rows = [];
let skipped = 0;

for (const line of raw.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const parts = line.replace(/\r$/, '').split('\t');
  if (parts.length < 4) continue;

  const [location, form, tag, features] = parts;
  const loc = LOCATION.exec(location.trim());
  if (!loc) {
    skipped++;
    continue;
  }

  const [, surah, ayah, word, segment] = loc;

  const lemma = features.match(/LEM:([^|]+)/)?.[1]?.trim() ?? null;
  const root = features.match(/ROOT:([^|]+)/)?.[1]?.trim() ?? null;
  const pos = features.match(/POS:([A-Z]+)/)?.[1] ?? null;
  const verbForm = ROMAN.exec(features)?.[1] ?? null;

  const aspect = pick(features, ['PERF', 'IMPF', 'IMPV']);
  const voice = pick(features, ['PASS', 'ACT']);
  const mood = pick(features, ['SUBJ', 'JUS', 'IND']);
  const state = pick(features, ['INDEF', 'DEF']);
  const caseCase = pick(features, ['NOM', 'ACC', 'GEN']);

  // Person/gender/number arrive fused, e.g. 3FS, 2MP, 1S. Gender and number
  // also appear alone on nouns as |M|, |F|, |MP|.
  let person = null;
  let gender = null;
  let number = null;
  const pgn = features.match(/\|([123])(M|F)?(S|D|P)\|?/);
  if (pgn) {
    person = pgn[1];
    gender = pgn[2] ?? null;
    number = pgn[3];
  }
  if (!gender) {
    const g = features.match(/\|(M|F)(S|D|P)?(?:\||$)/);
    if (g) {
      gender = g[1];
      number = number ?? g[2] ?? null;
    }
  }

  rows.push([
    Number(surah), Number(ayah), Number(word), Number(segment),
    form, tag, lemma, root, pos, verbForm,
    aspect, voice, mood, person, gender, number, caseCase, state,
  ]);
}

log(`parsed:  ${rows.length} segments${skipped ? ` (${skipped} unparseable locations)` : ''}`);

const withRoot = rows.filter((r) => r[7]).length;
const withLemma = rows.filter((r) => r[6]).length;
const withForm = rows.filter((r) => r[9]).length;
log(`         ${withRoot} with a root, ${withLemma} with a lemma, ${withForm} with a verb form`);

const problems = [];
if (rows.length !== EXPECTED_SEGMENTS) {
  problems.push(`expected ${EXPECTED_SEGMENTS} segments, parsed ${rows.length}`);
}
if (withRoot !== EXPECTED_WITH_ROOT) {
  problems.push(`expected ${EXPECTED_WITH_ROOT} rows with a root, got ${withRoot}`);
}
// The regression that motivated this rewrite: one row per word instead of per
// segment. Catch it by name rather than waiting to notice a missing word.
const distinctWords = new Set(rows.map((r) => `${r[0]}:${r[1]}:${r[2]}`)).size;
if (rows.length <= distinctWords) {
  problems.push(
    `only ${rows.length} rows for ${distinctWords} words — segments are being collapsed again`
  );
}
if (!rows.some((r) => r[7] === 'qmr')) {
  problems.push("root 'qmr' is absent — Surah 54 is named Al-Qamar, so this is wrong");
}

if (problems.length && !allowUnpinned) {
  log('');
  for (const p of problems) log(`  ✘ ${p}`);
  log('\nREFUSING TO EMIT.');
  process.exit(2);
}

const q = (v) =>
  v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

const COLS =
  'surah_id, ayah_id, word_index, segment_index, form, tag, lemma, root, pos, ' +
  'verb_form, aspect, voice, mood, person, gender, number, case_case, state';

process.stdout.write('-- Generated by scripts/ingest-morphology.mjs — do not edit by hand.\n');
process.stdout.write('-- Quranic Arabic Corpus v0.4, Kais Dukes 2011, GNU GPL.\n');
process.stdout.write('-- Attribution required: https://corpus.quran.com\n');
process.stdout.write(`-- source sha256: ${sha}\n`);
process.stdout.write('DELETE FROM quran_word_morphology;\n');

for (const r of rows) {
  const vals = r
    .map((v, i) => (i < 4 ? String(v) : q(v)))
    .join(', ');
  process.stdout.write(
    `INSERT OR REPLACE INTO quran_word_morphology (${COLS}) VALUES (${vals});\n`
  );
}

log(`emitted ${rows.length} INSERT statements`);
