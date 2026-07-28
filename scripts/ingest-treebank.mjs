#!/usr/bin/env node
/**
 * Ingest the Extended Quranic Treebank — the SYNTAX layer the morphology corpus lacks.
 *
 *   node scripts/ingest-treebank.mjs > /tmp/treebank.sql
 *   node scripts/ingest-treebank.mjs --verify-only     # run the checks, emit nothing
 *
 * NOT a CI gate, and must not become one. data/ is gitignored — the sources are large and
 * regenerable — so this cannot run on a runner, and there is nothing here to check without
 * the file. Adding gen-root-lessons.mjs --check to CI without noticing that cost two red
 * builds; this note exists so the same thought stops here instead.
 *
 * Source: Nashir WA, Mohsen AM, Al-Shargabi AA, Nour MK, Al-onazi BB.
 *   "A complete, multi-layered quranic treebank dataset with hybrid syntactic
 *   annotations for classical arabic processing." Data in Brief 62:111940 (2025).
 *   doi:10.1016/j.dib.2025.111940 — github.com/NoorBayan/Quranic
 * Licence: CC BY 4.0 (paper), MIT (repository). Attribution is REQUIRED wherever this
 * data is displayed, exactly as for the GPL morphology corpus and the CC-BY timings.
 *
 * ── Why a second corpus at all ──────────────────────────────────────────────
 *
 * Kais Dukes' morphology v0.4 records what each WORD is. It does not record what each
 * word DOES, and its own syntactic layer covers ~40% of verses as static images. That
 * absence is why grammar-03 had no practice for so long, why grammar-06 (Idafa) settles
 * for generic case-ending drills, and why "which word is the مبتدأ" was not a question
 * this app could ask. This file answers all three: 4,399 خبر relations, 9,807 مضاف إليه,
 * 16,624 فاعل, 10,852 مفعول به, over all 6,236 ayat.
 *
 * ── The reason every drill built on this must be cross-checked ──────────────
 *
 * This layer is NOT hand-verified, and the authors say so. OCR recovered Dukes' parse
 * trees for ~40% of verses; a BiLSTM parser generated the remainder; six annotators then
 * reviewed. Reported LAS is 95.7% — on a 350-sentence sample — and formal
 * inter-annotator agreement was never computed corpus-wide.
 *
 * 95.7% means roughly one label in twenty-three is wrong. Deriving exercises straight
 * from that would ship a bank in which ~4% of items teach something false, with nothing
 * to tell a learner which ones. That is the sun-letter error again, at scale.
 *
 * So the syntax layer is only ever used where a SECOND, INDEPENDENT source agrees.
 * Traditional grammar fixes the case each role takes — فاعل is nominative, مفعول به
 * accusative, مضاف إليه genitive, خبر nominative — and case comes from the hand-verified
 * morphology, not from the parser. Requiring the two to concur is a real check, not a
 * restatement: measured agreement is 99.1% (Subj), 98.4% (Pred), 96.2% (Poss) and 92.2%
 * (Obj), so the disagreements are a substantial set that this discards rather than ships.
 *
 * The assertions below refuse the ingest if any of those figures drops, which would mean
 * either a different release or a bad parse — both reasons to stop rather than proceed.
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const verifyOnly = process.argv.includes('--verify-only');
const log = (m) => process.stderr.write(m + '\n');

const TREEBANK = join(root, 'data/quranic-treebank-eqtb.csv');
const MORPHOLOGY = join(root, 'data/quranic-corpus-morphology-0.4.txt');

/**
 * SHA-256 of corpus/Quranic.csv, extracted from corpus/Quranic.rar at
 * github.com/NoorBayan/Quranic. Pinned for the same reason as every other source here:
 * a swapped file would not fail loudly, it would silently teach different grammar.
 */
const TREEBANK_SHA = '38c82933b41bff10dfd65c26a71e1ac7e424a7142b3520ca5541cfea012818e1';

const raw = await readFile(TREEBANK);
const gotSha = createHash('sha256').update(raw).digest('hex');
if (gotSha !== TREEBANK_SHA) {
  log(`REFUSING: treebank checksum mismatch\n  expected ${TREEBANK_SHA}\n  got      ${gotSha}`);
  process.exit(3);
}

/**
 * The file is UTF-16LE with a BOM, not UTF-8.
 *
 * Read as UTF-8 it parses without error and yields a column header of NUL-separated
 * single characters, which looks like a delimiter problem rather than an encoding one.
 * Checked by byte: it opens ff fe.
 */
