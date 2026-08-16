#!/usr/bin/env node
/**
 * Governor (عامل) items from the treebank, with the same concur rule as
 * gen-syntax-exercises.mjs.
 *
 *   node scripts/gen-governor-exercises.mjs            # write SQL to stdout
 *   node scripts/gen-governor-exercises.mjs --self-test
 *
 * Attribution: Extended Quranic Treebank CC BY, QAC v0.4 GPL, Tanzil CC BY.
 *
 * Emit only Obj/Subj/Poss with a token head. Pred is dropped (ibtidāʾ is
 * ʿāmil maʿnawī). Head must be is_implied = 0. Case must concur.
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export function shouldEmitGovernor(input) {
  if (input.headImplied === 1) return false;
  if (input.rel === 'Pred') return false;
  if (input.rel === 'Obj') return input.headPos === 'V' && input.depCase === 'ACC';
  if (input.rel === 'Subj') return input.headPos === 'V' && input.depCase === 'NOM';
  if (input.rel === 'Poss') return input.depCase === 'GEN';
  return false;
}

const selfTest = process.argv.includes('--self-test') || process.argv.includes('--check');
if (selfTest) {
  const emit = shouldEmitGovernor({
    rel: 'Obj',
    headPos: 'V',
    depCase: 'ACC',
    headImplied: 0,
  });
  const drop = shouldEmitGovernor({
    rel: 'Pred',
    headPos: 'N',
    depCase: 'NOM',
    headImplied: 0,
  });
  if (!emit || drop) {
    process.stderr.write('governor self-test failed\n');
    process.exit(1);
  }
  process.stdout.write('governor self-test passed: emit Obj+verb, drop Pred\n');
  process.exit(0);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const log = (m) => process.stderr.write(m + '\n');

const TREEBANK_SHA = '38c82933b41bff10dfd65c26a71e1ac7e424a7142b3520ca5541cfea012818e1';
const TEXT_SHA = 'abe6447a5d29bb126383ba9120628060cf96dc9ef5b402a506fc251f6ed0b9a2';
const CORPUS_SHA = 'a1d12923815341face765083805d2148ed2d9f5cc3f7d6665219d887675d8c46';

let tbRaw;
let textRaw;
let corpusRaw;
try {
  tbRaw = await readFile(join(root, 'data/quranic-treebank-eqtb.csv'));
  textRaw = await readFile(join(root, 'data/quran-uthmani.txt'), 'utf-8');
  corpusRaw = await readFile(join(root, 'data/quranic-corpus-morphology-0.4.txt'), 'utf-8');
} catch {
  log('data files missing — skip full generate; run --self-test');
  process.exit(0);
}

for (const [name, buf, want] of [
  ['treebank', tbRaw, TREEBANK_SHA],
  ['text', textRaw, TEXT_SHA],
  ['corpus', corpusRaw, CORPUS_SHA],
]) {
  const got = createHash('sha256').update(buf).digest('hex');
  if (got !== want) {
    log(`REFUSING: ${name} checksum mismatch`);
    process.exit(3);
  }
}

const ayahWords = new Map();
for (const line of textRaw.split('\n')) {
  const p = line.replace(/\r$/, '').split('|');
  if (p.length < 3) continue;
  ayahWords.set(`${+p[0]}:${+p[1]}`, p[2].trim().split(/\s+/));
}

const caseByLoc = new Map();
const posByLoc = new Map();
const formByLoc = new Map();
const LOCATION = /^\((\d+):(\d+):(\d+):(\d+)\)$/;
for (const line of corpusRaw.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const p = line.replace(/\r$/, '').split('\t');
  if (p.length < 4) continue;
  const m = LOCATION.exec(p[0].trim());
  if (!m) continue;
  const loc = `${+m[1]}:${+m[2]}:${+m[3]}:${+m[4]}`;
  const kase = ['NOM', 'ACC', 'GEN'].find((k) => p[3].includes(k)) ?? null;
  if (kase) caseByLoc.set(loc, kase);
  const pos = p[3].match(/POS:([A-Z]+)/)?.[1] ?? p[2] ?? null;
  if (pos) posByLoc.set(loc, pos);
  formByLoc.set(loc, p[1]);
}

const tbText = tbRaw.toString('utf16le').replace(/^\uFEFF/, '');
const tbLines = tbText.split(/\r?\n/).filter(Boolean);
const HEAD = tbLines[0].split('\t');
const cx = (n) => {
  const i = HEAD.indexOf(n);
  if (i < 0) {
    log(`REFUSING: treebank column "${n}" is missing`);
    process.exit(3);
  }
  return i;
};
const C = {
  sentence: cx('sentence_id'),
  token: cx('token_id'),
  head: cx('ref_token_id'),
  surah: cx('chapter_id'),
  ayah: cx('verse_id'),
  word: cx('word_id'),
  seg: cx('tok_id'),
  rel: cx('rel_label'),
  pos: cx('pos'),
};
const tokens = tbLines.slice(1).map((l) => l.split('\t'));
const byKey = new Map();
for (const t of tokens) byKey.set(`${t[C.sentence]}#${t[C.token]}`, t);
const headOf = (t) => byKey.get(`${t[C.sentence]}#${t[C.head]}`);
const locOf = (t) => `${t[C.surah]}:${t[C.ayah]}:${t[C.word]}:${t[C.seg]}`;
const ayahOf = (t) => `${t[C.surah]}:${t[C.ayah]}`;

const formFreq = new Map();
for (const line of corpusRaw.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const p = line.replace(/\r$/, '').split('\t');
  if (p.length < 2) continue;
  formFreq.set(p[1], (formFreq.get(p[1]) ?? 0) + 1);
}
const levelFromFreq = (n) => (n >= 300 ? 1 : n >= 120 ? 2 : n >= 50 ? 3 : n >= 15 ? 4 : 5);

function seededShuffle(items, seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return items
    .map((v, i) => {
      h = (Math.imul(h, 1103515245) + 12345) >>> 0;
      return { v, k: (h ^ Math.imul(i, 2654435761)) >>> 0 };
    })
    .sort((a, b) => a.k - b.k)
    .map((x) => x.v);
}

const REL_WHY = {
  Obj: 'the verb is ʿāmil of the mafʿūl',
  Subj: 'the verb is ʿāmil of the fāʿil',
  Poss: 'the first noun of the iḍāfa governs the second',
};
const CASE_LABEL = { NOM: 'marfūʿ (مرفوع)', ACC: 'manṣūb (منصوب)', GEN: 'majrūr (مجرور)' };
const MAX_AYAH_WORDS = 14;
const PER_BUCKET = Number(process.env.PER_BUCKET ?? 150);

const exercises = [];
const seen = new Set();
let candidates = 0;
let emitted = 0;
const dropped = { implied: 0, rule: 0, length: 0, foils: 0 };
for (const t of tokens) {
  const rel = t[C.rel];
  if (rel !== 'Obj' && rel !== 'Subj' && rel !== 'Poss') continue;
  if (Number(t[C.word]) < 1) continue;
  candidates += 1;
  const h = headOf(t);
  if (!h || Number(h[C.word]) < 1) {
    dropped.implied += 1;
    continue;
  }
  const depCase = caseByLoc.get(locOf(t)) ?? null;
  const headPos = posByLoc.get(locOf(h)) ?? h[C.pos] ?? null;
  if (
    !shouldEmitGovernor({
      rel,
      headPos,
      depCase,
      headImplied: 0,
    })
  ) {
    dropped.rule += 1;
    continue;
  }
  const words = ayahWords.get(ayahOf(t));
  if (!words || words.length > MAX_AYAH_WORDS) {
    dropped.length += 1;
    continue;
  }
  const dep = words[Number(t[C.word]) - 1];
  const head = words[Number(h[C.word]) - 1];
  if (!dep || !head || dep === head) continue;
  const key = `governor|${ayahOf(t)}|${t[C.word]}`;
  if (seen.has(key)) continue;
  const foils = [];
  const seenForm = new Set([head]);
  for (let i = 0; i < words.length; i += 1) {
    if (i === Number(h[C.word]) - 1) continue;
    if (seenForm.has(words[i])) continue;
    seenForm.add(words[i]);
    foils.push(words[i]);
  }
  if (foils.length < 3) {
    dropped.foils += 1;
    continue;
  }
  const picks = seededShuffle(foils, `gv${ayahOf(t)}${t[C.word]}`).slice(0, 3);
  seen.add(key);
  emitted += 1;
  exercises.push({
    id: `governor-${t[C.surah]}-${t[C.ayah]}-${t[C.word]}`,
    kind: 'governor',
    level: levelFromFreq((formFreq.get(formByLoc.get(locOf(h))) ?? 0) * 6),
    wordArabic: dep,
    prompt: `Why is ${dep} ${CASE_LABEL[depCase]} in ${t[C.surah]}:${t[C.ayah]}? Name the token ʿāmil.`,
    answer: head,
    options: seededShuffle([head, ...picks], `gvo${ayahOf(t)}${t[C.word]}`),
    explanation:
      `عامل: ${head} (${REL_WHY[rel]}). The treebank marks ${rel} and the ` +
      `morphology marks ${depCase}; both had to agree for this question to exist.`,
    surah: Number(t[C.surah]),
    ayah: Number(t[C.ayah]),
    word: Number(t[C.word]),
  });
}
log(
  `governor          ${String(emitted).padStart(5)} emitted — ${candidates} candidates, ` +
    `dropped: ${dropped.implied} no token head, ${dropped.rule} failed concur, ` +
    `${dropped.length} ayah too long, ${dropped.foils} too few distractors`
);

const defects = [];
for (const e of exercises) {
  if (!e.options.includes(e.answer)) defects.push(`${e.id}: answer missing from options`);
  if (new Set(e.options).size !== e.options.length) defects.push(`${e.id}: repeated option`);
  if (e.options.length < 4) defects.push(`${e.id}: ${e.options.length} options`);
  if (!e.explanation || e.explanation.length < 40) defects.push(`${e.id}: thin explanation`);
}
if (defects.length) {
  for (const d of defects.slice(0, 15)) log(`  ✘ ${d}`);
  log(`${defects.length} defect(s); refusing to emit.`);
  process.exit(3);
}

function spreadAcrossSurahs(items, cap) {
  const queues = new Map();
  for (const e of items) {
    if (!queues.has(e.surah)) queues.set(e.surah, []);
    queues.get(e.surah).push(e);
  }
  const order = [...queues.keys()].sort((a, b) => a - b).map((k) => queues.get(k));
  const out = [];
  let i = 0;
  while (out.length < cap) {
    const live = order.filter((q) => q.length);
    if (!live.length) break;
    out.push(live[i % live.length].shift());
    i += 1;
  }
  return out;
}
const buckets = new Map();
for (const e of exercises) {
  const k = `${e.kind}|${e.level}`;
  if (!buckets.has(k)) buckets.set(k, []);
  buckets.get(k).push(e);
}
const chosen = [];
for (const k of [...buckets.keys()].sort()) {
  chosen.push(...spreadAcrossSurahs(buckets.get(k), PER_BUCKET));
}
log(`selected ${chosen.length} of ${exercises.length} governor items`);

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const out = ['-- Generated by scripts/gen-governor-exercises.mjs. Do not edit.'];
out.push('-- Extended Quranic Treebank, Nashir et al. 2025 (CC BY 4.0). QAC v0.4 GPL. Tanzil CC BY.');
out.push("DELETE FROM grammar_exercise_bank WHERE kind = 'governor';");
for (const e of chosen) {
  out.push(
    'INSERT OR REPLACE INTO grammar_exercise_bank (id, kind, level, word_arabic, ' +
      'word_buckwalter, prompt, answer, options, explanation, surah_id, ayah_id, ' +
      'word_index, segment_index, root) VALUES (' +
      [
        q(e.id),
        q(e.kind),
        e.level,
        q(e.wordArabic),
        q(''),
        q(e.prompt),
        q(e.answer),
        q(JSON.stringify(e.options)),
        q(e.explanation),
        e.surah,
        e.ayah,
        e.word,
        1,
        'NULL',
      ].join(', ') +
      ');'
  );
}
process.stdout.write(out.join('\n') + '\n');
