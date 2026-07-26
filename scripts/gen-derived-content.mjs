#!/usr/bin/env node
/**
 * Generate the derived grammar exercise bank and memorization curriculum.
 *
 *   node scripts/gen-derived-content.mjs > /tmp/derived.sql
 *   cd workers && npx wrangler d1 execute languagebuilder --local  --file=/tmp/derived.sql
 *   cd workers && npx wrangler d1 execute languagebuilder --remote --file=/tmp/derived.sql
 *
 * Inputs, both already pinned by checksum elsewhere in this repo:
 *   data/quranic-corpus-morphology-0.4.txt  (128,219 annotated segments)
 *   data/quran-uthmani.txt                  (6,236 verses)
 *
 * Nothing here is authored. Every exercise names the corpus row it came from, so
 * a wrong item can be traced and disproved — which is precisely what the five
 * hand-written grammar errors could not be.
 *
 * Distractors are only ever drawn from values ATTESTED elsewhere in the corpus.
 * Inventing them would make questions answerable by elimination and would assert
 * facts the corpus does not support.
 *
 * Attribution: Quranic Arabic Corpus v0.4 (Kais Dukes, GNU GPL) — a visible link
 * to corpus.quran.com is required wherever this is surfaced. Tanzil text, CC-BY.
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const log = (m) => process.stderr.write(m + '\n');

const CORPUS_SHA = 'a1d12923815341face765083805d2148ed2d9f5cc3f7d6665219d887675d8c46';
const TEXT_SHA = 'abe6447a5d29bb126383ba9120628060cf96dc9ef5b402a506fc251f6ed0b9a2';

// ── Buckwalter → Arabic (mirrors workers/src/lib/buckwalter.ts) ─────────────
const BW = {
  "'": 'ء', '|': 'آ', '>': 'أ', '&': 'ؤ', '<': 'إ', '}': 'ئ', '{': 'ٱ',
  A: 'ا', b: 'ب', p: 'ة', t: 'ت', v: 'ث', j: 'ج', H: 'ح', x: 'خ', d: 'د',
  '*': 'ذ', r: 'ر', z: 'ز', s: 'س', $: 'ش', S: 'ص', D: 'ض', T: 'ط', Z: 'ظ',
  E: 'ع', g: 'غ', f: 'ف', q: 'ق', k: 'ك', l: 'ل', m: 'م', n: 'ن', h: 'ه',
  w: 'و', Y: 'ى', y: 'ي', _: 'ـ', F: 'ً', N: 'ٌ', K: 'ٍ', a: 'َ', u: 'ُ',
  i: 'ِ', '~': 'ّ', o: 'ْ', '`': 'ٰ',
  // Extended Buckwalter for the mushaf's annotation marks. Derived empirically
  // by diffing corpus words against the pinned Tanzil text — see
  // workers/src/lib/buckwalter.ts for the method and the confidence figures.
  '^': 'ٓ', '@': '۟', ',': 'ۥ', '.': 'ۦ', '[': 'ۢ', '#': 'ٔ',
  ']': 'ۭ', '"': '۠', ':': 'ۜ', '-': '۪', '+': '۫', '!': 'ۨ',
  '%': '۬', ';': 'ۣ',
};
const toArabic = (s) => [...(s ?? '')].map((c) => BW[c] ?? c).join('');
const rootArabic = (r) => (r ? [...r].map((c) => BW[c] ?? c).join(' ') : null);

/** Deterministic shuffle, so regenerating does not churn the whole bank. */
function seededShuffle(items, seedStr) {
  let h = 2166136261;
  for (const ch of seedStr) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Load and verify inputs ─────────────────────────────────────────────────
const corpusRaw = await readFile(join(root, 'data/quranic-corpus-morphology-0.4.txt'), 'utf-8');
const textRaw = await readFile(join(root, 'data/quran-uthmani.txt'), 'utf-8');

for (const [name, raw, want] of [
  ['corpus', corpusRaw, CORPUS_SHA],
  ['text', textRaw, TEXT_SHA],
]) {
  const got = createHash('sha256').update(raw).digest('hex');
  if (got !== want) {
    log(`REFUSING: ${name} checksum mismatch\n  expected ${want}\n  got      ${got}`);
    process.exit(3);
  }
}
log('inputs verified by checksum');

// ── Parse the corpus ───────────────────────────────────────────────────────
const LOCATION = /^\((\d+):(\d+):(\d+):(\d+)\)$/;
const ROMAN = /\((I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\)/;
const segments = [];
for (const line of corpusRaw.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const p = line.replace(/\r$/, '').split('\t');
  if (p.length < 4) continue;
  const loc = LOCATION.exec(p[0].trim());
  if (!loc) continue;
  const f = p[3];
  segments.push({
    surah: +loc[1], ayah: +loc[2], word: +loc[3], seg: +loc[4],
    form: p[1], tag: p[2],
    lemma: f.match(/LEM:([^|]+)/)?.[1]?.trim() ?? null,
    root: f.match(/ROOT:([^|]+)/)?.[1]?.trim() ?? null,
    pos: f.match(/POS:([A-Z]+)/)?.[1] ?? null,
    verbForm: ROMAN.exec(f)?.[1] ?? null,
    aspect: ['PERF', 'IMPF', 'IMPV'].find((k) => f.includes(k)) ?? null,
    kase: ['NOM', 'ACC', 'GEN'].find((k) => f.includes(k)) ?? null,
  });
}
log(`corpus: ${segments.length} segments`);

/** Root frequency drives difficulty: a common root is an easier question. */
const rootFreq = new Map();
for (const s of segments) if (s.root) rootFreq.set(s.root, (rootFreq.get(s.root) ?? 0) + 1);

function levelFromFreq(n) {
  if (n >= 300) return 1;
  if (n >= 120) return 2;
  if (n >= 50) return 3;
  if (n >= 15) return 4;
  return 5;
}

const VERB_FORMS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const CASE_LABEL = { NOM: 'Nominative (مرفوع)', ACC: 'Accusative (منصوب)', GEN: 'Genitive (مجرور)' };
const ASPECT_LABEL = { PERF: 'Perfect — past (ماضي)', IMPF: 'Imperfect — present (مضارع)', IMPV: 'Imperative (أمر)' };
const POS_LABEL = {
  N: 'Noun', V: 'Verb', ADJ: 'Adjective', PN: 'Proper noun', P: 'Preposition',
  PRON: 'Pronoun', DET: 'Determiner', CONJ: 'Conjunction', REL: 'Relative pronoun',
  DEM: 'Demonstrative', NEG: 'Negative particle', INTG: 'Interrogative',
};

const exercises = [];
const seenKey = new Set();

/**
 * Only ask about segments that ARE a whole word.
 *
 * A stem whose prefix was split off does not stand alone: bi+smi leaves "smi",
 * which renders as سْمِ — a letter followed by a sukun, a form no learner will
 * ever meet on its own. A first attempt filtered words STARTING with a diacritic,
 * which missed this exactly: سْمِ starts with a letter. Showing the fragment is
 * unfair regardless of what it starts with.
 *
 * 35,336 of the 77,429 words are single-segment, which is ample for a bank of
 * this size. The alternative — render the whole word and highlight one segment
 * inside it — is a better feature but a bigger one.
 */
const segmentsPerWord = new Map();
for (const seg of segments) {
  const k = `${seg.surah}:${seg.ayah}:${seg.word}`;
  segmentsPerWord.set(k, (segmentsPerWord.get(k) ?? 0) + 1);
}
function isWholeWord(s) {
  return segmentsPerWord.get(`${s.surah}:${s.ayah}:${s.word}`) === 1;
}

function add(kind, s, { level, prompt, answer, options, explanation }) {
  const key = `${kind}|${s.surah}|${s.ayah}|${s.word}|${s.seg}`;
  if (seenKey.has(key)) return;
  if (!isWholeWord(s)) return;
  seenKey.add(key);
  exercises.push({
    id: `${kind}-${s.surah}-${s.ayah}-${s.word}-${s.seg}`,
    kind, level,
    wordArabic: toArabic(s.form),
    wordBuckwalter: s.form,
    prompt, answer,
    options: seededShuffle(options, key),
    explanation,
    surah: s.surah, ayah: s.ayah, word: s.word, seg: s.seg,
    root: s.root,
  });
}

// Forms attested per root, so verb-form distractors are always real.
const formsByRoot = new Map();
for (const s of segments) {
  if (s.pos !== 'V' || !s.root) continue;
  const form = s.verbForm ?? 'I'; // Form I is unmarked — it IS the bare triliteral
  if (!formsByRoot.has(s.root)) formsByRoot.set(s.root, new Set());
  formsByRoot.get(s.root).add(form);
}

// ── 1. Verb form (F9) ──────────────────────────────────────────────────────
for (const s of segments) {
  if (s.pos !== 'V' || !s.root) continue;
  const answer = s.verbForm ?? 'I';
  const attested = [...(formsByRoot.get(s.root) ?? [])].filter((f) => f !== answer);
  if (attested.length < 2) continue; // fewer than 3 options is not a question
  const options = [answer, ...attested.slice(0, 3)].map((f) => `Form ${f}`);
  add('verb_form', s, {
    level: levelFromFreq(rootFreq.get(s.root) ?? 0),
    prompt: `Which derived form is ${toArabic(s.form)}?`,
    answer: `Form ${answer}`,
    options,
    explanation:
      `${toArabic(s.form)} is Form ${answer} of the root ${rootArabic(s.root)}. ` +
      `The corpus attests Form${attested.length ? 's' : ''} ` +
      `${[answer, ...attested].sort((a, b) => VERB_FORMS.indexOf(a) - VERB_FORMS.indexOf(b)).join(', ')} for this root ` +
      `(${s.surah}:${s.ayah}).`,
  });
}

// ── 2. Case ending (i'rab) ─────────────────────────────────────────────────
for (const s of segments) {
  if (!s.kase || !['N', 'ADJ', 'PN'].includes(s.pos ?? '')) continue;
  const others = Object.keys(CASE_LABEL).filter((k) => k !== s.kase);
  add('case_ending', s, {
    level: s.pos === 'N' ? 2 : 3,
    prompt: `What is the case of ${toArabic(s.form)}?`,
    answer: CASE_LABEL[s.kase],
    options: [CASE_LABEL[s.kase], ...others.map((k) => CASE_LABEL[k])],
    explanation:
      `${toArabic(s.form)} at ${s.surah}:${s.ayah} is ${CASE_LABEL[s.kase]}` +
      (s.root ? `, from the root ${rootArabic(s.root)}` : '') + '.',
  });
}

// ── 3. Root identification ─────────────────────────────────────────────────
const commonRoots = [...rootFreq.entries()]
  .filter(([, n]) => n >= 20)
  .map(([r]) => r);
for (const s of segments) {
  if (!s.root || !s.lemma) continue;
  if ((rootFreq.get(s.root) ?? 0) < 20) continue;
  // Distractors: other common roots sharing a letter, so it is not a shape game.
  const near = commonRoots.filter(
    (r) => r !== s.root && r.length === s.root.length && [...r].some((c) => s.root.includes(c))
  );
  if (near.length < 3) continue;
  const picks = seededShuffle(near, `root${s.surah}${s.ayah}${s.word}`).slice(0, 3);
  add('root_id', s, {
    level: levelFromFreq(rootFreq.get(s.root) ?? 0),
    prompt: `What is the root of ${toArabic(s.form)}?`,
    answer: rootArabic(s.root),
    options: [rootArabic(s.root), ...picks.map(rootArabic)],
    explanation:
      `${toArabic(s.form)} derives from ${rootArabic(s.root)}, which occurs ` +
      `${rootFreq.get(s.root)} times in the Quran (${s.surah}:${s.ayah}).`,
  });
}

// ── 4. Part of speech ──────────────────────────────────────────────────────
for (const s of segments) {
  if (!s.pos || !POS_LABEL[s.pos]) continue;
  if (!['N', 'V', 'ADJ', 'P', 'PRON', 'CONJ'].includes(s.pos)) continue;
  const others = ['N', 'V', 'ADJ', 'P', 'PRON', 'CONJ'].filter((p) => p !== s.pos);
  const picks = seededShuffle(others, `pos${s.surah}${s.ayah}${s.word}${s.seg}`).slice(0, 3);
  add('pos_id', s, {
    level: 1,
    prompt: `What part of speech is ${toArabic(s.form)}?`,
    answer: POS_LABEL[s.pos],
    options: [POS_LABEL[s.pos], ...picks.map((p) => POS_LABEL[p])],
    explanation: `${toArabic(s.form)} at ${s.surah}:${s.ayah} is tagged ${POS_LABEL[s.pos]} in the corpus.`,
  });
}

// ── 5. Verb aspect ─────────────────────────────────────────────────────────
for (const s of segments) {
  if (s.pos !== 'V' || !s.aspect) continue;
  const others = Object.keys(ASPECT_LABEL).filter((a) => a !== s.aspect);
  add('aspect', s, {
    level: 2,
    prompt: `Is ${toArabic(s.form)} past, present or imperative?`,
    answer: ASPECT_LABEL[s.aspect],
    options: [ASPECT_LABEL[s.aspect], ...others.map((a) => ASPECT_LABEL[a])],
    explanation: `${toArabic(s.form)} at ${s.surah}:${s.ayah} is ${ASPECT_LABEL[s.aspect]}.`,
  });
}

// ── Cap per (kind, level) so the bank is balanced, not 40k of one thing ────
const PER_BUCKET = 60;
const buckets = new Map();
const chosen = [];
for (const e of exercises) {
  const k = `${e.kind}|${e.level}`;
  const n = buckets.get(k) ?? 0;
  if (n >= PER_BUCKET) continue;
  buckets.set(k, n + 1);
  chosen.push(e);
}

log(`exercises: ${exercises.length} candidates, ${chosen.length} selected`);
const byKind = {};
for (const e of chosen) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
log(`           by kind: ${JSON.stringify(byKind)}`);
const byLevel = {};
for (const e of chosen) byLevel[e.level] = (byLevel[e.level] ?? 0) + 1;
log(`           by level: ${JSON.stringify(byLevel)}`);

// ── Memorization curriculum, from the pinned text ─────────────────────────
const counts = new Map();
for (const line of textRaw.split('\n')) {
  const p = line.trim().split('|');
  if (p.length < 3) continue;
  const s = +p[0];
  if (!Number.isInteger(s)) continue;
  counts.set(s, (counts.get(s) ?? 0) + 1);
}

// Names come from content/surah-names.json, derived from src/app/lib/surahs.ts
// whose Arabic and transliterations were verified against Tanzil and quran.com.
// Committed rather than living in data/, which is gitignored.
const SURAH_NAMES = JSON.parse(
  await readFile(join(root, 'content/surah-names.json'), 'utf-8')
);

/** Chunk size grows with level: short surahs are learned whole. */
function chunkFor(total) {
  if (total <= 8) return total;
  if (total <= 20) return 5;
  if (total <= 60) return 6;
  return 8;
}

// Teaching order: shortest surahs first (they are the ones learned first in
// practice, and they sit at the end of the muṣḥaf), then outward by length.
const order = [...counts.entries()].sort((a, b) => a[1] - b[1] || b[0] - a[0]);

const units = [];
let seq = 1;
for (const [surah, total] of order) {
  const size = chunkFor(total);
  for (let from = 1; from <= total; from += size) {
    const to = Math.min(from + size - 1, total);
    const n = to - from + 1;
    const level =
      total <= 8 ? 1 :
      total <= 20 ? 2 :
      total <= 60 ? 3 :
      total <= 120 ? 4 :
      total <= 200 ? 5 : 6;
    units.push({
      id: `mu-${surah}-${from}-${to}`,
      sequence: seq++,
      level,
      surah, from, to, count: n,
      name: SURAH_NAMES?.[String(surah)] ?? `Surah ${surah}`,
      rationale:
        total === n
          ? `Whole surah — ${total} ayah${total === 1 ? '' : 's'}, short enough to memorise as one unit.`
          : `Ayahs ${from}–${to} of ${total}. Grouped in ${size}s to keep each session reviewable.`,
    });
  }
}
log(`memorization: ${units.length} units across ${counts.size} surahs`);

// ── Emit ───────────────────────────────────────────────────────────────────
const q = (v) =>
  v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

const out = [];
out.push('-- Generated by scripts/gen-derived-content.mjs — do not edit by hand.');
out.push('-- Quranic Arabic Corpus v0.4 (Kais Dukes, GNU GPL) https://corpus.quran.com');
out.push('-- Tanzil Uthmani text (CC-BY) https://tanzil.net');
out.push('DELETE FROM grammar_exercise_bank;');
for (const e of chosen) {
  out.push(
    'INSERT OR REPLACE INTO grammar_exercise_bank (id, kind, level, word_arabic, word_buckwalter, prompt, answer, options, explanation, surah_id, ayah_id, word_index, segment_index, root) VALUES (' +
      [
        q(e.id), q(e.kind), e.level, q(e.wordArabic), q(e.wordBuckwalter),
        q(e.prompt), q(e.answer), q(JSON.stringify(e.options)), q(e.explanation),
        e.surah, e.ayah, e.word, e.seg, q(e.root),
      ].join(', ') + ');'
  );
}
out.push('DELETE FROM memorization_units;');
for (const u of units) {
  out.push(
    'INSERT OR REPLACE INTO memorization_units (id, sequence, level, surah_id, ayah_from, ayah_to, ayah_count, surah_name, rationale) VALUES (' +
      [
        q(u.id), u.sequence, u.level, u.surah, u.from, u.to, u.count,
        q(u.name), q(u.rationale),
      ].join(', ') + ');'
  );
}

process.stdout.write(out.join('\n') + '\n');
log(`emitted ${chosen.length} exercises and ${units.length} memorization units`);