if (!(raw[0] === 0xff && raw[1] === 0xfe)) {
  log('REFUSING: expected a UTF-16LE BOM. The upstream file encoding has changed.');
  process.exit(3);
}
const text = raw.toString('utf16le').replace(/^﻿/, '');

const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
const header = lines[0].split('\t');
const col = (name) => {
  const i = header.indexOf(name);
  if (i < 0) {
    log(`REFUSING: column "${name}" is missing. The upstream schema has changed.`);
    process.exit(3);
  }
  return i;
};

const C = {
  sentence: col('sentence_id'),
  token: col('token_id'),
  head: col('ref_token_id'),
  surah: col('chapter_id'),
  ayah: col('verse_id'),
  word: col('word_id'),
  seg: col('tok_id'),
  pos: col('pos'),
  root: col('root'),
  kase: col('nominal_case'),
  rel: col('rel_label'),
  relAr: col('rel_label_ar'),
  constituent: col('constituent_label_en'),
  derived: col('derived_nouns'),
  uthmani: col('uthmani_token'),
};

const rows = lines.slice(1).map((l) => l.split('\t'));
const blank = (v) => !v || v === '_' || v === '-';

/**
 * A token the treebank RECONSTRUCTS rather than reads: an elided subject, an omitted
 * predicate. word_id is 0 for these. They are kept, because حذف is itself a topic and
 * because a parse that hides its own reconstructions is harder to check — but they are
 * flagged, since there is no morphology row to cross-check them against and so no drill
 * may rest on one.
 */
const isImplied = (r) => Number(r[C.word]) < 1;

const realTokens = rows.filter((r) => !isImplied(r));
const impliedTokens = rows.filter(isImplied);
const ayat = new Set(rows.map((r) => `${r[C.surah]}:${r[C.ayah]}`));

log(`treebank: ${rows.length} rows — ${realTokens.length} real, ${impliedTokens.length} reconstructed`);

// ── Assertion 1: it is the same text, completely ────────────────────────────
const problems = [];
if (realTokens.length !== 128219) {
  problems.push(`${realTokens.length} real tokens, expected 128,219 (the morphology's segment count)`);
}
if (ayat.size !== 6236) problems.push(`${ayat.size} ayat covered, expected 6,236`);

// ── Assertion 2: it agrees with the corpus we already trust ─────────────────
//
// Root is the field to compare on. It is present in both, it is the most consequential
// field this app uses, and it is not something two independent annotations would agree
// on by chance — 49,968 of them.
const tbByLoc = new Map();
for (const r of realTokens) {
  tbByLoc.set(`${r[C.surah]}:${r[C.ayah]}:${r[C.word]}:${r[C.seg]}`, r);
}

const morph = await readFile(MORPHOLOGY, 'utf-8');
const LOCATION = /^\((\d+):(\d+):(\d+):(\d+)\)$/;
let inBoth = 0;
let onlyOurs = 0;
let rootPairs = 0;
let rootAgree = 0;
/** Morphological case by location, for assertion 3. Read from the file, not the parser. */
const caseByLoc = new Map();
for (const line of morph.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const p = line.replace(/\r$/, '').split('\t');
  if (p.length < 4) continue;
  const m = LOCATION.exec(p[0].trim());
  if (!m) continue;
  const loc = `${+m[1]}:${+m[2]}:${+m[3]}:${+m[4]}`;
  const kase = ['NOM', 'ACC', 'GEN'].find((k) => p[3].includes(k)) ?? null;
  if (kase) caseByLoc.set(loc, kase);
  const t = tbByLoc.get(loc);
  if (!t) {
    onlyOurs += 1;
    continue;
  }
  inBoth += 1;
  const ourRoot = p[3].match(/ROOT:([^|]+)/)?.[1]?.trim() ?? null;
  if (ourRoot && !blank(t[C.root])) {
    rootPairs += 1;
    if (ourRoot === t[C.root]) rootAgree += 1;
  }
}
const rootPct = (100 * rootAgree) / (rootPairs || 1);
log(`agreement with the morphology corpus: ${inBoth} shared locations, root ${rootPct.toFixed(2)}%`);
if (onlyOurs !== 0) problems.push(`${onlyOurs} locations exist in the morphology and not the treebank`);
// Anything below total root agreement means these are not the same base annotation, and
// the whole argument for trusting the syntax layer by association collapses.
if (rootPct < 100) problems.push(`root agreement is ${rootPct.toFixed(2)}%, expected 100%`);

// ── Assertion 3: the relation/case concurrence still holds ──────────────────
//
// The floors are the figures measured on this release, minus a small margin. They are
// asserted rather than trusted because they are the entire basis on which a
// 95.7%-accurate layer is allowed to produce teaching material.
const EXPECTED_CASE = { Subj: 'NOM', Pred: 'NOM', Obj: 'ACC', Poss: 'GEN', Spec: 'ACC' };
const FLOOR = { Subj: 98.5, Pred: 97.5, Obj: 91.0, Poss: 95.0, Spec: 97.5 };
const concurrence = {};
for (const [rel, want] of Object.entries(EXPECTED_CASE)) {
  let marked = 0;
  let agree = 0;
  for (const r of realTokens) {
    if (r[C.rel] !== rel) continue;
    const kase = caseByLoc.get(`${r[C.surah]}:${r[C.ayah]}:${r[C.word]}:${r[C.seg]}`);
    if (!kase) continue;
    marked += 1;
    if (kase === want) agree += 1;
  }
  const pct = (100 * agree) / (marked || 1);
  concurrence[rel] = { marked, agree, pct };
  log(`  ${rel.padEnd(5)} vs case: ${agree}/${marked} = ${pct.toFixed(1)}% (floor ${FLOOR[rel]}%)`);
  if (pct < FLOOR[rel]) {
    problems.push(`${rel}/case concurrence is ${pct.toFixed(1)}%, below the ${FLOOR[rel]}% floor`);
  }
}

// ── Assertion 4: the head reference resolves ────────────────────────────────
//
// token_id is SENTENCE-LOCAL and ref_token_id points into that same sentence. Joining on
// it globally appears to work and yields nonsense — it named أَعُوذُ as the head of a word
// in 2:87, because the id collides across all 11,693 sentences. Asserted so that a
// future change to the id scheme fails here rather than in the exercise bank.
const byKey = new Map();
for (const r of rows) byKey.set(`${r[C.sentence]}#${r[C.token]}`, r);
let unresolved = 0;
for (const r of rows) {
  if (blank(r[C.head])) continue;
  if (!byKey.has(`${r[C.sentence]}#${r[C.head]}`)) unresolved += 1;
}
log(`head references: ${rows.length - unresolved}/${rows.length} resolve within their sentence`);
if (unresolved > 0) {
  problems.push(`${unresolved} head references do not resolve inside their own sentence`);
}

if (problems.length > 0) {
  log(`\nREFUSING: ${problems.length} assertion(s) failed:`);
  for (const p of problems) log(`  ✘ ${p}`);
  process.exit(3);
}
log('all assertions pass');

if (verifyOnly) process.exit(0);

// ── Emit ───────────────────────────────────────────────────────────────────
//
// Only the columns the syntax layer ADDS. Root, lemma, POS and case already live in
// quran_word_morphology and duplicating them would create two answers to the same
// question — the failure that made 40% of the morphology table wrong in the first place.
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (blank(v) ? 'NULL' : String(Number(v)));

const out = [];
out.push('-- Generated by scripts/ingest-treebank.mjs. Do not edit.');
out.push('-- Extended Quranic Treebank, Nashir et al. 2025, doi:10.1016/j.dib.2025.111940 (CC BY 4.0).');
out.push('DELETE FROM quran_syntax;');
for (const r of rows) {
  // Rows with nothing syntactic to say are not stored. NonRel marks a prefix segment
  // that carries no relation of its own, and it is 45,031 rows of nothing.
  const rel = blank(r[C.rel]) || r[C.rel] === 'NonRel' ? null : r[C.rel];
  const constituent = blank(r[C.constituent]) ? null : r[C.constituent];
  const derived = blank(r[C.derived]) ? null : r[C.derived];
  if (!rel && !constituent && !derived) continue;
  out.push(
    'INSERT OR REPLACE INTO quran_syntax (sentence_id, token_index, head_index, surah_id, ' +
      'ayah_id, word_index, segment_index, rel, rel_ar, constituent, derived_noun, token, is_implied) VALUES (' +
      [
        n(r[C.sentence]),
        n(r[C.token]),
        n(r[C.head]),
        n(r[C.surah]),
        n(r[C.ayah]),
        n(r[C.word]),
        n(r[C.seg]),
        q(rel),
        q(blank(r[C.relAr]) ? null : r[C.relAr]),
        q(constituent),
        q(derived),
        q(r[C.uthmani]),
        isImplied(r) ? '1' : '0',
      ].join(', ') +
      ');'
  );
}
process.stdout.write(out.join('\n') + '\n');
log(`emitted ${out.length - 3} rows into quran_syntax`);
